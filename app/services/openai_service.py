import os
import json
from typing import Tuple

from dotenv import load_dotenv
from openai import OpenAI

from .. import schemas  # ContractGenerateRequest, ContractReviewRequest/Response, ContractApplySuggestions...

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not OPENAI_API_KEY:
    # fejlesztés közben hasznos, prod-ban lehet inkább logging
    raise RuntimeError("Hiányzik az OPENAI_API_KEY a .env fájlból")


# ---------------------------------------------------------
#  MINDEN OPENAI-HÍVÁS: ÚJ KLIENS -> STATLESS MŰKÖDÉS
#  (így minden gombnyomásra ÚJ szerződés generálódik)
# ---------------------------------------------------------
def get_client() -> OpenAI:
    return OpenAI(api_key=OPENAI_API_KEY)


# ---------------------------------------------------------
#  KÖZPONTI, RÉSZLETES SYSTEM PROMPT – MAGYAR SZERZŐDÉSGPT
# ---------------------------------------------------------
SYSTEM_PROMPT_CONTRACT = """
Te a “Magyar SzerződésGPT” nevű AI vagy, amely magyar polgári jogi és kereskedelmi jogi 
szerződések létrehozására, elemzésére és javítására specializált digitális asszisztensként működik.

Elvárások:
1. Mindig formális, precíz, magyar jogi nyelvet használj.
2. A szerződés felépítése legyen logikus, áttekinthető, számozott pontokkal.
3. Ne hivatkozz konkrét paragrafusokra (pl. “Ptk. 6:130. §”), de légy összhangban a magyar jog alapelveivel.
4. Kizárólag általános tájékoztatást adhatsz, soha ne állítsd, hogy a válasz hivatalos jogi tanács.
5. A kimeneteid legyenek konzisztens szerkezetűek és nyelvileg igényesek.

Jellemző szerződés-szerkezet (ha releváns):
- Preambulum
- A felek azonosítása (név, székhely/lakóhely, képviselet)
- A szerződés tárgya
- Teljesítés módja, határideje
- Díjazás / ellenérték, számlázás, fizetési határidők
- Felelősség
- Szavatosság (ha releváns)
- Titoktartási kötelezettség
- Szellemi alkotásokra (IP) vonatkozó rendelkezések
- Adatkezelési alapelvek (ha indokolt)
- A szerződés időtartama, megszűnése, felmondás
- Jogvita rendezése
- Vegyes rendelkezések
- Aláírási rész

Ha szerződést generálsz vagy javítasz:
- A szerződést a [SZERZŐDÉS] blokkban add vissza.
- A laikus, közérthető magyarázatot az [OSSZEFOGLALO] blokkban add vissza (ha a feladat ezt kéri).
- A laikus összefoglaló legyen tömör, gyakorlatias, max. kb. 10–12 mondat.
"""


# ---------------------------------------------------------
#  EGYSZERŰ TESZT: MONDAT VISSZAADÁSA
# ---------------------------------------------------------
def ai_test_sentence() -> str:
    """Egyszerű teszt: visszaad egy rövid mondatot magyarul."""
    client = get_client()
    response = client.chat.completions.create(
        model="gpt-5.1",
        messages=[
            {
                "role": "system",
                "content": (
                    "Te egy magyar nyelvű jogi asszisztens vagy. "
                    "Válaszolj röviden és barátságosan."
                ),
            },
            {
                "role": "user",
                "content": (
                    "Írj egy rövid mondatot arról, hogy működik a Magyar SzerződésGPT API."
                ),
            },
        ],
        temperature=0.4,
    )
    return response.choices[0].message.content or ""


