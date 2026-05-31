"""Feature engineering for match classification."""

from __future__ import annotations

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from skills import skill_features

_tfidf_vectorizer: TfidfVectorizer | None = None
_char_vectorizer: TfidfVectorizer | None = None
_sbert_model = None
_sbert_available: bool | None = None


def _tfidf_similarity(resume: str, jd: str, fit: bool = False) -> float:
    global _tfidf_vectorizer
    if fit or _tfidf_vectorizer is None:
        _tfidf_vectorizer = TfidfVectorizer(ngram_range=(1, 2), max_features=4000, sublinear_tf=True)
        mat = _tfidf_vectorizer.fit_transform([resume, jd])
    else:
        mat = _tfidf_vectorizer.transform([resume, jd])
    return float(cosine_similarity(mat[0:1], mat[1:2])[0, 0])


def _char_similarity(resume: str, jd: str, fit: bool = False) -> float:
    global _char_vectorizer
    if fit or _char_vectorizer is None:
        _char_vectorizer = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), max_features=3000)
        mat = _char_vectorizer.fit_transform([resume, jd])
    else:
        mat = _char_vectorizer.transform([resume, jd])
    return float(cosine_similarity(mat[0:1], mat[1:2])[0, 0])


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


def extract_features(resume: str, jd: str, fit_vectorizers: bool = False) -> np.ndarray:
    skills = skill_features(resume, jd)
    tfidf_sim = _tfidf_similarity(resume, jd, fit=fit_vectorizers)
    char_sim = _char_similarity(resume, jd, fit=fit_vectorizers)
    sbert_sim = _sbert_cosine(resume, jd)
    if sbert_sim is None:
        sbert_sim = char_sim

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
    "semantic_cosine",
    "skill_recall",
    "skill_precision",
    "skill_jaccard",
    "skill_count_resume",
    "skill_count_jd",
    "resume_length_norm",
    "jd_length_norm",
]


def build_matrix(df, fit: bool = False) -> np.ndarray:
    rows = [
        extract_features(row["resume_text"], row["job_text"], fit_vectorizers=fit)
        for _, row in df.iterrows()
    ]
    return np.vstack(rows)
