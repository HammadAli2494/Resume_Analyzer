from django.conf import settings
from django.db import models


class JobPosting(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="jobs",
        null=True,
        blank=True,
    )
    title = models.CharField(max_length=200)
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class CandidateScreening(models.Model):
    job = models.ForeignKey(
        JobPosting,
        on_delete=models.CASCADE,
        related_name="candidates",
        null=True,
        blank=True,
    )
    screened_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="screenings",
    )
    candidate_name = models.CharField(max_length=255, blank=True)
    resume_filename = models.CharField(max_length=255)
    resume_file = models.FileField(upload_to="resumes/%Y/%m/", blank=True)
    match_percentage = models.FloatField()
    keyword_score = models.FloatField()
    semantic_score = models.FloatField()
    resume_score = models.IntegerField()
    skill_coverage = models.FloatField(default=0)
    result_data = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-resume_score", "-match_percentage"]

    def __str__(self):
        return f"{self.candidate_name or self.resume_filename} ({self.resume_score})"


class TrainingPair(models.Model):
    """Verified resume–job pairs used to train the match classifier."""

    class Source(models.TextChoices):
        MANUAL = "manual", "Manual"
        IMPORT = "import", "CSV import"
        SYNTHETIC = "synthetic", "Synthetic"

    resume_text = models.TextField()
    job_text = models.TextField()
    label = models.PositiveSmallIntegerField(help_text="1 = good fit, 0 = not fit")
    role = models.CharField(max_length=128, blank=True)
    source = models.CharField(max_length=16, choices=Source.choices, default=Source.MANUAL)
    is_verified = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="training_pairs",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"TrainingPair #{self.pk} (label={self.label})"
