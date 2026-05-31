from __future__ import annotations

from django.core.files.base import ContentFile

from .document_extractor import extract_text_from_upload
from .ml_matcher import analyze_resume


def screen_uploaded_file(file_obj, filename: str, job_description: str) -> dict:
    if hasattr(file_obj, "seek"):
        file_obj.seek(0)
    file_bytes = file_obj.read()
    if hasattr(file_obj, "seek"):
        file_obj.seek(0)

    from io import BytesIO

    resume_text = extract_text_from_upload(BytesIO(file_bytes), filename)
    result = analyze_resume(resume_text, job_description)
    result["candidate_name"] = _name_from_filename(filename)
    result["resume_filename"] = filename
    result["_file_bytes"] = file_bytes
    return result


def _name_from_filename(filename: str) -> str:
    base = filename.rsplit(".", 1)[0]
    return base.replace("_", " ").replace("-", " ").strip().title()
