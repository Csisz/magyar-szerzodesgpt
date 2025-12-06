from io import BytesIO
from typing import Dict, Tuple

from bs4 import BeautifulSoup
from docx import Document
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from .document_renderer import render_contract_html

import os

from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont


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
    Unicode (magyar ékezetes) szövegre is felkészítve DejaVuSans fonttal.
    """
    # HTML → plain text
    text = _html_to_plain_text(html)

    buffer = BytesIO()

    # ---- Unicode font regisztrálása (DejaVuSans) ----
    font_name = "DejaVuSans"
    # export_service.py mappájához képest: ./fonts/DejaVuSans.ttf
    font_path = os.path.join(os.path.dirname(__file__), "fonts", "DejaVuSans.ttf")

    # Font regisztrálása, ha még nincs
    try:
        pdfmetrics.getFont(font_name)
    except KeyError:
        pdfmetrics.registerFont(TTFont(font_name, font_path))
    # -------------------------------------------------

    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    # Használjuk az új fontot (méret tetszőleges, pl. 11 pt)
    c.setFont(font_name, 11)

    x_margin = 40
    y_margin = 40
    max_width = width - 2 * x_margin
    y = height - y_margin

    def wrap_line(line: str) -> list[str]:
        """
        Nagyon egyszerű szövegtördelés: addig növeljük a stringet,
        amíg a jelenlegi fonttal mért szélesség belefér a max_width-be.
        """
        if not line:
            return [""]

        words = line.split(" ")
        lines: list[str] = []
        current = ""

        for word in words:
            candidate = (current + " " + word).strip()
            w = pdfmetrics.stringWidth(candidate, font_name, 11)
            if w <= max_width:
                current = candidate
            else:
                if current:
                    lines.append(current)
                current = word

        if current:
            lines.append(current)
        return lines

    # Soronként kiírás, egyszerű lapozással
    for raw_line in text.splitlines():
        for line in wrap_line(raw_line):
            if y < y_margin:
                c.showPage()
                c.setFont(font_name, 11)
                y = height - y_margin

            c.drawString(x_margin, y, line)
            y -= 14  # sortávolság

    c.showPage()
    c.save()
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
