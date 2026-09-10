from datetime import datetime
from typing import Any

from sqlalchemy import (
    DateTime,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    mapped_column,
)


class Base(DeclarativeBase):
    pass


class MySimQueryCache(Base):
    __tablename__ = "mysim_query_cache"

    cache_key: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
    )

    entity: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        index=True,
    )

    extra_query: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    raw_response: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
    )

    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
