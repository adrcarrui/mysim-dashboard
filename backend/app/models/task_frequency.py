from datetime import datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Integer,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.device import Base


class TaskFrequency(Base):
    __tablename__ = "task_frequencies"

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

    name: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        index=True,
    )

    num_of_days: Mapped[int | None] = mapped_column(
        Integer,
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