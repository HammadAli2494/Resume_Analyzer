"""ATS analysis pipeline + trained supervised ML model."""

from __future__ import annotations

import re
from typing import Any

import nltk
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from .ml_core import run_ml_prediction
from .semantic_matcher import semantic_similarity_score
from .skills import find_skills_in_text
from .explainability import top_matching_terms
from .spacy_extractor import extract_entities, extract_skills

_nltk_ready = False


def _ensure_nltk():
    global _nltk_ready
    if _nltk_ready:
        return
    for resource in ("punkt", "punkt_tab", "stopwords"):
        try:
            if resource == "stopwords":
                nltk.data.find("corpora/stopwords")
            else:
                nltk.data.find(f"tokenizers/{resource}")
        except LookupError:
            nltk.download(resource, quiet=True)
    _nltk_ready = True


def preprocess_text(text: str) -> str:
    _ensure_nltk()
    from nltk.corpus import stopwords
    from nltk.tokenize import word_tokenize

    text = text.lower()
    text = re.sub(r"[^a-z0-9+#.\s/-]", " ", text)
    tokens = word_tokenize(text)
    stops = set(stopwords.words("english"))
    return " ".join(t for t in tokens if t not in stops and len(t) > 1)


def _composite_score(keyword: float, semantic: float, skill_coverage: float, ml_prob: float | None) -> int:
    if ml_prob is not None:
        return round(0.35 * ml_prob + 0.25 * keyword + 0.25 * semantic + 0.15 * skill_coverage)
    return round(0.45 * keyword + 0.35 * semantic + 0.20 * skill_coverage)


def analyze_resume(resume_text: str, job_description: str) -> dict[str, Any]:
    if not resume_text.strip():
        raise ValueError("Could not extract text from the file.")
    if not job_description.strip():
        raise ValueError("Job description is required.")

    resume_clean = preprocess_text(resume_text)
    jd_clean = preprocess_text(job_description)
    if not resume_clean.strip() or not jd_clean.strip():
        raise ValueError("Not enough text to analyze.")

    vectorizer = TfidfVectorizer(ngram_range=(1, 2), max_features=5000, sublinear_tf=True)
    try:
        matrix = vectorizer.fit_transform([resume_clean, jd_clean])
    except ValueError as exc:
        if "empty vocabulary" in str(exc).lower():
            raise ValueError("Not enough meaningful text after processing.") from exc
        raise

    keyword_sim = cosine_similarity(matrix[0:1], matrix[1:2])[0][0]
    keyword_score = round(float(keyword_sim) * 100, 1)
    semantic_data = semantic_similarity_score(resume_text, job_description)
    semantic_score = semantic_data["semantic_score"]

    resume_skills = extract_skills(resume_text)
    jd_skills = extract_skills(job_description)
    resume_lower = {s.lower() for s in resume_skills}
    matched_skills = [s for s in jd_skills if s.lower() in resume_lower]
    missing_skills = [s for s in jd_skills if s.lower() not in resume_lower]
    extra_skills = [s for s in resume_skills if s.lower() not in {j.lower() for j in jd_skills}]

    skill_coverage = (len(matched_skills) / len(jd_skills) * 100) if jd_skills else keyword_score

    ml_result = run_ml_prediction(resume_text, job_description) or {}
    ml_prob = ml_result.get("ml_match_probability")

    if ml_prob is not None:
        match_percentage = round(0.4 * ml_prob + 0.3 * keyword_score + 0.3 * semantic_score, 1)
    else:
        match_percentage = round(0.5 * keyword_score + 0.5 * semantic_score, 1)

    resume_score = _composite_score(keyword_score, semantic_score, skill_coverage, ml_prob)
    explain = top_matching_terms(resume_clean, jd_clean)
    entities = extract_entities(resume_text)
    suggestions = _build_suggestions(missing_skills, match_percentage)

    base = {
        "match_percentage": match_percentage,
        "keyword_score": keyword_score,
        "semantic_score": semantic_score,
        "semantic_method": semantic_data["semantic_method"],
        "resume_score": resume_score,
        "skill_coverage": round(skill_coverage, 1),
        "detected_skills": resume_skills,
        "job_required_skills": jd_skills,
        "matched_skills": matched_skills,
        "missing_skills": missing_skills,
        "extra_skills": extra_skills,
        "top_matching_terms": explain["top_matching_terms"],
        "top_missing_terms": explain["top_missing_terms"],
        "entities": entities,
        "suggestions": suggestions,
        "resume_preview": resume_text[:500] + ("..." if len(resume_text) > 500 else ""),
        "ml_available": ml_result.get("ml_available", False),
    }
    base.update(ml_result)

    try:
        from .llm_feedback import generate_llm_feedback
        base.update(generate_llm_feedback(resume_text, job_description, base))
    except Exception:
        base.setdefault("llm_available", False)
        base.setdefault("llm_feedback", suggestions)

    return base


def _build_suggestions(missing_skills: list[str], match_pct: float) -> list[str]:
    tips = []
    if missing_skills:
        tips.append(f"Highlight: {', '.join(missing_skills[:5])}.")
    if match_pct < 60:
        tips.append("Mirror job-description keywords in experience bullets.")
    elif match_pct < 80:
        tips.append("Strong base — add metrics and role-specific tools.")
    else:
        tips.append("Strong match — quantify impact in each bullet.")
    return tips
