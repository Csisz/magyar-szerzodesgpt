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
