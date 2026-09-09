from datetime import datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
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


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    mysim_id: Mapped[int] = mapped_column(
        BigInteger,
        unique=True,
        nullable=False,
        index=True,
    )

    name: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        index=True,
    )

    code: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    enabled: Mapped[bool | None] = mapped_column(
        Boolean,
        nullable=True,
    )

    raw_data: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
    )

    is_present_in_mysim: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


class MySimEntityCache(Base):
    __tablename__ = "mysim_entity_cache"

    entity: Mapped[str] = mapped_column(
        Text,
        primary_key=True,
    )

    raw_response: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
    )

    synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )