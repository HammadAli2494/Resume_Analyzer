import os
import unittest

from starlette.requests import Request


def _request(headers):
    scope = {
        "type": "http",
        "http_version": "1.1",
        "method": "GET",
        "scheme": "http",
        "path": "/ready",
        "raw_path": b"/ready",
        "query_string": b"",
        "headers": [(key.lower().encode(), value.encode()) for key, value in headers.items()],
        "client": ("127.0.0.1", 123),
        "server": ("127.0.0.1", 8000),
    }
    return Request(scope)


class ServiceTests(unittest.TestCase):
    def test_private_token_and_keyword_fallback_status(self):
        from fastapi import HTTPException

        from app.main import _authorize, ready

        os.environ["ML_INTERNAL_TOKEN"] = "test-internal-token-value"
        os.environ["ML_ENV"] = "development"
        try:
            with self.assertRaises(HTTPException) as denied:
                _authorize(_request({}))
            self.assertEqual(denied.exception.status_code, 401)
            _authorize(_request({"X-Internal-Token": "test-internal-token-value"}))
            response = ready(_request({"X-Internal-Token": "test-internal-token-value"}))
            status = getattr(response, "status_code", 200)
            body = response if isinstance(response, dict) else response.body
            self.assertIn(status, (200, 503))
            if status == 503:
                self.assertIn(b"keyword_only", body)
        finally:
            os.environ["ML_INTERNAL_TOKEN"] = ""
            os.environ["ML_ENV"] = "development"

    def test_analyze_uses_aliases(self):
        from app.services.analyze import analyze_resume

        resume = (
            "Software engineer. Built services with MongoDB, React, Express, HTML, CSS, and Power BI. "
            "I have no experience with Java. "
        ) * 3
        job = "We need an engineer who can build web interfaces and dashboards for the hiring team this quarter."
        result = analyze_resume(resume, job, ["Mongo DB", "React.js", "Express.js", "HTML", "CSS", "Power BI", "Java"], "2 years", "")
        self.assertIn("MongoDB", result["matched_skills"])
        self.assertIn("React", result["matched_skills"])
        self.assertIn("HTML", result["matched_skills"])
        self.assertIn("CSS", result["matched_skills"])
        self.assertIn("Power BI", result["matched_skills"])
        self.assertIn("Java", result["missing_skills"])
        self.assertFalse(set(result["matched_skills"]) & set(result["missing_skills"]))
        self.assertTrue(result["skill_evidence"])
        self.assertIsNone(result["semantic_score"])
        self.assertIn("not a probability of hiring", result["model_note"].lower())


if __name__ == "__main__":
    unittest.main()
