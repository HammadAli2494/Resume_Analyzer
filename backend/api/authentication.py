"""JWT auth that does not 401 public endpoints when the browser sends an expired token."""

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError


class JWTAuthenticationOptional(JWTAuthentication):
    """Use a valid Bearer token when present; ignore invalid or expired tokens."""

    def authenticate(self, request):
        header = self.get_header(request)
        if header is None:
            return None
        raw_token = self.get_raw_token(header)
        if raw_token is None:
            return None
        try:
            validated = self.get_validated_token(raw_token)
        except (InvalidToken, TokenError):
            return None
        return self.get_user(validated), validated
