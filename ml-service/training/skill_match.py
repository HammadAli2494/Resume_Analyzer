"""Canonical skill names shared by scoring and training.

Normalization covers case, Unicode compatibility, whitespace, and a few
punctuation forms that appear in skill names (dots, plus signs, hashes,
hyphens). Equivalent names are an explicit alias list, not a fuzzy search.

Limits — this is not language understanding:
- Only the aliases in this file are treated as the same skill.
- Skills outside that list match as whole phrases with custom boundaries.
- Negation uses a short list of English cues in the same sentence. Other
  wording, such as "not only Python", is not treated as negation.
- A hyphenated phrase can still match its base skill (for example React in
  React-Native) because the base is a complete token before the hyphen.
- Ordinary English that uses a skill word, such as "express", can match that
  skill. The matcher does not know job titles from product names.
"""

from __future__ import annotations

import re
import unicodedata

MATCHER_VERSION = "canonical_v1"
LEGACY_MATCHER = "legacy_boundary"

# Canonical id -> patterns applied to the normalized document.
_SPECIAL_PATTERNS: dict[str, tuple[str, ...]] = {
    "mongodb": (
        r"(?<![a-z0-9+#])mongodb(?![a-z0-9+#])",
        r"(?<![a-z0-9+#])mongo[\s-]+db(?![a-z0-9+#])",
    ),
    "nodejs": (
        r"(?<![a-z0-9+#])node\.js(?![a-z0-9+#])",
        r"(?<![a-z0-9+#])nodejs(?![a-z0-9+#])",
        r"(?<![a-z0-9+#])node\s+js(?![a-z0-9+#])",
    ),
    "react": (r"(?<![a-z0-9+#])react(?:\.js|js)?(?![a-z0-9+#])",),
    "express": (r"(?<![a-z0-9+#])express(?:\.js|js)?(?![a-z0-9+#])",),
    "postgresql": (
        r"(?<![a-z0-9+#])postgresql(?![a-z0-9+#])",
        r"(?<![a-z0-9+#])postgres(?![a-z0-9+#])",
        r"(?<![a-z0-9+#])postgre\s+sql(?![a-z0-9+#])",
    ),
    "javascript": (
        r"(?<![a-z0-9+#])javascript(?![a-z0-9+#])",
        r"(?<![a-z0-9+#])java\s+script(?![a-z0-9+#])",
    ),
    "java": (r"(?<![a-z0-9+#])java(?!\s*script)(?![a-z0-9+#])",),
    "cplusplus": (
        r"(?<![a-z0-9+#])c\+\+(?![a-z0-9+#])",
        r"(?<![a-z0-9+#])cpp(?![a-z0-9+#])",
    ),
    "csharp": (
        r"(?<![a-z0-9+#])c#(?![a-z0-9+#])",
        r"(?<![a-z0-9+#])csharp(?![a-z0-9+#])",
        r"(?<![a-z0-9+#])c\s+sharp(?![a-z0-9+#])",
    ),
    "c": (r"(?<![a-z0-9+#])c(?![a-z0-9+#])",),
    "sql": (r"(?<![a-z0-9+#])sql(?![a-z0-9+#])",),
    "mysql": (
        r"(?<![a-z0-9+#])mysql(?![a-z0-9+#])",
        r"(?<![a-z0-9+#])my\s+sql(?![a-z0-9+#])",
    ),
    "powerbi": (r"(?<![a-z0-9+#])power[\s-]*bi(?![a-z0-9+#])",),
    "html": (r"(?<![a-z0-9+#])html(?![a-z0-9+#])",),
    "css": (r"(?<![a-z0-9+#])css(?![a-z0-9+#])",),
    "scikitlearn": (
        r"(?<![a-z0-9+#])scikit[\s-]*learn(?![a-z0-9+#])",
        r"(?<![a-z0-9+#])sklearn(?![a-z0-9+#])",
    ),
    "machinelearning": (r"(?<![a-z0-9+#])machine\s+learning(?![a-z0-9+#])",),
    "deeplearning": (r"(?<![a-z0-9+#])deep\s+learning(?![a-z0-9+#])",),
    "datascience": (r"(?<![a-z0-9+#])data\s+science(?![a-z0-9+#])",),
}

DISPLAY = {
    "mongodb": "MongoDB",
    "nodejs": "Node.js",
    "react": "React",
    "express": "Express",
    "postgresql": "PostgreSQL",
    "javascript": "JavaScript",
    "typescript": "TypeScript",
    "python": "Python",
    "java": "Java",
    "html": "HTML",
    "css": "CSS",
    "powerbi": "Power BI",
    "sql": "SQL",
    "mysql": "MySQL",
    "cplusplus": "C++",
    "csharp": "C#",
    "c": "C",
    "scikitlearn": "scikit-learn",
    "machinelearning": "Machine learning",
    "deeplearning": "Deep learning",
    "datascience": "Data science",
    "django": "Django",
    "flask": "Flask",
    "docker": "Docker",
    "kubernetes": "Kubernetes",
    "git": "Git",
    "aws": "AWS",
    "azure": "Azure",
    "nlp": "NLP",
    "pandas": "Pandas",
    "numpy": "NumPy",
    "tensorflow": "TensorFlow",
    "pytorch": "PyTorch",
    "excel": "Excel",
    "tableau": "Tableau",
    "spark": "Spark",
    "statistics": "Statistics",
    "agile": "Agile",
    "scrum": "Scrum",
    "angular": "Angular",
    "vue": "Vue",
    "communication": "Communication",
    "leadership": "Leadership",
}

