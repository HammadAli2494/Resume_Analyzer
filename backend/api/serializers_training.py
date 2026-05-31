from rest_framework import serializers

from .models import TrainingPair


class TrainingPairSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)

    class Meta:
        model = TrainingPair
        fields = [
            "id",
            "resume_text",
            "job_text",
            "label",
            "role",
            "source",
            "is_verified",
            "created_by",
            "created_by_username",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "source", "created_by", "created_at", "updated_at"]

    def validate_label(self, value):
        if value not in (0, 1):
            raise serializers.ValidationError("Label must be 0 (no fit) or 1 (good fit).")
        return value


class TrainingPairCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrainingPair
        fields = ["resume_text", "job_text", "label", "role", "is_verified"]

    def validate_label(self, value):
        if value not in (0, 1):
            raise serializers.ValidationError("Label must be 0 (no fit) or 1 (good fit).")
        return value

    def create(self, validated_data):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        validated_data.setdefault("source", TrainingPair.Source.MANUAL)
        validated_data.setdefault("is_verified", True)
        validated_data["created_by"] = user if user and user.is_authenticated else None
        return super().create(validated_data)
