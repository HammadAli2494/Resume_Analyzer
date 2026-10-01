"""Score one resume against one job.

The job match score blends keyword overlap, required-skill coverage, and an
uncalibrated classifier signal. Character n-gram overlap is reported separately
and is not treated as semantic similarity. Required skills use the shared alias list plus boundary matching.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Any

import nltk
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

_TRAINING = Path(__file__).resolve().parents[2] / "training"
if str(_TRAINING) not in sys.path:
    sys.path.insert(0, str(_TRAINING))

from predict import (  # noqa: E402
    get_cv_report,
    get_evaluation,
    get_metrics,
    get_model_card,
    incompatibility_reason,
    is_model_available,
    predict_match,
)
from skill_match import match_required_skills, vocabulary_labels  # noqa: E402

_FALLBACK_STOPS = {
    "a", "an", "the", "and", "or", "of", "to", "in", "for", "on", "with", "at",
    "by", "from", "as", "is", "are", "was", "were", "be", "been", "being", "it",
    "this", "that", "these", "those", "we", "you", "your", "our", "their",
    "they", "i", "he", "she", "his", "her", "not", "but", "if", "than", "then",
    "so", "into", "about", "over", "after", "before", "between", "out", "up",
    "can", "will", "just", "also", "using", "use", "used",
}

_nltk_ready = False
_nlp = None
_spacy_ok = None


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
    text = text.lower()
    text = re.sub(r"[^a-z0-9+#.\s/-]", " ", text)
    try:
        _ensure_nltk()
        from nltk.corpus import stopwords
        from nltk.tokenize import word_tokenize

        tokens = word_tokenize(text)
        stops = set(stopwords.words("english"))
    except Exception:
        tokens = re.findall(r"[a-z0-9+#./-]{2,}", text)
        stops = _FALLBACK_STOPS
    return " ".join(token for token in tokens if token not in stops and len(token) > 1)


def _load_spacy():
    global _nlp, _spacy_ok
    if _spacy_ok is not None:
        return _nlp
    try:
        import spacy

        _nlp = spacy.load("en_core_web_sm")
        _spacy_ok = True
    except Exception:
        _nlp = None
        _spacy_ok = False
    return _nlp


def extract_skills(text: str) -> list[str]:
    return vocabulary_labels(text)


def extract_entities(text: str) -> dict:
    nlp = _load_spacy()
    if not nlp:
        return {"organizations": [], "job_titles": []}
    doc = nlp(text[:100000])
    titles = re.findall(
        r"(?i)\b(?:senior|junior|lead)?\s*(?:software|data|machine learning)\s+(?:engineer|scientist)\b",
        text,
    )
    return {
        "organizations": sorted({ent.text for ent in doc.ents if ent.label_ == "ORG"})[:10],
        "job_titles": sorted(set(titles))[:8],
    }


_GENERIC_TERMS = {
    "required", "skills", "skill", "experience", "years", "year", "role", "work",
    "working", "ability", "including", "strong", "team", "plus", "using", "use",
    "uses", "used", "job", "candidate", "responsibilities", "requirements",
    "preferred", "must", "build", "deploy", "hiring", "hire",
}


def wording_overlap_score(resume_text: str, job_description: str) -> float:
    """Character n-gram overlap. This is lexical similarity, not semantic analysis."""
    vectorizer = TfidfVectorizer(
        analyzer="char_wb",
        ngram_range=(3, 5),
        max_features=8000,
        sublinear_tf=True,
    )
    matrix = vectorizer.fit_transform([resume_text, job_description])
    return round(float(cosine_similarity(matrix[0:1], matrix[1:2])[0][0]) * 100, 1)


def _prefer_phrases(terms: list[str]) -> list[str]:
    ordered = sorted(terms, key=lambda term: (-len(term.split()), -len(term)))
    kept = []
    covered = set()
    for term in ordered:
        words = term.lower().split()
        if len(words) == 1 and words[0] in covered:
            continue
        kept.append(term)
        covered.update(words)
    return kept


def _adjacent_phrases(text: str) -> list[str]:
    """Phrases whose words sit next to each other inside one sentence."""
    phrases = []
    for sentence in re.split(r"[.!?;,\n]+", text.lower()):
        raw = re.findall(r"[a-z0-9]+(?:[.+#/-][a-z0-9]+)*", sentence)
        index = 0
        while index < len(raw):
            token = raw[index]
            if token in _FALLBACK_STOPS or token in _GENERIC_TERMS or len(token) < 3:
                index += 1
                continue
            phrases.append(token)
            nxt = raw[index + 1] if index + 1 < len(raw) else ""
            if nxt and nxt not in _FALLBACK_STOPS and nxt not in _GENERIC_TERMS and len(nxt) >= 3:
                phrases.append(f"{token} {nxt}")
            index += 1
    return phrases


def top_matching_terms(resume_text: str, job_text: str, top_n: int = 8) -> dict[str, list[str]]:
    resume_phrases = _adjacent_phrases(resume_text)
    job_phrases = _adjacent_phrases(job_text)
    resume_set = set(resume_phrases)
    seen_match = []
    for phrase in job_phrases:
        if phrase in resume_set and phrase not in seen_match:
            seen_match.append(phrase)
    matching = _prefer_phrases(seen_match)[:top_n]
    matched_norms = {term.lower() for term in matching}
    matched_words = {word for term in matching for word in term.lower().split()}
    missing = []
    for phrase in job_phrases:
        norm = phrase.lower()
        if norm in resume_set or norm in matched_norms or norm in matched_words:
            continue
        if any(norm in item.lower().split() for item in matching):
            continue
        if " " not in phrase:
            continue
        if phrase not in missing:
            missing.append(phrase)
    missing = _prefer_phrases(missing)[:top_n]
    missing = [term for term in missing if term.lower() not in matched_norms and term.lower() not in matched_words]
    return {"top_matching_terms": matching, "top_missing_terms": missing}


def _job_match(keyword: float, skill_coverage: float | None, model_signal: float | None) -> float:
    parts = []
    if skill_coverage is not None:
        parts.append((0.5, skill_coverage))
        parts.append((0.3, keyword))
        if model_signal is not None:
            parts.append((0.2, model_signal))
    else:
        parts.append((0.7, keyword))
        if model_signal is not None:
            parts.append((0.3, model_signal))
    weight = sum(item[0] for item in parts)
    return round(sum(item[0] * item[1] for item in parts) / weight, 1)


def _evidence(matched_skills, missing_skills, experience: str, education: str) -> list[str]:
    notes = []
    if matched_skills:
        notes.append(f"Skills found in the resume: {', '.join(matched_skills[:6])}.")
    if missing_skills:
        notes.append(
            f"These required skills were not found in the resume text: {', '.join(missing_skills[:6])}."
        )
    if experience:
        notes.append(f"Experience requirement is listed for reviewers and is not scored: {experience}")
    if education:
        notes.append(f"Education requirement is listed for reviewers and is not scored: {education}")
    notes.append("This result supports human review. It does not accept or reject a candidate.")
    return notes[:6]


def analyze_resume(
    resume_text: str,
    job_description: str,
    required_skills: list[str] | None = None,
    experience_requirements: str = "",
    education_requirements: str = "",
) -> dict[str, Any]:
    if not resume_text or not resume_text.strip():
        raise ValueError("Could not extract text from the file.")
    if not job_description or not job_description.strip():
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
    wording_overlap = wording_overlap_score(resume_text, job_description)

    compared = match_required_skills(required_skills, resume_text)
    skills_specified = bool(compared["required"])
    jd_skills = [item["label"] for item in compared["required"]]
    matched_skills = [item["label"] for item in compared["matched"]]
    missing_skills = [item["label"] for item in compared["missing"]]
    skill_evidence = [{"label": item["label"], "evidence": item["evidence"]} for item in compared["matched"]]
    resume_skills = extract_skills(resume_text)
    extra_skills = [skill for skill in resume_skills if skill.lower() not in {item.lower() for item in jd_skills}]
    skill_coverage = round(len(matched_skills) / len(jd_skills) * 100, 1) if skills_specified else None

    ml_result = predict_match(resume_text, job_description) or {}
    ml_result.pop("ml_confidence", None)
    ml_result.pop("ml_features", None)
    model_signal = ml_result.get("ml_match_probability")
    match_percentage = _job_match(keyword_score, skill_coverage, model_signal)
    explain = top_matching_terms(resume_text, job_description)
    experience = (experience_requirements or "").strip()
    education = (education_requirements or "").strip()
    recommendations = _evidence(matched_skills, missing_skills, experience, education)
    for note in compared["notes"]:
        if note not in recommendations:
            recommendations.append(note)
    recommendations = recommendations[:8]
    if model_signal is None:
        model_note = "The classifier was not used. The score uses keyword overlap and required skills only."
        model_lean = None
    else:
        model_note = (
            "The classifier signal is an uncalibrated score for this job pairing. "
            "It is not a probability of hiring success and is not shown as confidence."
        )
        model_lean = (
            "The classifier leans toward a closer match for this job."
            if model_signal >= 50
            else "The classifier leans toward a weaker match for this job."
        )
    explanation = (
        "The job match score estimates how relevant this resume is to the selected job, "
        "using keyword overlap"
        + (", required-skill coverage" if skills_specified else "")
        + (", and the classifier signal" if model_signal is not None else "")
        + ". It does not measure overall ability. "
        + (" ".join(recommendations[:2]))
    )

    result = {
        "match_percentage": match_percentage,
        "matchScore": match_percentage,
        "keyword_score": keyword_score,
        "wording_overlap": wording_overlap,
        "semantic_score": None,
        "semantic_method": None,
        "resume_score": round(match_percentage),
        "skill_coverage": skill_coverage,
        "skills_specified": skills_specified,
        "detected_skills": resume_skills,
        "job_required_skills": jd_skills,
        "matched_skills": matched_skills,
        "matchedSkills": matched_skills,
        "skill_evidence": skill_evidence,
        "missing_skills": missing_skills,
        "missingSkills": missing_skills,
        "extra_skills": extra_skills,
        "top_matching_terms": explain["top_matching_terms"],
        "top_missing_terms": explain["top_missing_terms"],
        "suggestions": recommendations,
        "recommendations": recommendations,
        "explanation": explanation,
        "model_signal": model_signal,
        "model_lean": model_lean,
        "model_note": model_note,
        "experience_requirements": experience or None,
        "education_requirements": education or None,
        "education_status": education or "Not specified",
        "llm_available": False,
        "llm_feedback": recommendations,
        "score_disclaimer": "This screening aid supports human review and does not reject candidates.",
        "resume_preview": resume_text[:500] + ("..." if len(resume_text) > 500 else ""),
        "extracted_text": resume_text[:50000],
        "ml_available": bool(ml_result.get("ml_available")),
    }
    result.update(ml_result)
    result.pop("ml_confidence", None)
    result.pop("ml_features", None)
    return result


def model_info() -> dict:
    ready = is_model_available()
    return {
        "ml_ready": ready,
        "problem": None if ready else incompatibility_reason(),
        "metrics": get_metrics(),
        "model_card": get_model_card(),
        "evaluation": get_evaluation(),
        "cv_report": get_cv_report(),
    }