# Surface form -> canonical id. Keys are already normalized skill phrases.
ALIASES = {
    "mongodb": "mongodb",
    "mongo db": "mongodb",
    "mongo-db": "mongodb",
    "node.js": "nodejs",
    "nodejs": "nodejs",
    "node js": "nodejs",
    "react": "react",
    "react.js": "react",
    "reactjs": "react",
    "react js": "react",
    "express": "express",
    "express.js": "express",
    "expressjs": "express",
    "express js": "express",
    "postgresql": "postgresql",
    "postgres": "postgresql",
    "postgres sql": "postgresql",
    "postgre sql": "postgresql",
    "javascript": "javascript",
    "java script": "javascript",
    "typescript": "typescript",
    "python": "python",
    "java": "java",
    "html": "html",
    "css": "css",
    "power bi": "powerbi",
    "powerbi": "powerbi",
    "power-bi": "powerbi",
    "sql": "sql",
    "mysql": "mysql",
    "my sql": "mysql",
    "c++": "cplusplus",
    "cpp": "cplusplus",
    "c#": "csharp",
    "csharp": "csharp",
    "c sharp": "csharp",
    "c": "c",
    "scikit-learn": "scikitlearn",
    "scikit learn": "scikitlearn",
    "sklearn": "scikitlearn",
    "machine learning": "machinelearning",
    "deep learning": "deeplearning",
    "data science": "datascience",
    "django": "django",
    "flask": "flask",
    "docker": "docker",
    "kubernetes": "kubernetes",
    "git": "git",
    "aws": "aws",
    "azure": "azure",
    "nlp": "nlp",
    "pandas": "pandas",
    "numpy": "numpy",
    "tensorflow": "tensorflow",
    "pytorch": "pytorch",
    "excel": "excel",
    "tableau": "tableau",
    "spark": "spark",
    "statistics": "statistics",
    "agile": "agile",
    "scrum": "scrum",
    "angular": "angular",
    "vue": "vue",
    "communication": "communication",
    "leadership": "leadership",
}

# Skills counted in classifier ratios when the artifact uses this matcher.
VOCAB_IDS = (
    "python", "java", "javascript", "typescript", "react", "angular", "vue",
    "nodejs", "express", "django", "flask", "sql", "mysql", "postgresql",
    "mongodb", "docker", "kubernetes", "git", "html", "css", "powerbi",
    "machinelearning", "deeplearning", "tensorflow", "pytorch", "scikitlearn",
    "pandas", "numpy", "nlp", "datascience", "statistics", "excel", "tableau",
    "spark", "aws", "azure", "agile", "scrum", "communication", "leadership",
    "cplusplus", "csharp", "c",
)

_CUE = re.compile(
    r"\bno\s+experience\s+(?:with|in)\b"
    r"|\bno\s+knowledge\s+of\b"
    r"|\bnot\s+familiar\s+with\b"
    r"|\bnot\s+proficient\s+(?:with|in)\b"
    r"|\bnever\s+used\b"
    r"|\b(?:do|does|did)\s+not\s+(?:know|have|use)\b"
    r"|\black(?:s|ing)?\b"
    r"|\bwithout\b"
    r"|\bno\b",
    re.IGNORECASE,
)
_CONTRAST = re.compile(r"\b(?:but|however|except|although|later|afterward|afterwards)\b", re.IGNORECASE)

_compiled: dict[str, tuple[re.Pattern[str], ...]] = {}


def normalize_document(text: str) -> str:
    """Lowercase, NFKC, and collapse spaces without deleting skill punctuation."""
    value = unicodedata.normalize("NFKC", text or "")
    value = value.replace("\u00a0", " ").replace("\r\n", "\n").replace("\r", "\n")
    value = value.lower()
    value = re.sub(r"[\u2010-\u2015]", "-", value)
    value = value.replace("_", " ")
    value = re.sub(r"[^\S\n]+", " ", value)
    return value


def normalize_skill_phrase(skill: str) -> str:
    value = normalize_document(skill).replace("\n", " ")
    value = re.sub(r"\s*\.\s*", ".", value)
    value = re.sub(r"\s*\+\s*", "+", value)
    value = re.sub(r"\s*#\s*", "#", value)
    value = re.sub(r"\s+", " ", value).strip(" -")
    return value


def canonical_id(skill: str) -> str:
    phrase = normalize_skill_phrase(skill)
    if not phrase:
        return ""
    return ALIASES.get(phrase, phrase)


