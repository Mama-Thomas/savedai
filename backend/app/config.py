from typing import List

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/savedai"
    OPENAI_API_KEY: str = ""
    APP_ENV: str = "development"

    # Public URL of the frontend app. Used to build password-reset links
    # that we email to users. In production set this to your real domain.
    APP_BASE_URL: str = "http://localhost:3000"

    # JWT
    JWT_SECRET_KEY: str = "change-this-secret-in-production"
    JWT_ALGORITHM: str = "HS256"
    # Access tokens are short-lived now: 60 minutes. The frontend will re-auth
    # the user after this expires.
    JWT_EXPIRE_MINUTES: int = 60
    # Password reset tokens are one-time and short-lived (30 minutes).
    PASSWORD_RESET_EXPIRE_MINUTES: int = 30

    # CORS. Comma-separated list of origins allowed to talk to the API.
    # Using "*" means allow any origin (only for local dev), but note that
    # this disables credentials on browsers that enforce the spec.
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"

    # Resend email provider. If RESEND_API_KEY is empty, emails are logged to
    # the console instead (useful for local dev). RESEND_FROM_EMAIL must be a
    # verified sender in your Resend account in production.
    RESEND_API_KEY: str = ""
    RESEND_FROM_EMAIL: str = "SavedAI <onboarding@resend.dev>"

    @property
    def cors_origin_list(self) -> List[str]:
        origins = [o.strip() for o in (self.CORS_ORIGINS or "").split(",") if o.strip()]
        return origins or ["http://localhost:3000"]

    @property
    def is_production(self) -> bool:
        return self.APP_ENV.lower() == "production"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
