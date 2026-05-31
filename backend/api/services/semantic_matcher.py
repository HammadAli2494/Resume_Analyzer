from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

_model = None
_use_transformers = None


def _char_ngram_score(resume_text: str, job_description: str) -> float:
    vectorizer = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), max_features=8000, sublinear_tf=True)
    matrix = vectorizer.fit_transform([resume_text, job_description])
    return round(float(cosine_similarity(matrix[0:1], matrix[1:2])[0][0]) * 100, 1)


def semantic_similarity_score(resume_text: str, job_description: str) -> dict:
    global _use_transformers, _model
    if _use_transformers is None:
        try:
            import sentence_transformers  # noqa: F401
            _use_transformers = True
        except ImportError:
            _use_transformers = False
    if _use_transformers:
        try:
            from sentence_transformers import SentenceTransformer
            if _model is None:
                _model = SentenceTransformer("all-MiniLM-L6-v2")
            emb = _model.encode([resume_text[:8000], job_description[:8000]], show_progress_bar=False)
            sim = cosine_similarity([emb[0]], [emb[1]])[0][0]
            return {"semantic_score": round(float(sim) * 100, 1), "semantic_method": "sentence-transformers (MiniLM)"}
        except Exception:
            pass
    score = _char_ngram_score(resume_text, job_description)
    return {"semantic_score": score, "semantic_method": "char n-gram TF-IDF"}
