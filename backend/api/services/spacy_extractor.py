import re
from functools import lru_cache

from .constants import SKILL_VOCABULARY
from .skills import find_skills_in_text

_nlp = None
_spacy_ok = None


def _load_spacy():
    global _nlp, _spacy_ok
    if _spacy_ok is not None:
        return _nlp
    try:
        import spacy
        try:
            _nlp = spacy.load("en_core_web_sm")
        except OSError:
            import spacy.cli
            spacy.cli.download("en_core_web_sm")
            _nlp = spacy.load("en_core_web_sm")
        _spacy_ok = True
    except Exception:
        _nlp = None
        _spacy_ok = False
    return _nlp


@lru_cache(maxsize=1)
def _matcher():
    nlp = _load_spacy()
    if not nlp:
        return None, None
    from spacy.matcher import PhraseMatcher
    m = PhraseMatcher(nlp.vocab, attr="LOWER")
    m.add("SKILLS", [nlp.make_doc(s) for s in SKILL_VOCABULARY])
    return nlp, m


def extract_skills(text: str) -> list[str]:
    found = set(find_skills_in_text(text))
    nlp, matcher = _matcher()
    if nlp and matcher:
        doc = nlp(text[:100000])
        for _, start, end in matcher(doc):
            span = doc[start:end].text.strip()
            if len(span) > 1:
                found.add(span.title())
    return sorted(found, key=str.lower)


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
        "organizations": sorted({e.text for e in doc.ents if e.label_ == "ORG"})[:10],
        "job_titles": sorted(set(titles))[:8],
    }