# ---------------------------------------------------------
#  1) GENERATE: szerződés generálása
# ---------------------------------------------------------
def generate_contract(request: schemas.ContractGenerateRequest) -> Tuple[str, str]:
    """
    Magyar nyelvű szerződés generálása a megadott adatok alapján.
    Visszatér: (szerződés szövege, magyar összefoglaló).
    Minden hívás teljesen új, stateless generálás.
    """
    client = get_client()

    extra_terms = request.special_terms or "nincs külön megadva"

    user_prompt = f"""
Az alábbi adatok alapján készíts egy formális, magyar nyelvű szerződés-tervezetet.

Szerződés típusa: {request.type}
Felek: {request.parties}
A szerződés tárgya / szolgáltatás / feladat: {request.subject}
Díjazás / ellenérték, fizetési feltételek: {request.payment}
A szerződés időtartama, megszűnése: {request.duration}
Különleges kikötések, extra feltételek: {extra_terms}

Követelmények a kimenetre:
1. A válaszod KÉT jól elkülönülő blokkban add meg:

[SZERZŐDÉS]
(ide kerüljön a szerződés teljes, formális szövege)

[OSSZEFOGLALO]
(ide kerüljön egy laikus, közérthető összefoglaló, kb. 6–12 mondatban)

2. A [SZERZŐDÉS] blokkban a szerződés szerkezete legyen logikus és számozott. 
   Javasolt főbb fejezetek:
   - Preambulum
   - A felek
   - A szerződés tárgya
   - A teljesítés feltételei
   - Díjazás és fizetési feltételek
   - Felelősség
   - Szavatosság (ha releváns)
   - Titoktartás (ha releváns)
   - Szellemi alkotások / IP
   - Adatkezelés (ha szükséges)
   - A szerződés hatálya, megszűnése, felmondási szabályok
   - Jogviták rendezése
   - Vegyes rendelkezések
   - Záró rendelkezések, aláírás

3. Ne hivatkozz konkrét jogszabály-paragrafusokra (pl. Ptk. 6:130. §).
4. A nyelvezet legyen egyértelmű, pontos, formális, magyar jogi stílusú.
"""

    response = client.chat.completions.create(
        model="gpt-5.1",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT_CONTRACT},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.25,
    )

    text = response.choices[0].message.content or ""

    # Kettébontjuk a választ
    if "[OSSZEFOGLALO]" in text:
        contract_part, summary_part = text.split("[OSSZEFOGLALO]", 1)
        contract_text = contract_part.replace("[SZERZŐDÉS]", "").strip()
        summary_hu = summary_part.strip()
    else:
        contract_text = text.strip()
        summary_hu = (
            "A generálás sikeres volt, de a válasz nem tartalmazott külön [OSSZEFOGLALO] blokkot."
        )

    return contract_text, summary_hu


