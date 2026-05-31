"""Generate labeled resume–job pairs for supervised training."""

from __future__ import annotations

import random
from pathlib import Path

import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from config import PROCESSED_DIR, RANDOM_SEED, SKILL_LIST, TRAINING_CSV
from skills import find_skills

random.seed(RANDOM_SEED)

ROLES = [
    ("Data Scientist", ["python", "sql", "machine learning", "pandas", "statistics"]),
    ("Software Engineer", ["python", "javascript", "react", "git", "docker"]),
    ("ML Engineer", ["python", "tensorflow", "pytorch", "deep learning", "nlp"]),
    ("Data Analyst", ["sql", "excel", "tableau", "statistics", "python"]),
    ("DevOps Engineer", ["docker", "kubernetes", "aws", "linux", "git"]),
]

EXPERIENCE_LINES = [
    "Built predictive models using {skills} for business analytics.",
    "Developed APIs and frontends with {skills} in an agile team.",
    "Deployed pipelines on cloud using {skills} with CI/CD practices.",
    "Analyzed datasets with {skills} and presented insights to stakeholders.",
]


def _resume_text(name: str, role: str, skills: list[str], years: int) -> str:
    skill_str = ", ".join(skills)
    body = " ".join(
        random.choice(EXPERIENCE_LINES).format(skills=s)
        for s in random.sample(skills, min(3, len(skills)))
    )
    return (
        f"{name}\n{role} — {years} years experience\n"
        f"Skills: {skill_str}\n"
        f"Summary: Professional with expertise in {skill_str}.\n"
        f"{body}"
    )


def _jd_text(role: str, skills: list[str]) -> str:
    required = ", ".join(skills)
    nice = ", ".join(random.sample(SKILL_LIST, k=min(4, len(SKILL_LIST))))
    return (
        f"Hiring: {role}\n"
        f"Required skills: {required}\n"
        f"Nice to have: {nice}\n"
        f"Responsibilities: Work with {required} to deliver production-grade solutions."
    )


def _weak_label(resume: str, jd: str) -> int:
    r_skills = find_skills(resume)
    j_skills = find_skills(jd)
    recall = len(r_skills & j_skills) / len(j_skills) if j_skills else 0.5
    vec = TfidfVectorizer(ngram_range=(1, 2), max_features=2000)
    sim = cosine_similarity(vec.fit_transform([resume, jd]))[0, 1]
    score = 0.55 * recall + 0.45 * sim
    label = 1 if score >= 0.42 else 0
    if random.random() < 0.08:
        label = 1 - label
    return label


def generate_dataset(n_samples: int = 2400) -> pd.DataFrame:
    rows = []
    names = ["Alex Chen", "Sara Ali", "John Smith", "Priya Patel", "Mike Johnson", "Emma Wilson"]
    for i in range(n_samples):
        role_name, core_skills = random.choice(ROLES)
        name = f"{random.choice(names)} {i}"
        years = random.randint(1, 8)
        if random.random() < 0.55:
            resume_skills = list(core_skills)
            if random.random() < 0.3:
                resume_skills += random.sample(SKILL_LIST, k=random.randint(1, 3))
        else:
            resume_skills = random.sample(SKILL_LIST, k=random.randint(4, 8))
        jd_skills = list(core_skills)
        resume = _resume_text(name, role_name, resume_skills, years)
        jd = _jd_text(role_name, jd_skills)
        rows.append({
            "id": i,
            "resume_text": resume,
            "job_text": jd,
            "role": role_name,
            "label": _weak_label(resume, jd),
        })
    return pd.DataFrame(rows)


def save_dataset(n_samples: int = 2400) -> Path:
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    df = generate_dataset(n_samples)
    df.to_csv(TRAINING_CSV, index=False)
    return TRAINING_CSV
