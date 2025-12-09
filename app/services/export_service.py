import os
from io import BytesIO
from typing import Dict, Tuple

from bs4 import BeautifulSoup

from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics

import os
print(">>> LOADED export_service.py FROM:", os.path.abspath(__file__))



# ---------------------------------------------------------
# Segédfüggvény: HTML → egyszerű szöveg
# ---------------------------------------------------------

def _html_to_plain_text(html: str) -> str:
    """
    HTML-ből egyszerű szöveg előállítása. A <br> és <p> tageket sortörésre alakítjuk.
    """
    soup = BeautifulSoup(html, "html.parser")

    # br → \n
    for br in soup.find_all("br"):
        br.replace_with("\n")

    # p tagek között legyen sortörés
    text_blocks = []
    for p in soup.find_all("p"):
        text_blocks.append(p.get_text(strip=True))
    if text_blocks:
        return "\n\n".join(text_blocks)

    # fallback: teljes szöveg
    return soup.get_text("\n", strip=True)


# ---------------------------------------------------------
# PDF generálása Unicode támogatással (ő/ű OK)
# ---------------------------------------------------------

def generate_pdf_from_html(html: str) -> bytes:
    """
    Unicode-képes PDF generálás ReportLab + Platypus segítségével.
    Minden magyar ékezet (ő / ű) támogatott.
    """

    text = _html_to_plain_text(html)
    buffer = BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
    )

    # DejaVuSans.ttf → az egyetlen 100%-osan Unicode-képes font ReportLabhoz
    font_path = os.path.join(os.path.dirname(__file__), "fonts", "DejaVuSans.ttf")
    pdfmetrics.registerFont(TTFont("DejaVuSans", font_path))

    styles = getSampleStyleSheet()
    style = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontName="DejaVuSans",
        fontSize=11,
        leading=14,
    )

    story = []

    for line in text.split("\n"):
        if line.strip():
            story.append(Paragraph(line, style))
        else:
            story.append(Spacer(1, 6))

    doc.build(story)

    pdf_data = buffer.getvalue()
    buffer.close()

    return pdf_data


# ---------------------------------------------------------
# DOCX export (ha szükséges)
# ---------------------------------------------------------

from docx import Document

def generate_docx_from_html(html: str) -> bytes:
    """
    Nagyon egyszerű DOCX generálás HTML-ből.
    (Nincs styling, de Unicode kompatibilis.)
    """

    text = _html_to_plain_text(html)
    document = Document()

    for line in text.split("\n"):
        document.add_paragraph(line)

    buffer = BytesIO()
    document.save(buffer)
    return buffer.getvalue()


# ---------------------------------------------------------
# Export gyártó főfüggvény
# ---------------------------------------------------------

def create_export_file(
    template_name: str,
    template_vars: Dict,
    format: str,
    meta: Dict,
) -> Tuple[str, bytes, str]:
    """
    A végső exportot előállító függvény.
    Visszaadja:
        - a fájl nevét
        - a tartalmat bytes formában
        - a MIME típust
    """

    html = template_vars.get("contract_text", "")

    if format == "pdf":
        content = generate_pdf_from_html(html)
        return "contract.pdf", content, "application/pdf"

    elif format == "docx":
        content = generate_docx_from_html(html)
        return "contract.docx", content, (
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )

    else:
        raise ValueError(f"Ismeretlen export formátum: {format}")
