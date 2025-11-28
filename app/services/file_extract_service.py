from typing import IO
from pypdf import PdfReader
from docx import Document

def extract_text_from_pdf(file_obj: IO) -> str:
    reader = PdfReader(file_obj)
    texts = []
    for page in reader.pages:
        texts.append(page.extract_text() or "")
    return "\n\n".join(texts)

def extract_text_from_docx(file_obj: IO) -> str:
    doc = Document(file_obj)
    return "\n".join(p.text for p in doc.paragraphs)

def extract_text_from_txt(file_obj: IO) -> str:
    data = file_obj.read()
    if isinstance(data, bytes):
        return data.decode("utf-8", errors="ignore")
    return str(data)
