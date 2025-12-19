import time
import json

import time
from app.utils.template_loader import load_contract_template
from app.services.party_normalizer import normalize_parties_cached
from app.services.prompt_builder import build_contract_prompt
from app.services.openai_service import call_openai
from app.utils.template_loader import fill_template_with_placeholders

print("🔥 LOADED contract_generator.py FROM:", __file__)

def generate_contract(
    contract_type: str,
    mode: str,
    form_data: dict,
):
    """
    Szerződés generálása FAST vagy DETAILED módban.
    VISSZATÉRÉS: dict
    {
        contract_html: str,
        summary_hu: str,
        telemetry: dict
    }
    """

    start_time = time.perf_counter()

    # 🔒 DEFENZÍV DEFAULTOK – SOHA NEM LEHET NONE
    contract_html = ""
    summary_hu = ""
    telemetry = {}

    # ==================================================
    # ⚡ FAST MODE – sablon + placeholder kitöltés
    # ==================================================
    if mode == "fast":
        model = "gpt-4o-mini"
        max_tokens = 800
        temperature = 0.1

        REQUIRED_PLACEHOLDERS = [
            "CLIENT_NAME",
            "CLIENT_ADDRESS",
            "CLIENT_REGNO",
            "CLIENT_TAXNO",
            "CLIENT_REP",
            "CONTRACTOR_NAME",
            "CONTRACTOR_ADDRESS",
            "CONTRACTOR_REGNO",
            "CONTRACTOR_TAXNO",
        ]

        # 1️⃣ Felek normalizálása (cache-elt, FAST-safe)
        if form_data.get("PARTIES"):
            normalized = normalize_parties_cached(form_data["PARTIES"])
            form_data = {**form_data, **normalized}

        # 2️⃣ Kötelező placeholder kulcsok biztosítása
        for key in REQUIRED_PLACEHOLDERS:
            form_data.setdefault(key, "")

        # 3️⃣ Template betöltése
        template_html = load_contract_template(contract_type, "fast")

        # 4️⃣ Placeholder értékek generálása
        placeholder_values = generate_placeholders_fast(form_data)

        # 5️⃣ Lokális behelyettesítés (NINCS AI itt)
        contract_html = fill_template_with_placeholders(
            template_html,
            placeholder_values,
        )

        duration = round(time.perf_counter() - start_time, 2)

        telemetry = {
            "mode": "fast",
            "model": model,
            "duration_sec": duration,
            "max_tokens": max_tokens,
        }

        return {
            "contract_html": contract_html,
            "summary_hu": "Gyors módú szerződéstervezet generálva.",
            "telemetry": telemetry,
        }

    # ==================================================
    # 🧠 DETAILED MODE – teljes AI generálás
    # ==================================================
    else:
        model = "gpt-4o"
        max_tokens = 3500
        temperature = 0.3

        # 1️⃣ Template betöltése
        template_html = load_contract_template(contract_type, "detailed")

        # 2️⃣ Prompt építése
        prompt = build_contract_prompt(
            template_html=template_html,
            form_data=form_data,
            mode=mode,
        )

        # 3️⃣ OpenAI hívás
        response = call_openai(
            model=model,
            system_prompt=(
                "Te egy magyar jogra specializált szerződésgenerátor vagy. "
                "Feladatod egy részletes, kiegyensúlyozott, magyar jog szerint "
                "strukturált szerződéstervezet elkészítése."
            ),
            user_prompt=prompt,
            temperature=temperature,
            max_tokens=max_tokens,
        )

        contract_html = response.get("content", "")

        duration = round(time.perf_counter() - start_time, 2)

        telemetry = {
            "mode": "detailed",
            "model": model,
            "duration_sec": duration,
            "max_tokens": max_tokens,
        }

        return {
            "contract_html": contract_html,
            "summary_hu": "Részletes szerződéstervezet generálva.",
            "telemetry": telemetry,
        }



def generate_placeholders_fast(form_data: dict) -> dict:

    print("🔥 generate_placeholders_fast() CALLED")

    """
    FAST mód: kizárólag a placeholder értékeket generálja ki JSON-ben.
    """

    prompt = f"""
        SZIGORÚ FAST MÓD.

        KIZÁRÓLAG érvényes JSON objektumot adhatsz vissza.
        NEM adhatsz magyarázatot.
        NEM használhatsz markdownot.
        NEM adhatsz hozzá új mezőket.

        A kulcsok pontosan ezek legyenek:
        {list(form_data.keys())}

        Feladat:
        Töltsd ki a fenti mezőket rövid, jogilag korrekt magyar szöveggel.

        BEMENETI ADATOK:
        {form_data}
        """

    response = call_openai(
        model="gpt-4o-mini",
        system_prompt=(
            "Te egy magyar jogra specializált szerződéskitöltő asszisztens vagy. "
            "Feladatod kizárólag előre megadott helykitöltők rövid, "
            "jogilag korrekt magyar szöveggel való kitöltése."
        ),
        user_prompt=prompt,
        temperature=0.1,
        max_tokens=800,
    )

    raw = response.get("content", "")

    # ✅ FAST FALLBACK – SOHA NE DOBJON 400-AT
    if not raw or not raw.strip():
        # visszatérés a meglévő form adatokkal
        return {k: form_data.get(k, "") for k in form_data.keys()}

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # ha nem JSON, szintén fallback
        print("🔥 FAST FALLBACK EXECUTED")

        return {k: form_data.get(k, "") for k in form_data.keys()}




