"""Reads settings from environment variables (and from a local .env file)."""
import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    supabase_url: str = os.getenv("SUPABASE_URL", "").rstrip("/")
    supabase_anon_key: str = os.getenv("SUPABASE_ANON_KEY", "")
    supabase_service_key: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    allowed_origins: list[str] = [
        o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",") if o.strip()
    ]
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")

    @property
    def configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_key and self.supabase_anon_key)


settings = Settings()
