import time
import json

from app.utils.template_loader import (
    load_contract_template,
    fill_template_with_placeholders,
)
from app.services.prompt_builder import build_contract_prompt
from app.services.openai_service import call_openai
from app.services.party_normalizer import normalize_parties_cached

def generate_contract(
    contract_type: str,
    mode: str,
    form_data: dict,
):
    """
    Szerződés generálása FAST vagy DETAILED módban.
    """

    start_time = time.perf_counter()

    # =========================
    # FAST MODE – placeholder-only
    # =========================
    if mode == "fast":
        model = "gpt-4o-mini"
        max_tokens = 800
        temperature = 0.1

        if form_data.get("PARTIES"):
            normalized = normalize_parties_cached(form_data["PARTIES"])
            form_data = {
                **form_data,
                **normalized,
            }

        # 1️⃣ Template betöltése (cache-elt)
        template_html = load_contract_template(contract_type, "fast")

        # 2️⃣ Placeholder értékek generálása AI-val
        placeholder_values = generate_placeholders_fast(form_data)

        # 3️⃣ Lokális behelyettesítés
        filled_contract = fill_template_with_placeholders(
            template_html,
            placeholder_values,
        )

        duration = round(time.perf_counter() - start_time, 2)

        return {
            "contract_html": filled_contract,
            "summary_hu": "Gyors módú szerződéstervezet generálva.",
            "telemetry": {
                "mode": "fast",
                "model": model,
                "generation_time_sec": duration,
                "max_tokens": max_tokens,
                "pipeline": "placeholder-only",
            },
        }

    # =========================
    # DETAILED MODE – full legal reasoning
    # =========================
    else:
        model = "gpt-4o"
        max_tokens = 3500
        temperature = 0.3

        system_prompt = (
            "Te egy magyar jogra specializált ügyvéd vagy, "
            "aki szerződéstervezeteket készít és felülvizsgál. "
            "Vizsgáld át a teljes szerződésszöveget, és jogilag pontos, "
            "kiegyensúlyozott, részletes megfogalmazást alkalmazz "
            "a magyar jog (különösen a Ptk.) alapján. "
            "A szerződés szerkezetét tartsd meg, de a szöveget "
            "indokolt esetben pontosíthatod vagy finoman bővítheted."
        )

        # 1️⃣ Template betöltés
        template_html = load_contract_template(contract_type, "detailed")

        # 2️⃣ Prompt felépítése (EZ HIÁNYZOTT KORÁBBAN)
        prompt = build_contract_prompt(
            template_html=template_html,
            form_data=form_data,
            mode="detailed",
        )

        # 3️⃣ OpenAI hívás
        response = call_openai(
            model=model,
            system_prompt=system_prompt,
            user_prompt=prompt,
            temperature=temperature,
            max_tokens=max_tokens,
        )

        duration = round(time.perf_counter() - start_time, 2)

        return {
            "contract_html": response["content"],
            "summary_hu": "Részletes szerződéstervezet generálva.",
            "telemetry": {
                "mode": "detailed",
                "model": model,
                "generation_time_sec": duration,
                "max_tokens": max_tokens,
            },
        }


def generate_placeholders_fast(form_data: dict) -> dict:
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

    try:
        return json.loads(response["content"])
    except json.JSONDecodeError as e:
        raise ValueError(
            f"FAST placeholder generálás nem adott vissza érvényes JSON-t: {e}"
        )
