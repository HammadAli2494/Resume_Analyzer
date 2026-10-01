import unittest

from training.skill_match import canonical_id, dedupe_required, match_required_skills


def labels(items):
    return [item["label"] for item in items]


class SkillMatchTests(unittest.TestCase):
    def test_aliases(self):
        resume = "Built APIs with MongoDB, React, Node.js, Express, and PostgreSQL."
        required = ["Mongo DB", "React.js", "NodeJS", "Express.js", "Postgres"]
        result = match_required_skills(required, resume)
        self.assertEqual(labels(result["missing"]), [])
        self.assertEqual(
            labels(result["matched"]),
            ["MongoDB", "React", "Node.js", "Express", "PostgreSQL"],
        )
        self.assertTrue(all(item["evidence"] for item in result["matched"]))

    def test_exact_skills_outside_old_vocabulary(self):
        resume = "Dashboard work in Power BI, plus HTML and CSS layouts, using Express."
        required = ["Power BI", "HTML", "CSS", "Express"]
        result = match_required_skills(required, resume)
        self.assertEqual(labels(result["missing"]), [])
        self.assertCountEqual(labels(result["matched"]), ["Power BI", "HTML", "CSS", "Express"])

    def test_unknown_vocabulary_is_boundary_aware(self):
        resume = "Portfolio design with Figma and design systems."
        matched = match_required_skills(["Figma"], resume)
        missing = match_required_skills(["Fig"], resume)
        self.assertEqual(labels(matched["matched"]), ["Figma"])
        self.assertEqual(labels(missing["missing"]), ["Fig"])

    def test_punctuation_sensitive_languages(self):
        resume = "Daily work in C++ and C#."
        result = match_required_skills(["C", "C++", "C#"], resume)
        self.assertEqual(labels(result["matched"]), ["C++", "C#"])
        self.assertEqual(labels(result["missing"]), ["C"])

        only_c = match_required_skills(["C", "C++", "C#"], "I write C for embedded firmware systems.")
        self.assertEqual(labels(only_c["matched"]), ["C"])
        self.assertEqual(labels(only_c["missing"]), ["C++", "C#"])

    def test_substring_false_positives(self):
        javascript = match_required_skills(["Java"], "Five years of JavaScript and React.")
        self.assertEqual(labels(javascript["matched"]), [])
        self.assertEqual(labels(javascript["missing"]), ["Java"])

        mysql = match_required_skills(["SQL"], "Queries in MySQL only.")
        self.assertEqual(labels(mysql["missing"]), ["SQL"])
        self.assertEqual(labels(match_required_skills(["MySQL"], "Queries in MySQL only.")["matched"]), ["MySQL"])

        self.assertNotEqual(canonical_id("reaction"), "react")
        reaction = match_required_skills(["React"], "A reaction time study.")
        self.assertEqual(labels(reaction["matched"]), [])

    def test_duplicate_requirements(self):
        result = match_required_skills(["React.js", "React", "ReactJS", "react js"], "Used React on the web team.")
        self.assertEqual(labels(result["required"]), ["React"])
        self.assertEqual(labels(result["matched"]), ["React"])
        self.assertEqual(result["missing"], [])

    def test_negation_is_not_positive_evidence(self):
        resume = "I have no experience with Python. I use JavaScript daily."
        result = match_required_skills(["Python", "JavaScript"], resume)
        self.assertEqual(labels(result["matched"]), ["JavaScript"])
        self.assertEqual(labels(result["missing"]), ["Python"])
        self.assertTrue(result["notes"])

    def test_negated_skill_list(self):
        resume = "I have no experience with Python, React, MongoDB, or Power BI."
        result = match_required_skills(["Python", "React", "MongoDB", "Power BI"], resume)
        self.assertEqual(result["matched"], [])
        self.assertEqual(labels(result["missing"]), ["Python", "React", "MongoDB", "Power BI"])

    def test_positive_mention_overrides_negation(self):
        resume = "No experience with Python in school. Later I shipped Python services."
        result = match_required_skills(["Python"], resume)
        self.assertEqual(labels(result["matched"]), ["Python"])
        self.assertEqual(result["missing"], [])

    def test_sets_stay_disjoint(self):
        result = match_required_skills(["Python", "SQL"], "Python developer.")
        matched = set(labels(result["matched"]))
        missing = set(labels(result["missing"]))
        self.assertFalse(matched & missing)

    def test_unicode_and_spacing(self):
        resume = "Worked with Mongo\u00a0DB and Ｒｅａｃｔ."
        result = match_required_skills(["MongoDB", "React"], resume)
        self.assertEqual(labels(result["missing"]), [])

    def test_dedupe_keeps_first_label(self):
        self.assertEqual([item["id"] for item in dedupe_required(["Mongo DB", "MongoDB"])], ["mongodb"])


if __name__ == "__main__":
    unittest.main()
