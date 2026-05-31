import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer


def top_matching_terms(resume_clean: str, jd_clean: str, top_n: int = 12) -> dict[str, list[str]]:
    vectorizer = TfidfVectorizer(ngram_range=(1, 2), max_features=3000, sublinear_tf=True)
    matrix = vectorizer.fit_transform([resume_clean, jd_clean])
    features = np.array(vectorizer.get_feature_names_out())
    resume_vec = matrix[0].toarray().flatten()
    jd_vec = matrix[1].toarray().flatten()
    overlap = resume_vec * jd_vec
    matching = [
        features[i] for i in np.argsort(overlap)[::-1]
        if overlap[i] > 0 and len(features[i]) > 2
    ][:top_n]
    jd_only = jd_vec - resume_vec
    missing = [
        features[i] for i in np.argsort(jd_only)[::-1]
        if jd_only[i] > 0 and jd_vec[i] > 0 and len(features[i]) > 2
    ][:top_n]
    return {"top_matching_terms": matching, "top_missing_terms": missing}
