from pydantic_settings import (
    BaseSettings,
    SettingsConfigDict,
)
from pydantic import SecretStr, Field

class Settings(BaseSettings):
    amh_nfc_client_token: SecretStr | None = None
    oidc_issuer: str | None = None
    oidc_client_id: str | None = None
    oidc_client_secret: SecretStr | None = None
    oidc_redirect_uri: str | None = None
    oidc_state_secret: SecretStr | None = None
    amh_api_url: str | None = None
    frontend_url: str | None = None
    mysim_base_url: str
    mysim_auth_token: str

    mysim_username: str | None = None
    mysim_password: str | None = None

    mysim_timeout: float = 20.0
    health_mysim_timeout_seconds: float = 3.0

    database_url: str = (
        "postgresql+asyncpg://"
        "postgres@127.0.0.1:5432/"
        "mysim_dashboard"
    )

    devices_sync_interval_seconds: int = 43200
    reference_data_sync_interval_seconds: int = 86400
    dynamic_query_cache_seconds: int = 120
    availability_cache_seconds: int = 7200

    query_cache_cleanup_interval_seconds: int = 3600
    query_cache_stale_retention_seconds: int = 86400

    scheduled_tasks_sync_interval_seconds: int = 1800
    scheduled_tasks_initial_delay_seconds: int = 15

    dashboard_cache_refresh_interval_seconds: int = Field(
        default=14400,
        ge=60,
    )

    dashboard_cache_initial_delay_seconds: int = Field(
        default=30,
        ge=0,
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

settings = Settings()
