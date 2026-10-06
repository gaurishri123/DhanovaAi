from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # App
    PROJECT_NAME: str = "Dhanova Backend"
    VERSION: str = "1.0.0"

    # ML Model
    MODEL_DIR: Path = Path(__file__).resolve().parents[3] / "models"

    # Supabase
    SUPABASE_URL: str
    SUPABASE_KEY: str

    # External APIs
    GEMINI_API_KEY: str

    # Security: keep disabled for local development; enable in deployed environments.
    AUTH_REQUIRED: bool = False
    CORS_ORIGINS: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

settings = Settings()
