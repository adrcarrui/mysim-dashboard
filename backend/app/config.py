from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    mysim_base_url: str
    mysim_auth_token: str
    mysim_timeout: float = 20.0

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


settings = Settings()