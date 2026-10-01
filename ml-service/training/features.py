"""Feature engineering for match classification."""

from __future__ import annotations

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from skills import skill_features

_sbert_model = None
_sbert_available: bool | None = None


def _pair_cosine(resume: str, jd: str, **vectorizer_kwargs) -> float:
    """Fit TF-IDF on this pair only so one resume cannot set the vocabulary for another."""
    vectorizer = TfidfVectorizer(**vectorizer_kwargs)
    matrix = vectorizer.fit_transform([resume, jd])
    return float(cosine_similarity(matrix[0:1], matrix[1:2])[0, 0])


def _tfidf_similarity(resume: str, jd: str, fit: bool = False) -> float:
    del fit
    return _pair_cosine(resume, jd, ngram_range=(1, 2), max_features=4000, sublinear_tf=True)


def _char_similarity(resume: str, jd: str, fit: bool = False) -> float:
    del fit
    return _pair_cosine(resume, jd, analyzer="char_wb", ngram_range=(3, 5), max_features=3000)


def _sbert_cosine(resume: str, jd: str) -> float | None:
    global _sbert_model, _sbert_available
    if _sbert_available is False:
        return None
    try:
        if _sbert_available is None:
            from sentence_transformers import SentenceTransformer

            _sbert_model = SentenceTransformer("all-MiniLM-L6-v2")
            _sbert_available = True
        emb = _sbert_model.encode([resume[:5000], jd[:5000]], show_progress_bar=False)
        return float(cosine_similarity([emb[0]], [emb[1]])[0, 0])
    except Exception:
        _sbert_available = False
        return None


def extract_features(resume: str, jd: str, fit_vectorizers: bool = False, skill_matcher: str = "canonical_v1") -> np.ndarray:
    skills = skill_features(resume, jd, matcher=skill_matcher)
    tfidf_sim = _tfidf_similarity(resume, jd, fit=fit_vectorizers)
    char_sim = _char_similarity(resume, jd, fit=fit_vectorizers)
    sbert_sim = _sbert_cosine(resume, jd)
    if sbert_sim is None:
        sbert_sim = 0.0

    return np.array([
        tfidf_sim,
        char_sim,
        sbert_sim,
        skills["skill_recall"],
        skills["skill_precision"],
        skills["skill_jaccard"],
        skills["skill_count_resume"],
        skills["skill_count_jd"],
        len(resume) / 10000.0,
        len(jd) / 5000.0,
    ], dtype=np.float64)


FEATURE_NAMES = [
    "tfidf_cosine",
    "char_cosine",
    # Historical slot. This is 0 unless sentence-transformers is installed.
    # It is not a measure of semantic understanding.
    "semantic_cosine",
    "skill_recall",
    "skill_precision",
    "skill_jaccard",
    "skill_count_resume",
    "skill_count_jd",
    "resume_length_norm",
    "jd_length_norm",
]


def build_matrix(df, fit: bool = False, skill_matcher: str = "canonical_v1") -> np.ndarray:
    rows = [
        extract_features(row["resume_text"], row["job_text"], fit_vectorizers=fit, skill_matcher=skill_matcher)
        for _, row in df.iterrows()
    ]
    return np.vstack(rows)
