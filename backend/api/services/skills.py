import re

from .constants import SKILL_VOCABULARY


def find_skills_in_text(text: str) -> list[str]:
    lower = text.lower()
    found = []
    for skill in SKILL_VOCABULARY:
        if re.search(r"\b" + re.escape(skill.lower()) + r"\b", lower):
            found.append(skill.title() if skill.islower() else skill)
    return sorted(set(found), key=str.lower)
