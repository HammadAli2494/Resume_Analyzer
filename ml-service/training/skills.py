from skill_match import LEGACY_MATCHER, MATCHER_VERSION, find_skill_ids


def find_skills(text: str, matcher: str = MATCHER_VERSION) -> set[str]:
    return find_skill_ids(text, matcher)


def skill_features(resume_text: str, jd_text: str, matcher: str = MATCHER_VERSION) -> dict[str, float]:
    resume_skills = find_skills(resume_text, matcher)
    job_skills = find_skills(jd_text, matcher)
    if not job_skills:
        recall = 1.0 if not resume_skills else 0.5
        precision = 1.0
        jaccard = 1.0 if not resume_skills else 0.0
    else:
        matched = resume_skills & job_skills
        recall = len(matched) / len(job_skills)
        precision = len(matched) / len(resume_skills) if resume_skills else 0.0
        union = resume_skills | job_skills
        jaccard = len(matched) / len(union) if union else 0.0
    return {
        "skill_recall": recall,
        "skill_precision": precision,
        "skill_jaccard": jaccard,
        "skill_count_resume": float(len(resume_skills)),
        "skill_count_jd": float(len(job_skills)),
    }


def legacy_skill_features(resume_text: str, jd_text: str) -> dict[str, float]:
    return skill_features(resume_text, jd_text, LEGACY_MATCHER)
