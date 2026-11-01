from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(BACKEND_DIR.parent / ".env", BACKEND_DIR / ".env"),
        extra="ignore",
    )

    youcam_api_key: str = ""
    youcam_base_url: str = "https://yce-api-01.makeupar.com"
    anthropic_api_key: str = ""

    model: str = Field(default="claude-opus-5-5", alias="PROOFPICK_MODEL")
    max_previews_per_session: int = Field(default=3, alias="PROOFPICK_MAX_PREVIEWS_PER_SESSION")
    max_retries_per_session: int = Field(default=1, alias="PROOFPICK_MAX_RETRIES_PER_SESSION")
    max_tasks_per_day: int = Field(default=30, alias="PROOFPICK_MAX_TASKS_PER_DAY")
    poll_interval_seconds: float = Field(default=10.0, alias="PROOFPICK_POLL_INTERVAL_SECONDS")
    task_timeout_seconds: float = Field(default=300.0, alias="PROOFPICK_TASK_TIMEOUT_SECONDS")

    var_dir: Path = Field(default=BACKEND_DIR / "var", alias="PROOFPICK_VAR_DIR")
    catalog_path: Path = Field(default=BACKEND_DIR / "data" / "catalog.json", alias="PROOFPICK_CATALOG")
    catalog_images_dir: Path = BACKEND_DIR / "data" / "catalog_images"
    sample_photo_path: Path = BACKEND_DIR / "data" / "sample" / "model.jpg"
    cookie_secure: bool = Field(default=False, alias="PROOFPICK_COOKIE_SECURE")


@lru_cache
def get_settings() -> Settings:
    return Settings()
