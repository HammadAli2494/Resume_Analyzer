from io import BytesIO

import pdfplumber


def extract_text_from_pdf(file_obj) -> str:
    if hasattr(file_obj, "seek"):
        file_obj.seek(0)
    data = file_obj.read()
    chunks = []
    with pdfplumber.open(BytesIO(data)) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                chunks.append(text)
    return "\n".join(chunks).strip()


def extract_text_from_docx(file_obj) -> str:
    from docx import Document

    if hasattr(file_obj, "seek"):
        file_obj.seek(0)
    doc = Document(file_obj)
    paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
    return "\n".join(paragraphs).strip()


def extract_text_from_upload(file_obj, filename: str) -> str:
    name = filename.lower()
    if name.endswith(".pdf"):
        return extract_text_from_pdf(file_obj)
    if name.endswith(".docx"):
        return extract_text_from_docx(file_obj)
    raise ValueError("Supported formats: PDF and DOCX.")
