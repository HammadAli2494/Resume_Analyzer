from django.contrib import admin

from .models import CandidateScreening, JobPosting, TrainingPair


@admin.register(JobPosting)
class JobPostingAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "owner", "created_at")
    search_fields = ("title",)


@admin.register(CandidateScreening)
class CandidateScreeningAdmin(admin.ModelAdmin):
    list_display = ("id", "candidate_name", "resume_score", "job", "created_at")
    list_filter = ("job",)


@admin.register(TrainingPair)
class TrainingPairAdmin(admin.ModelAdmin):
    list_display = ("id", "label", "role", "source", "is_verified", "created_at")
    list_filter = ("label", "source", "is_verified")
    search_fields = ("resume_text", "job_text")
