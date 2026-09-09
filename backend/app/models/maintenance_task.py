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
from sqlalchemy.orm import Mapped, mapped_column

from app.models.device import Base


class MaintenanceTask(Base):
    __tablename__ = "maintenance_tasks"

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

    task_id: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        index=True,
    )

    task_name: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    task_description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    device_id: Mapped[int | None] = mapped_column(
        BigInteger,
        nullable=True,
        index=True,
    )

    frequency_id: Mapped[int | None] = mapped_column(
        BigInteger,
        nullable=True,
        index=True,
    )

    system_id: Mapped[int | None] = mapped_column(
        BigInteger,
        nullable=True,
    )

    status_id: Mapped[int | None] = mapped_column(
        BigInteger,
        nullable=True,
    )

    to_do_by_id: Mapped[int | None] = mapped_column(
        BigInteger,
        nullable=True,
    )

    estimated_time: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    preventive_manual_version: Mapped[
        str | None
    ] = mapped_column(
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