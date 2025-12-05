from io import BytesIO
from typing import Dict, Tuple

from bs4 import BeautifulSoup
from docx import Document
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from .document_renderer import render_contract_html


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
    MVP PDF generálás: sima szöveg A4 lapra tördelve.
    Nem gyönyörű, de működő PDF-et ad.
    """
    text = _html_to_plain_text(html)

    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    x = 40
    y = height - 40
    line_height = 14
    max_chars_per_line = 95

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            y -= line_height
            continue

        while line:
            # egyszerű tördelés karakter szám alapján
            chunk = line[:max_chars_per_line]
            line = line[max_chars_per_line:]

            if y < 50:
                c.showPage()
                y = height - 40

            c.drawString(x, y, chunk)
            y -= line_height

    c.showPage()
    c.save()
    return buffer.getvalue()


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
