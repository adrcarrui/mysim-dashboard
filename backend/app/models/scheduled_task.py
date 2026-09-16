from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Integer,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.device import Base


class ScheduledTask(Base):
    __tablename__ = "scheduled_tasks"

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

    maintenance_task_id: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        index=True,
    )

    schedule_code: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    planned_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        nullable=False,
        index=True,
    )

    status_id: Mapped[int | None] = mapped_column(
        BigInteger,
        nullable=True,
        index=True,
    )

    remarks: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    done_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=False),
        nullable=True,
    )

    performed_by_id: Mapped[int | None] = mapped_column(
        BigInteger,
        nullable=True,
    )

    performance_remarks: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    enabled: Mapped[bool | None] = mapped_column(
        Boolean,
        nullable=True,
    )

    deleted: Mapped[bool | None] = mapped_column(
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


class ScheduledTaskSyncPeriod(Base):
    __tablename__ = "scheduled_task_sync_periods"

    __table_args__ = (
        UniqueConstraint(
            "period_start",
            "period_end",
            name="uq_scheduled_task_sync_period",
        ),
        CheckConstraint(
            "period_end > period_start",
            name="ck_scheduled_task_sync_period_dates",
        ),
        CheckConstraint(
            "sync_status IN "
            "('pending', 'running', 'completed', 'failed')",
            name="ck_scheduled_task_sync_status",
        ),
        CheckConstraint(
            "rows_received >= 0",
            name="ck_scheduled_task_sync_rows",
        ),
    )

    id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    period_start: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
    )

    period_end: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
    )

    sync_status: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="pending",
    )

    rows_received: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    error_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    last_attempt_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    last_success_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
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