# ---------------------------------------------------------
#  2) REVIEW: szerződés elemzése / kockázatértékelése
# ---------------------------------------------------------
def analyze_contract(request: schemas.ContractReviewRequest) -> schemas.ContractReviewResponse:
    """
    AI-alapú szerződés review:
    - rövid, laikus összefoglaló,
    - max. 5 kockázatos pont,
    - általános kockázati szint.
    Az eredmény szigorúan a ContractReviewResponse JSON-sémának megfelelő.
    """
    client = get_client()

    contract_type = request.contract_type or "ismeretlen típus"
    party_role = request.party_role or "nem megadott szerep"

    user_instructions = f"""
Elemezd az alábbi szerződést.

Cél:
- Készíts rövid, magyar nyelvű, laikus összefoglalót.
- Emeld ki a legfeljebb 5 legfontosabb kockázatos vagy szokatlan pontot.
- Minden problémás ponthoz adj:
  - rövid idézetet vagy összefoglalót,
  - magyarázatot, hogy mi a gond jogilag vagy gyakorlatban,
  - kockázati szintet (alacsony / közepes / magas),
  - jelöld meg, kit hozhat hátrányos helyzetbe (pl. megbízó, megbízott, bérlő), vagy null, ha nem egyértelmű,
  - javasolt, kiegyensúlyozottabb megfogalmazást.

Tájékoztató adatok:
- Szerződés típusa (hozzávetőleges): {contract_type}
- A felhasználó szerződésbeli szerepe: {party_role}

Elemzendő szerződés szövege:
\"\"\"{request.contract_text}\"\"\"

A VÁLASZOD SZIGORÚAN ÉRVÉNYES JSON legyen, pontosan az alábbi szerkezetben:

{{
  "summary_hu": "rövid, laikus összefoglaló magyarul, max. 8-10 mondatban",
  "issues": [
    {{
      "clause_excerpt": "rövid idézet vagy összefoglaló a problémás pontról (max. 2-3 mondat)",
      "issue": "mi a gond jogilag vagy gyakorlatban, tömören",
      "risk_level": "alacsony" vagy "közepes" vagy "magas",
      "disadvantaged_party": "kit hoz hátrányba (pl. 'megbízó', 'bérlő')" vagy null,
      "suggestion": "javasolt, kiegyensúlyozottabb megfogalmazás, max. 3-4 mondat"
    }}
  ],
  "overall_risk": "alacsony" vagy "közepes" vagy "magas",
  "notes": "egyéb megjegyzések, amelyek mindig tartalmazzák, hogy ez nem minősül jogi tanácsadásnak és ügyvéddel érdemes egyeztetni"
}}

Fontos:
- Legfeljebb 5 elemet adj vissza az 'issues' listában.
- A 'disadvantaged_party' mező értéke VAGY egy rövid szöveg (pl. "megbízó"), VAGY JSON null (nem string), ha senki nincs egyértelmű hátrányban.
- A JSON legyen szintaktikailag érvényes, ne írj kommentet vagy extra szöveget.
"""

    response = client.chat.completions.create(
        model="gpt-5.1",
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "system",
                "content": (
                    "Te egy magyar jogra specializált, óvatos AI jogi asszisztens vagy. "
                    "Általános tájékoztatást adsz, nem minősülsz ügyvédnek, és mindig jelzed, "
                    "hogy a válasz nem helyettesíti a jogi tanácsadást."
                ),
            },
            {"role": "system", "content": SYSTEM_PROMPT_CONTRACT},
            {"role": "user", "content": user_instructions},
        ],
        temperature=0.2,
    )

    content = response.choices[0].message.content or "{}"
    data = json.loads(content)

    review = schemas.ContractReviewResponse(**data)
    return review


# ---------------------------------------------------------
#  3) APPLY SUGGESTIONS: javaslatok beépítése a szerződésbe
# ---------------------------------------------------------
def apply_suggestions(
    request: schemas.ContractApplySuggestionsRequest,
) -> schemas.ContractApplySuggestionsResponse:
    """
    Az eredeti szerződés szövegéből kiindulva építse be a kiválasztott javaslatokat,
    és adjon vissza egy módosított szerződés-verziót + rövid változás-összefoglalót.
    """
    client = get_client()

    # Összefoglaljuk a kiválasztott javaslatokat a prompt számára
    issues_summary_lines = []
    for idx, issue in enumerate(request.issues_to_apply, start=1):
        issues_summary_lines.append(
            f"{idx}. Kivonat: {issue.clause_excerpt}\n"
            f"   Probléma: {issue.issue}\n"
            f"   Javasolt módosítás: {issue.suggestion}\n"
        )

    issues_summary = "\n".join(issues_summary_lines) or "Nincs megadott javaslat."

    system_msg = (
        "Te egy magyar jogi asszisztens vagy. "
        "Feladatod, hogy az eredeti szerződést óvatosan módosítsd a megadott javaslatok figyelembevételével, "
        "úgy, hogy a szerződés szerkezete és jogi stílusa megmaradjon."
    )

    user_instructions = f"""
Az alábbi szerződést kell módosítanod úgy, hogy beépíted a kiválasztott javaslatokat.

Eredeti szerződés:
\"\"\"{request.original_contract}\"\"\"


Alkalmazandó javaslatok (ezeket vedd figyelembe, ahol releváns):
{issues_summary}

Fontos elvek:
- A szerződés formális, magyar jogi stílusát tartsd meg.
- Csak annyit módosíts, amennyi szükséges a javaslatok érvényesítéséhez.
- Ha valamelyik javaslatot nem lehet egyértelműen beépíteni, igyekezz óvatos, kiegyensúlyozott szöveget adni.
- A szerződés szerkezete (pontok számozása stb.) maradjon logikus és egységes.

A válaszod SZIGORÚAN az alábbi JSON struktúrában add meg (ne írj semmi mást):

{{
  "updated_contract_text": "a módosított szerződés teljes szövege",
  "change_summary": "rövid, magyar nyelvű összefoglaló arról, hogy nagy vonalakban milyen változások történtek"
}}
"""

    response = client.chat.completions.create(
        model="gpt-5.1",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_msg},
            {"role": "system", "content": SYSTEM_PROMPT_CONTRACT},
            {"role": "user", "content": user_instructions},
        ],
        temperature=0.25,
    )

    content = response.choices[0].message.content or "{}"
    data = json.loads(content)

    return schemas.ContractApplySuggestionsResponse(**data)


