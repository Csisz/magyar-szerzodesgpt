import time
import json

import time
from app.utils.template_loader import load_contract_template
from app.services.party_normalizer import normalize_parties_cached
from app.services.prompt_builder import build_contract_prompt
from app.services.openai_service import call_openai
from app.utils.template_loader import fill_template_with_placeholders
from app.utils.template_loader import extract_placeholders

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

    # 🔧 MODE NORMALIZÁLÁS (KRITIKUS)
    raw_mode = mode
    mode = getattr(mode, "value", mode)   # Enum esetén
    mode = str(mode).strip().lower()      # " FAST " → "fast"
    if "." in mode:
        mode = mode.split(".")[-1]        # "GenerationMode.fast" → "fast"

    print("🧪 MODE DEBUG:", raw_mode, "→", mode, type(raw_mode))

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

        
        print("🔥 FAST MODE ENTERED 0.0")

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

        print("🔥 FAST MODE ENTERED 0.1")

        # # Felek normalizálása (cache-elt, FAST-safe)
        # if form_data.get("PARTIES"):
        #     normalized = normalize_parties_cached(form_data["PARTIES"])
        #     form_data = {**form_data, **normalized}
        # ✅ FAST MODE: PARTIES CSAK NYERS SZÖVEG
        if "PARTIES" in form_data and not isinstance(form_data["PARTIES"], dict):
            form_data["PARTIES_TEXT"] = form_data["PARTIES"]


        print("🔥 FAST MODE ENTERED 0.2")
        # Kötelező placeholder kulcsok biztosítása
        for key in REQUIRED_PLACEHOLDERS:
            form_data.setdefault(key, "")

       
        print("🔥 FAST MODE ENTERED 0.3")

        # ⚡ FAST PARTIES PARSER (egyszerű, determinisztikus)
        parties_text = form_data.get("PARTIES", "")

        if parties_text:
            # nagyon egyszerű szabályok
            # "Megbízó X Megbízott: Y"
            try:
                lower = parties_text.lower()

                if "megbízó" in lower:
                    client_part = parties_text.split("Megbízó", 1)[1]
                    client_name = client_part.split("Megbízott")[0].strip(" :\n")
                    form_data["CLIENT_NAME"] = client_name

                if "megbízott" in lower:
                    contractor_name = parties_text.split("Megbízott", 1)[1].strip(" :\n")
                    form_data["CONTRACTOR_NAME"] = contractor_name

            except Exception:
                pass


        # 🔁 FRONTEND → TEMPLATE PLACEHOLDER MAP (FAST MODE – FIX)
        FIELD_ALIAS_MAP = {
            # szerződés tárgya
            "SUBJECT": "SUBJECT",
            "contractSubject": "SUBJECT",

            # díjazás
            "PAYMENT": "FEE",
            "fee": "FEE",
            "FEE": "FEE",

            # dátum / hely
            "DATE": "DATE",
            "PLACE": "PLACE",

            # időtartam
            "DURATION": "TERM_TYPE",
            "TERM_TYPE": "TERM_TYPE",

            # speciális kikötések
            "SPECIAL_TERMS": "CONF_TERM",

            # felek (szöveges)
            "PARTIES": "PARTIES_TEXT",
            "PARTIES_TEXT": "PARTIES_TEXT",
        }


        normalized_form_data = {}

        for key, value in form_data.items():
            mapped_key = FIELD_ALIAS_MAP.get(key)
            if mapped_key:
                normalized_form_data[mapped_key] = value

        # fallback: ami nem volt mappelve, menjen át
        for key, value in form_data.items():
            normalized_form_data.setdefault(key, value)

        form_data = normalized_form_data

        template_html = load_contract_template(contract_type, "fast")
        print("📄 TEMPLATE LENGTH:", len(template_html))

        placeholders = extract_placeholders(template_html)
        print("🧩 PLACEHOLDERS FOUND:", placeholders)


        print("📥 FORM DATA:", form_data)

        # ⚡ FAST DIRECT MAPPING – TEMPLATE KULCSOK ALAPJÁN
        mapped_values = {}

        for placeholder in placeholders:
            key = placeholder.lower()

            for form_key, value in form_data.items():
                if key in form_key.lower():
                    mapped_values[placeholder] = value
                    break
            else:
                mapped_values[placeholder] = ""


        print("🤖 MAPPED VALUES:", mapped_values)

        contract_html = fill_template_with_placeholders(
            template_html,
            mapped_values,
        )

        
        print("📄 FINAL HTML LENGTH:", len(contract_html))


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
def generate_placeholder_mapping_fast(
    placeholders: list[str],
    form_data: dict,
) -> dict:
    """
    FAST MODE placeholder kitöltés.
    Minden placeholder pontosan a vele azonos nevű form_data kulcsból kap értéket.
    Ha nincs adat → üres string.
    """

    result = {}

    for placeholder in placeholders:
        value = form_data.get(placeholder)

        # None → ""
        if value is None:
            value = ""

        # nem string értékek védelme
        if not isinstance(value, str):
            value = str(value)

        result[placeholder] = value.strip()

    return result



# def generate_placeholder_mapping_fast(
#     placeholders: list[str],
#     form_data: dict,
#     model: str = "gpt-4o-mini",
# ) -> dict:
#     """
#     Gyors AI-mapping: megmondja, melyik form adat melyik placeholderbe kerüljön.
#     Nem generál szerződést!
#     """

#     if not placeholders:
#         return {}

#     prompt = f"""
# You are mapping user input values into placeholders of a Hungarian contract template.

# Placeholders:
# {placeholders}

# User input values (raw, may be informal):
# {form_data}

# Rules:
# - Return ONLY valid JSON
# - Keys must be placeholders from the list
# - Values should be short, clear Hungarian text
# - If unsure, keep the original user input
# - Do NOT invent new legal content
# """

#     try:
#         response = call_openai(
#         model=model,
#         system_prompt="You are a JSON-only field mapping assistant.",
#         user_prompt=prompt,
#         max_tokens=300,
#         temperature=0.2,
#     )


#         raw = response.get("content", "")
#         return json.loads(raw)

#     except Exception:
#         # INTELLIGENS FAST FALLBACK: név szerinti párosítás
#         result = {}

#         for placeholder in placeholders:
#             placeholder_l = placeholder.lower()
#             value_found = ""

#             for form_key, value in form_data.items():
#                 if placeholder_l in form_key.lower():
#                     value_found = value
#                     break

#             result[placeholder] = value_found

#         return result


# 🔁 BACKWARD COMPATIBILITY – A ROUTE EZT HÍVJA
generate_contract_from_template = generate_contract