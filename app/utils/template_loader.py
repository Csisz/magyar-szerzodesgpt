import re
from pathlib import Path

BASE_TEMPLATE_PATH = Path(__file__).resolve().parent.parent / "templates" / "contracts"

def load_contract_template(contract_type: str, mode: str) -> str:
    """
    contract_type: 'megbizasi', 'nda'
    mode: 'fast' | 'detailed'
    """
    filename = f"{contract_type}_{mode}.html"
    template_path = BASE_TEMPLATE_PATH / filename

    if not template_path.exists():
        raise FileNotFoundError(f"Template nem található: {filename}")

    return template_path.read_text(encoding="utf-8")

def fill_template_with_placeholders(template_html: str, values: dict) -> str:
    """
    Lokálisan behelyettesíti a {{PLACEHOLDER}} mezőket.
    Ha nincs érték → üres kitöltő vonalat tesz be.
    """
    result = template_html

    for key in values:
        placeholder = f"{{{{{key}}}}}"
        value = values.get(key)

        if value is None or str(value).strip() == "":
            value = "__________________________"

        result = result.replace(placeholder, str(value))

    return result

PLACEHOLDER_PATTERN = re.compile(r"\{\{([A-Z0-9_]+)\}\}")

def extract_placeholders(template_html: str) -> list[str]:
    """
    Kinyeri a {{PLACEHOLDER}} formátumú változókat a template-ből.
    """
    return list(set(PLACEHOLDER_PATTERN.findall(template_html)))


