def build_contract_prompt(
    template_html: str,
    form_data: dict,
    mode: str,
) -> str:

    if mode == "fast":
        mode_instruction = """
FAST MÓD:
- Csak töltsd ki a sablont
- Ne adj hozzá új bekezdést
- Ne magyarázz
- Ne bővíts
- Rövid, tömör jogi megfogalmazás
"""
    else:
        mode_instruction = """
DETAILED MÓD:
- Jogilag részletesebb megfogalmazás
- Pontosabb definíciók
- Teljesebb klauzulák
"""

    return f"""
{mode_instruction}

SZABÁLYOK:
- A HTML struktúrát NE változtasd meg
- Csak a {{PLACEHOLDER}} mezőket töltsd ki
- Hiányzó adat esetén hagyd: __________

HTML SABLON:
{template_html}

ADATOK:
{form_data}
"""
