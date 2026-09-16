BEGIN;

CREATE TABLE IF NOT EXISTS scheduled_tasks (
    id BIGSERIAL PRIMARY KEY,

    mysim_id BIGINT NOT NULL UNIQUE,
    maintenance_task_id BIGINT NOT NULL,

    schedule_code TEXT NOT NULL,
    planned_date TIMESTAMP NOT NULL,
    status_id BIGINT,

    remarks TEXT,
    done_at TIMESTAMP,
    performed_by_id BIGINT,
    performance_remarks TEXT,

    enabled BOOLEAN,
    deleted BOOLEAN,

    raw_data JSONB NOT NULL,
    is_present_in_mysim BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_scheduled_tasks_maintenance_task
    ON scheduled_tasks (maintenance_task_id);

CREATE INDEX IF NOT EXISTS ix_scheduled_tasks_planned_date
    ON scheduled_tasks (planned_date);

CREATE INDEX IF NOT EXISTS ix_scheduled_tasks_status
    ON scheduled_tasks (status_id);

CREATE INDEX IF NOT EXISTS ix_scheduled_tasks_open_planned_date
    ON scheduled_tasks (planned_date, status_id)
    WHERE is_present_in_mysim = TRUE
      AND enabled = TRUE
      AND deleted = FALSE;

CREATE INDEX IF NOT EXISTS ix_scheduled_tasks_raw_data
    ON scheduled_tasks USING GIN (raw_data);


CREATE TABLE IF NOT EXISTS scheduled_task_sync_periods (
    id BIGSERIAL PRIMARY KEY,

    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    sync_status TEXT NOT NULL DEFAULT 'pending',
    rows_received INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,

    last_attempt_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_scheduled_task_sync_period
        UNIQUE (period_start, period_end),

    CONSTRAINT ck_scheduled_task_sync_period_dates
        CHECK (period_end > period_start),

    CONSTRAINT ck_scheduled_task_sync_status
        CHECK (
            sync_status IN (
                'pending',
                'running',
                'completed',
                'failed'
            )
        ),

    CONSTRAINT ck_scheduled_task_sync_rows
        CHECK (rows_received >= 0)
);

CREATE INDEX IF NOT EXISTS ix_scheduled_task_sync_periods_status
    ON scheduled_task_sync_periods (sync_status);

CREATE INDEX IF NOT EXISTS ix_scheduled_task_sync_periods_dates
    ON scheduled_task_sync_periods (
        period_start,
        period_end
    );

COMMIT;