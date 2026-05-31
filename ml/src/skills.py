import re

from config import SKILL_LIST


def find_skills(text: str) -> set[str]:
    lower = text.lower()
    found = set()
    for skill in SKILL_LIST:
        if re.search(r"\b" + re.escape(skill) + r"\b", lower):
            found.add(skill)
    return found


def skill_features(resume_text: str, jd_text: str) -> dict[str, float]:
    r_skills = find_skills(resume_text)
    j_skills = find_skills(jd_text)
    if not j_skills:
        recall = 1.0 if not r_skills else 0.5
        precision = 1.0
        jaccard = 1.0 if not r_skills else 0.0
    else:
        matched = r_skills & j_skills
        recall = len(matched) / len(j_skills)
        precision = len(matched) / len(r_skills) if r_skills else 0.0
        union = r_skills | j_skills
        jaccard = len(matched) / len(union) if union else 0.0
    return {
        "skill_recall": recall,
        "skill_precision": precision,
        "skill_jaccard": jaccard,
        "skill_count_resume": float(len(r_skills)),
        "skill_count_jd": float(len(j_skills)),
    }
