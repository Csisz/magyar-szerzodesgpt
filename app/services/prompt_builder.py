def build_contract_prompt(
    template_html: str,
    form_data: dict,
    mode: str,
) -> str:
    mode_instruction = (
        "Tömör, lényegre törő megfogalmazást használj."
        if mode == "fast"
        else
        "Részletes, jogilag körültekintő megfogalmazást használj."
    )

    return f"""
{mode_instruction}

Feladat:
Az alábbi magyar jog szerinti szerződés sablont töltsd ki a megadott adatokkal.

SZABÁLYOK:
- A HTML struktúrát NE változtasd meg
- Csak a {{PLACEHOLDER}} mezőket töltsd ki
- Ha egy adat hiányzik, hagyd üresen (__________)
- Ne adj hozzá új fejezeteket

SABLON:
{template_html}

ADATOK:
{form_data}
"""