def display_label(skill_id: str, original: str = "") -> str:
    if skill_id in DISPLAY:
        return DISPLAY[skill_id]
    text = re.sub(r"\s+", " ", original or skill_id).strip()
    return text[:60]


def _plain_pattern(skill_id: str) -> str:
    parts = [re.escape(part) for part in skill_id.split() if part]
    if not parts:
        return r"(?!)"
    body = r"\s+".join(parts)
    return rf"(?<![a-z0-9+#]){body}(?![a-z0-9+#])"


def patterns_for(skill_id: str) -> tuple[re.Pattern[str], ...]:
    cached = _compiled.get(skill_id)
    if cached:
        return cached
    sources = _SPECIAL_PATTERNS.get(skill_id)
    if not sources:
        sources = (_plain_pattern(skill_id),)
    compiled = tuple(re.compile(source, re.IGNORECASE) for source in sources)
    _compiled[skill_id] = compiled
    return compiled


def negation_regions(document: str) -> list[tuple[int, int]]:
    """Spans where a negation cue covers the rest of the sentence.

    A contrast word such as "but" or "later" ends the span. This catches
    "no experience with Python, React, or SQL" without treating "not only
    Python" as negative. It is still a cue list, not sentence understanding.
    """
    regions = []
    for sentence in re.finditer(r"[^.!?;\n]+", document or ""):
        cue = _CUE.search(sentence.group())
        if not cue:
            continue
        contrast = _CONTRAST.search(sentence.group(), cue.end())
        end = sentence.start() + (contrast.start() if contrast else len(sentence.group()))
        regions.append((sentence.start() + cue.start(), end))
    return regions


def is_negated(document: str, start: int, regions: list[tuple[int, int]] | None = None) -> bool:
    spans = negation_regions(document) if regions is None else regions
    return any(begin <= start < end for begin, end in spans)


def _snippet(document: str, start: int, end: int) -> str:
    snippet = document[max(0, start - 40):min(len(document), end + 40)]
    snippet = re.sub(r"\s+", " ", snippet).strip()
    return snippet[:140]


def _spans(document: str, skill_id: str) -> list[re.Match[str]]:
    found = []
    for pattern in patterns_for(skill_id):
        found.extend(pattern.finditer(document))
    found.sort(key=lambda match: match.start())
    return found


def dedupe_required(skills: list[str] | None) -> list[dict[str, str]]:
    """Drop empty and alias-duplicate requirements, preserving first-seen order."""
    ordered = []
    seen = set()
    for raw in skills or []:
        original = str(raw).strip()
        skill_id = canonical_id(original)
        if not skill_id or skill_id in seen:
            continue
        seen.add(skill_id)
        ordered.append({"id": skill_id, "label": display_label(skill_id, original)})
    return ordered


def match_required_skills(required: list[str] | None, resume_text: str) -> dict:
    """Match required skills against resume text.

    Matched and missing labels are disjoint. A skill is matched only when at
    least one mention is outside a recognized negation cue.
    """
    document = normalize_document(resume_text or "")
    regions = negation_regions(document)
    needed = dedupe_required(required)
    matched = []
    missing = []
    notes = []
    for item in needed:
        spans = _spans(document, item["id"])
        positive = [span for span in spans if not is_negated(document, span.start(), regions)]
        negated = [span for span in spans if is_negated(document, span.start(), regions)]
        if positive:
            span = positive[0]
            matched.append({
                "id": item["id"],
                "label": item["label"],
                "evidence": _snippet(document, span.start(), span.end()),
            })
        else:
            missing.append({"id": item["id"], "label": item["label"]})
            if negated:
                notes.append(
                    f"A mention of {item['label']} was not counted because it appears in a negative phrase."
                )
    return {"required": needed, "matched": matched, "missing": missing, "notes": notes}


def vocabulary_labels(text: str) -> list[str]:
    """Readable labels for built-in skills that have positive evidence."""
    document = normalize_document(text or "")
    regions = negation_regions(document)
    labels = []
    for skill_id in VOCAB_IDS:
        spans = _spans(document, skill_id)
        if any(not is_negated(document, span.start(), regions) for span in spans):
            labels.append(DISPLAY.get(skill_id, skill_id))
    return labels


def find_skill_ids(text: str, matcher: str = MATCHER_VERSION) -> set[str]:
    if matcher == LEGACY_MATCHER:
        return find_skills_legacy(text)
    document = normalize_document(text or "")
    regions = negation_regions(document)
    found = set()
    for skill_id in VOCAB_IDS:
        spans = _spans(document, skill_id)
        if any(not is_negated(document, span.start(), regions) for span in spans):
            found.add(skill_id)
    return found


def find_skills_legacy(text: str) -> set[str]:
    """Word-boundary vocabulary used by artifacts trained before canonical matching.

    Kept so an older classifier still receives the feature values it was fit on.
    """
    from config import SKILL_LIST

    lower = (text or "").lower()
    found = set()
    for skill in SKILL_LIST:
        if re.search(r"\b" + re.escape(skill) + r"\b", lower):
            found.add(skill)
    return found