# ---------------------------------------------------------
#  4) IMPROVE: teljes szerződés javítása / kiegyensúlyozása
# ---------------------------------------------------------
MODEL_IMPROVE = "gpt-5.1"


def ai_improve_contract(
    req: schemas.ContractImproveRequest,
) -> schemas.ContractImproveResponse:
    """
    Eredeti szerződés szövege alapján készít egy javított, kiegyensúlyozottabb verziót.
    Nem írja át a szerződés lényegét, csak pontosít, kiegyensúlyoz és jogilag tisztábbá tesz.
    A kimenetben CSAK a javított szerződés szövege szerepel.
    """
    client = get_client()

    system_prompt = (
        "Te egy magyar jogra fókuszáló AI asszisztens vagy. "
        "Feladatod, hogy a megadott szerződés szövegéből készíts egy javított, "
        "egyenlőbb, átláthatóbb, de továbbra is magyar joggal összhangban lévő verziót. "
        "Ne hagyj ki fontos rendelkezéseket, csak módosíts, pontosíts. "
        "A kimenetben CSAK a javított szerződés teljes szövegét add vissza, "
        "külön magyarázat nélkül."
    )

    user_context_parts = []
    if req.contract_type:
        user_context_parts.append(f"Szerződés típusa: {req.contract_type}.")
    if req.party_role:
        user_context_parts.append(f"A felhasználó szerepe: {req.party_role}.")
    context_str = "\n".join(user_context_parts)

    user_prompt = (
        f"{context_str}\n\n"
        "Alább találod az eredeti szerződés teljes szövegét. "
        "Készíts belőle javított, kiegyensúlyozottabb, jogilag tisztább változatot, "
        "de a szerződés szerkezetét (fejezetek, pontszámok) nagyjából tartsd meg.\n\n"
        f"ERDETI SZERZŐDÉS SZÖVEGE:\n\n{req.contract_text}"
    )

    resp = client.chat.completions.create(
        model=MODEL_IMPROVE,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "system", "content": SYSTEM_PROMPT_CONTRACT},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.3,
    )

    improved_text = resp.choices[0].message.content or ""

    return schemas.ContractImproveResponse(
        improved_text=improved_text.strip(),
        summary_hu=None,
    )

# ---------------------------------------------------------
#  KÖZÖS, ALACSONY SZINTŰ OPENAI HÍVÁS
#  (template-alapú generáláshoz)
# ---------------------------------------------------------
def call_openai(
    model: str,
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.2,
) -> dict:
    """
    Egységes OpenAI-hívás egyszerű szöveggeneráláshoz.
    Visszatér: { "content": "..." }
    """
    client = get_client()

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=temperature,
    )

    return {
        "content": response.choices[0].message.content or ""
    }
