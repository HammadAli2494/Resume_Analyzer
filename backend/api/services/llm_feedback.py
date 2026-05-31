"""Optional LLM coaching — requires OPENAI_API_KEY in backend/.env."""

from __future__ import annotations

import json
import os
from typing import Any


def generate_llm_feedback(
    resume_text: str,
    job_description: str,
    analysis: dict[str, Any],
) -> dict[str, Any]:
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        return {
            "llm_available": False,
            "llm_feedback": _rule_based_coaching(analysis),
            "resume_improvements": [],
        }

    try:
        from openai import OpenAI

        client = OpenAI(api_key=api_key)
        prompt = _build_prompt(resume_text, job_description, analysis)
        response = client.chat.completions.create(
            model=os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an expert resume coach and ATS consultant. "
                        "Respond ONLY with valid JSON."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.4,
            max_tokens=800,
        )
        raw = response.choices[0].message.content or "{}"
        parsed = _parse_json_response(raw)
        return {
            "llm_available": True,
            "llm_feedback": parsed.get("feedback", []),
            "resume_improvements": parsed.get("improvements", []),
        }
    except Exception:
        return {
            "llm_available": False,
            "llm_feedback": _rule_based_coaching(analysis),
            "resume_improvements": [],
        }


def _build_prompt(resume_text: str, job_description: str, analysis: dict) -> str:
    return f"""Analyze this resume against the job and prior ATS scores.

Job description:
{job_description[:3000]}

Resume excerpt:
{resume_text[:3500]}

ATS analysis:
- Match: {analysis.get('match_percentage')}%
- Missing skills: {', '.join(analysis.get('missing_skills', [])[:10])}
- Matched skills: {', '.join(analysis.get('matched_skills', [])[:10])}

Return JSON:
{{
  "feedback": ["3-5 bullet strings for the candidate"],
  "improvements": ["3-5 specific rewrite suggestions with examples"]
}}"""


def _parse_json_response(raw: str) -> dict:
    text = raw.strip()
    if "```" in text:
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text.strip())


def _rule_based_coaching(analysis: dict) -> list[str]:
    tips = list(analysis.get("suggestions", []))
    missing = analysis.get("missing_skills", [])
    if missing:
        tips.append(
            f"Rewrite your skills section to explicitly list: {', '.join(missing[:6])}."
        )
    terms = analysis.get("top_missing_terms", [])
    if terms:
        tips.append(
            f"Mirror job-description phrases such as: {', '.join(terms[:6])}."
        )
    return tips[:6]
