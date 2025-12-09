from io import BytesIO
from typing import Dict, Tuple

from bs4 import BeautifulSoup
from docx import Document
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from .document_renderer import render_contract_html

import os

from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics

def _html_to_plain_text(html: str) -> str:
    """
    Egyszerű HTML -> sima szöveg átalakítás (MVP).
    Később lehet okosabb, struktúráltabb megoldás.
    """
    soup = BeautifulSoup(html, "html.parser")
    # sortörés blokkok között
    return soup.get_text("\n")


def generate_docx_from_html(html: str) -> bytes:
    """
    Nagyon egyszerű: sima szöveget tesz a DOCX-be.
    (MVP: formázás nélkül, csak tartalom)
    """
    text = _html_to_plain_text(html)
    doc = Document()

    for line in text.splitlines():
        if line.strip():
            doc.add_paragraph(line.strip())

    buffer = BytesIO()
    doc.save(buffer)
    return buffer.getvalue()


def generate_pdf_from_html(html: str) -> bytes:
    """
    Unicode-képes PDF generálás Platypus-szal.
    Kezeli az összes magyar ékezetet (ő / ű is).
    """
    text = _html_to_plain_text(html)

    buffer = BytesIO()

    # PDF dokumentum
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
    )

    # ---- Unicode TTF font regisztrálása ----
    font_path = os.path.join(os.path.dirname(__file__), "fonts", "DejaVuSans.ttf")
    pdfmetrics.registerFont(TTFont("DejaVuSans", font_path))

    styles = getSampleStyleSheet()
    normal_style = ParagraphStyle(
        "normal",
        parent=styles["Normal"],
        fontName="DejaVuSans",
        fontSize=11,
        leading=14,
    )

    story = []

    # Soronként beépítjük a platypusba
    for line in text.split("\n"):
        if line.strip():
            story.append(Paragraph(line, normal_style))
        else:
            story.append(Spacer(1, 6))

    # PDF összeállítása
    doc.build(story)

    pdf = buffer.getvalue()
    buffer.close()
    return pdf




def create_export_file(
    template_name: str,
    template_vars: Dict,
    layout_vars: Dict,
    output_format: str,
) -> Tuple[str, bytes, str]:
    """
    Visszaadja: (fájlnév, bináris tartalom, MIME type)
    """

    html = render_contract_html(template_name, template_vars, layout_vars)

    base_title = layout_vars.get("document_title", "szerzodes").replace(" ", "_")

    if output_format == "docx":
        content = generate_docx_from_html(html)
        filename = f"{base_title}.docx"
        mime_type = (
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
        return filename, content, mime_type

    if output_format == "pdf":
        content = generate_pdf_from_html(html)
        filename = f"{base_title}.pdf"
        mime_type = "application/pdf"
        return filename, content, mime_type

    raise ValueError(f"Nem támogatott export formátum: {output_format}")
