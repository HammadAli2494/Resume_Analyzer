from rest_framework import serializers

from .models import CandidateScreening, JobPosting


class JobPostingSerializer(serializers.ModelSerializer):
    candidate_count = serializers.SerializerMethodField()

    class Meta:
        model = JobPosting
        fields = [
            "id",
            "title",
            "description",
            "candidate_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def get_candidate_count(self, obj):
        return obj.candidates.count()


class CandidateScreeningSerializer(serializers.ModelSerializer):
    matched_skills = serializers.SerializerMethodField()
    missing_skills = serializers.SerializerMethodField()
    resume_file_url = serializers.SerializerMethodField()
    llm_feedback = serializers.SerializerMethodField()

    class Meta:
        model = CandidateScreening
        fields = [
            "id",
            "candidate_name",
            "resume_filename",
            "resume_file_url",
            "match_percentage",
            "keyword_score",
            "semantic_score",
            "resume_score",
            "skill_coverage",
            "matched_skills",
            "missing_skills",
            "llm_feedback",
            "created_at",
        ]

    def get_matched_skills(self, obj):
        return obj.result_data.get("matched_skills", [])

    def get_missing_skills(self, obj):
        return obj.result_data.get("missing_skills", [])

    def get_llm_feedback(self, obj):
        return obj.result_data.get("llm_feedback", [])

    def get_resume_file_url(self, obj):
        if not obj.resume_file:
            return None
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(obj.resume_file.url)
        return obj.resume_file.url
