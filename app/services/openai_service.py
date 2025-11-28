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

client = OpenAI(api_key=OPENAI_API_KEY)


def ai_test_sentence() -> str:
    """Egyszerű teszt: visszaad egy rövid mondatot magyarul."""
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
    )
    return response.choices[0].message.content or ""


# ---------- GENERATE: szerződés generálása ----------


def generate_contract(request: schemas.ContractGenerateRequest) -> Tuple[str, str]:
    """
    Magyar nyelvű szerződés generálása a megadott adatok alapján.
    Visszatér: (szerződés szövege, magyar összefoglaló).
    """

    extra_terms = request.special_terms or "nincs külön megadva"

    prompt = f"""
Készíts egy részletes, formális, magyar nyelvű szerződés-tervezetet az alábbi adatok alapján.
A szerződés legyen jól strukturált, számozott pontokkal és magyar jogi nyelven.

Szerződés típusa: {request.type}
Felek: {request.parties}
A szerződés tárgya: {request.subject}
Díjazás / ellenérték: {request.payment}
Időtartam: {request.duration}
Extra kikötések: {extra_terms}

Követelmények:
- A szerződés formális, magyar jogi stílusú legyen.
- Legyen benne: Preambulum, Felek, Tárgy, Díjazás, Felelősség, Titoktartás (ha releváns), Megszűnés, Vegyes rendelkezések.
- Ne hivatkozz konkrét jogszabály-paragrafusokra.
- A válaszod két blokkban add vissza pontosan így:

[SZERZŐDÉS]
(ide jön a teljes szerződés szövege)

[OSSZEFOGLALO]
(ide jön a laikus, közérthető magyarázat)
"""

    response = client.chat.completions.create(
        model="gpt-5.1",
        messages=[
            {
                "role": "system",
                "content": (
                    "Te egy magyar jogi asszisztens vagy. Precíz, formális szerződéseket írsz, "
                    "és a végén közérthetően összefoglalod, mit jelentenek a gyakorlatban."
                ),
            },
            {
                "role": "user",
                "content": prompt,
            },
        ],
    )

    text = response.choices[0].message.content or ""

    # Kettébontjuk a választ
    if "[OSSZEFOGLALO]" in text:
        contract_part, summary_part = text.split("[OSSZEFOGLALO]", 1)
        contract_text = contract_part.replace("[SZERZŐDÉS]", "").strip()
        summary_hu = summary_part.strip()
    else:
        contract_text = text.strip()
        summary_hu = "A generálás sikeres volt, de nem találtam külön [OSSZEFOGLALO] blokkot."

    return contract_text, summary_hu


# ---------- REVIEW: szerződés elemzése / kockázatértékelése ----------


def analyze_contract(request: schemas.ContractReviewRequest) -> schemas.ContractReviewResponse:
    """
    AI-alapú szerződés review:
    - összefoglaló,
    - max 5 kockázatos pont,
    - általános kockázati szint.
    """

    contract_type = request.contract_type or "ismeretlen típus"
    party_role = request.party_role or "nem megadott szerep"

    system_msg = (
        "Te egy magyar jogra specializált, óvatos AI jogi asszisztens vagy. "
        "Általános tájékoztatást adsz, nem minősülsz ügyvédnek, "
        "és mindig jelzed, hogy a válasz nem helyettesíti a jogi tanácsadást."
    )

    user_instructions = f"""
Elemezd az alábbi szerződést.

Cél:
- Rövid, közérthető összefoglaló a szerződés lényegéről magyarul.
- A kockázatos vagy szokatlan pontok kiemelése (max. 5 db).
- Külön jelöld, ha a megadott fél szerepe (pl. megbízó/bérlő stb.) hátrányos helyzetben van.

Információk:
- Szerződés típusa (hozzávetőleges): {contract_type}
- A felhasználó szerződésbeli szerepe: {party_role}

Szerződés szövege:
\"\"\"{request.contract_text}\"\"\"

Válaszod SZIGORÚAN az alábbi JSON struktúrában add meg (ne írj semmi mást, csak érvényes JSON-t):

{{
  "summary_hu": "rövid, laikus összefoglaló magyarul, max. 8-10 mondatban",
  "issues": [
    {{
      "clause_excerpt": "rövid idézet vagy összefoglaló a problémás pontról (max. 2-3 mondat)",
      "issue": "mi a gond jogilag vagy gyakorlatban, tömören",
      "risk_level": "alacsony" vagy "közepes" vagy "magas",
      "disadvantaged_party": "kit hoz hátrányba (pl. 'megbízó', 'bérlő'), vagy null, ha senki",
      "suggestion": "javasolt, kiegyensúlyozottabb megfogalmazás, max. 3-4 mondat"
    }}
  ],
  "overall_risk": "alacsony" vagy "közepes" vagy "magas",
  "notes": "egyéb megjegyzések, diszklémer: mindig tartalmazza, hogy ez nem minősül jogi tanácsadásnak és ügyvéddel érdemes egyeztetni"
}}

Fontos:
- Legfeljebb 5 elemet adj vissza az 'issues' listában.
- A 'disadvantaged_party' mező értéke legyen VAGY egy rövid szöveg (pl. "megbízó"), VAGY JSON null (nem string), ha senki nincs egyértelmű hátrányban.
- A JSON legyen szintaktikailag érvényes.
"""

    response = client.chat.completions.create(
        model="gpt-5.1",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_msg},
            {"role": "user", "content": user_instructions},
        ],
    )

    content = response.choices[0].message.content or "{}"
    data = json.loads(content)

    review = schemas.ContractReviewResponse(**data)
    return review


# ---------- APPLY SUGGESTIONS: javaslatok beépítése a szerződésbe ----------


def apply_suggestions(
    request: schemas.ContractApplySuggestionsRequest,
) -> schemas.ContractApplySuggestionsResponse:
    """
    Az eredeti szerződés szövegéből kiindulva építse be a kiválasztott javaslatokat,
    és adjon vissza egy módosított szerződés-verziót + rövid változás-összefoglalót.
    """

    # Összefoglaljuk a kiválasztott javaslatokat a prompthoz
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
            {"role": "user", "content": user_instructions},
        ],
    )

    content = response.choices[0].message.content or "{}"
    data = json.loads(content)

    return schemas.ContractApplySuggestionsResponse(**data)


# ---------- IMPROVE: teljes szerződés javítása / kiegyensúlyozása ----------


MODEL_IMPROVE = "gpt-5.1"


def ai_improve_contract(
    req: schemas.ContractImproveRequest,
) -> schemas.ContractImproveResponse:
    """
    Eredeti szerződés szövege alapján készít egy javított, kiegyensúlyozottabb verziót.
    Nem írja át a szerződés lényegét, csak pontosít, kiegyensúlyoz és jogilag tisztábbá tesz.
    """

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
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.3,
    )

    improved_text = resp.choices[0].message.content or ""

    return schemas.ContractImproveResponse(
        improved_text=improved_text.strip(),
        summary_hu=None,
    )
