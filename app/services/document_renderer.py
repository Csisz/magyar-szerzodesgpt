from pathlib import Path
from typing import Any, Dict, Optional

from jinja2 import Environment, FileSystemLoader, select_autoescape

# templates könyvtár: app/templates
BASE_DIR = Path(__file__).resolve().parent.parent
TEMPLATES_DIR = BASE_DIR / "templates"

env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(["html", "xml"]),
)


def render_contract_html(
    template_name: str,
    template_vars: Dict[str, Any],
    layout_vars: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Összerakja a teljes HTML dokumentumot:
    - betölti a contracts/{template_name}.html sablont,
    - abba beleteszi a template_vars változókat,
    - majd a layout/base.html-be ágyazza contract_html néven.
    """

    layout_vars = layout_vars or {}
    template_vars = template_vars or {}

    # 1) szerződés törzs
    contract_template = env.get_template(f"contracts/{template_name}.html")
    contract_html = contract_template.render(**template_vars)

    # 2) master layout
    base_template = env.get_template("layout/base.html")

    context = {
        "document_title": layout_vars.get("document_title", "Szerződés"),
        "document_date": layout_vars.get("document_date", ""),
        "document_number": layout_vars.get("document_number", ""),
        "brand_name": layout_vars.get("brand_name", "Magyar SzerződésGPT"),
        "brand_subtitle": layout_vars.get(
            "brand_subtitle",
            "AI-alapú szerződésgenerálás (általános tájékoztatás)",
        ),
        "footer_text": layout_vars.get(
            "footer_text",
            "A dokumentum automatikusan generált, és nem minősül jogi tanácsadásnak.",
        ),
        "contract_html": contract_html,
    }

    full_html = base_template.render(**context)
    return full_html
