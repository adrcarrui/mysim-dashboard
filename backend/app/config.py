from pydantic_settings import (
    BaseSettings,
    SettingsConfigDict,
)


class Settings(BaseSettings):
    mysim_base_url: str
    mysim_auth_token: str

    mysim_username: str | None = None
    mysim_password: str | None = None

    mysim_timeout: float = 20.0

    database_url: str = (
        "postgresql+asyncpg://"
        "postgres@127.0.0.1:5432/"
        "mysim_dashboard"
    )

    devices_sync_interval_seconds: int = 43200

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    reference_data_sync_interval_seconds: int = 86400
    dynamic_query_cache_seconds: int = 120
    

settings = Settings()