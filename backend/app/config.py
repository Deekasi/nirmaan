from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """App settings, read from environment variables or a .env file."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # SQLite by default so it runs on any laptop with zero setup.
    database_url: str = "sqlite:///./nirmaan.db"
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 60 * 24
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # AI settings. Groq is the default because its free tier needs no credit card.
    llm_provider: str = "groq"  # "groq" or "gemini"
    groq_api_key: str = ""
    groq_model: str = "openai/gpt-oss-120b"
    groq_research_model: str = "groq/compound"  # has built-in web search
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    # "auto" = real AI if the chosen provider has a key, otherwise fake demo data.
    # "fake" = always fake (tests, offline demos). "real" = always real.
    llm_mode: str = "auto"

    @property
    def active_key(self) -> str:
        return self.gemini_api_key if self.llm_provider == "gemini" else self.groq_api_key

    @property
    def use_fake_llm(self) -> bool:
        if self.llm_mode == "fake":
            return True
        if self.llm_mode == "real":
            return False
        return not self.active_key


settings = Settings()
