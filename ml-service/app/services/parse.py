"""Extract text from PDF and DOCX resumes. Never executes file contents.

OCR is not implemented. Image-only and scanned PDFs are rejected with that
limitation stated in the error. Resume text is not written to logs.
"""

from __future__ import annotations

import zipfile
from io import BytesIO
from pathlib import Path

import pdfplumber

ALLOWED_EXTENSIONS = {".pdf", ".docx"}
ALLOWED_MIME = {
    ".pdf": {
        "application/pdf",
        "application/octet-stream",
        "binary/octet-stream",
        "",
    },
    ".docx": {
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/octet-stream",
        "application/zip",
        "binary/octet-stream",
        "",
    },
}

MAX_PDF_PAGES = 30
MAX_DOCX_UNCOMPRESSED = 20 * 1024 * 1024
MAX_EXTRACTED_CHARS = 200_000
MIN_WORDS = 15


def sanitize_filename(name: str) -> str:
    base = Path(name or "resume").name
    cleaned = "".join(ch if ch.isalnum() or ch in "._ -" else "" for ch in base).strip().replace(" ", "_")
    if not cleaned or cleaned.startswith("."):
        cleaned = "resume"
    return cleaned[:120]


def extension_of(filename: str) -> str:
    return Path(filename or "").suffix.lower()


def validate_upload(filename: str, content_type: str | None, size: int, max_bytes: int) -> str:
    safe_name = sanitize_filename(filename)
    ext = extension_of(safe_name)
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError("Invalid resume format. Upload a PDF or DOCX file.")
    mime = (content_type or "").split(";")[0].strip().lower()
    if mime not in ALLOWED_MIME[ext]:
        raise ValueError("Invalid resume format. Upload a PDF or DOCX file.")
    if size <= 0:
        raise ValueError("The uploaded file is empty.")
    if size > max_bytes:
        mb = max(1, max_bytes // (1024 * 1024))
        raise ValueError(f"File is too large. Maximum size is {mb} MB.")
    return safe_name


def assert_signature(data: bytes, ext: str) -> None:
    if ext == ".pdf" and not data.startswith(b"%PDF"):
        raise ValueError("This file is corrupted or is not a valid PDF.")
    if ext == ".docx" and not data.startswith(b"PK"):
        raise ValueError("This file is corrupted or is not a valid DOCX.")


def extract_text(
    data: bytes,
    filename: str,
    *,
    max_pdf_pages: int = MAX_PDF_PAGES,
    max_docx_uncompressed: int = MAX_DOCX_UNCOMPRESSED,
    max_chars: int = MAX_EXTRACTED_CHARS,
) -> str:
    ext = extension_of(filename)
    assert_signature(data, ext)
    try:
        if ext == ".pdf":
            text = _pdf_text(data, max_pdf_pages)
        elif ext == ".docx":
            text = _docx_text(data, max_docx_uncompressed)
        else:
            raise ValueError("Invalid resume format. Upload a PDF or DOCX file.")
    except ValueError:
        raise
    except Exception as exc:
        raise _read_error(exc) from exc
    if len(text) > max_chars:
        raise ValueError("This file has too much text to analyze.")
    if len(text.split()) < MIN_WORDS:
        raise ValueError("This file does not contain enough readable text to analyze.")
    return text


def _read_error(exc: Exception) -> ValueError:
    message = f"{type(exc).__name__} {exc}".lower()
    if any(token in message for token in ("encrypt", "password", "decrypt")):
        return ValueError("This PDF is password-protected. Upload an unlocked text-based PDF or DOCX.")
    if "badzip" in message or "zip" in message or "not a zip" in message:
        return ValueError("This file is corrupted or is not a valid DOCX.")
    return ValueError("This file is corrupted or could not be read. Upload a text-based PDF or DOCX.")


def _pdf_text(data: bytes, max_pages: int) -> str:
    chunks = []
    image_count = 0
    try:
        with pdfplumber.open(BytesIO(data)) as pdf:
            page_count = len(pdf.pages)
            if page_count > max_pages:
                raise ValueError(f"This PDF has too many pages. Maximum is {max_pages}.")
            if page_count == 0:
                raise ValueError("This PDF has no pages.")
            for page in pdf.pages:
                try:
                    image_count += len(getattr(page, "images", None) or [])
                except Exception:
                    image_count += 0
                extracted = page.extract_text() or ""
                if extracted.strip():
                    chunks.append(extracted.strip())
    except ValueError:
        raise
    except Exception as exc:
        raise _read_error(exc) from exc
    text = "\n".join(chunks).strip()
    if len(text.split()) < MIN_WORDS and image_count:
        raise ValueError(
            "This PDF looks like a scan or image-only file. Upload a text-based PDF or DOCX. OCR is not supported."
        )
    return text


def _assert_docx_size(data: bytes, max_uncompressed: int) -> None:
    try:
        archive = zipfile.ZipFile(BytesIO(data))
    except zipfile.BadZipFile as exc:
        raise ValueError("This file is corrupted or is not a valid DOCX.") from exc
    total = 0
    with archive:
        for info in archive.infolist():
            total += max(0, info.file_size)
            if info.file_size > max_uncompressed or total > max_uncompressed:
                raise ValueError("This DOCX is too large to process.")


def _docx_text(data: bytes, max_uncompressed: int) -> str:
    _assert_docx_size(data, max_uncompressed)
    from docx import Document
    from docx.oxml.ns import qn
    from docx.table import Table
    from docx.text.paragraph import Paragraph

    try:
        document = Document(BytesIO(data))
    except Exception as exc:
        raise _read_error(exc) from exc

    seen_cells: set[int] = set()

    def walk(element, parent, sink: list[str]) -> None:
        for child in element.iterchildren():
            if child.tag == qn("w:p"):
                text = Paragraph(child, parent).text.strip()
                if text:
                    sink.append(text)
            elif child.tag == qn("w:tbl"):
                read_table(Table(child, parent), sink)

    def read_table(table: Table, sink: list[str]) -> None:
        for row in table.rows:
            for cell in row.cells:
                marker = id(cell._tc)
                if marker in seen_cells:
                    continue
                seen_cells.add(marker)
                before = len(sink)
                walk(cell._tc, cell, sink)
                if len(sink) == before:
                    text = cell.text.strip()
                    if text:
                        sink.append(text)

    body: list[str] = []
    walk(document.element.body, document, body)

    headers: list[str] = []
    footers: list[str] = []
    seen = {line.lower() for line in body}

    def take(part, sink: list[str]) -> None:
        if part is None:
            return
        lines: list[str] = []
        try:
            walk(part._element, part, lines)
        except Exception:
            return
        for line in lines:
            key = line.lower()
            if key in seen:
                continue
            seen.add(key)
            sink.append(line)

    for section in document.sections:
        take(section.header, headers)
        take(section.footer, footers)

    # Header text that is not already in the body comes first. Body order is
    # preserved. Merged cells are visited once via their XML element id.
    return "\n".join(headers + body + footers).strip()
