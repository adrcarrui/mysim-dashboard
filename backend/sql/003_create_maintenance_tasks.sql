CREATE TABLE IF NOT EXISTS maintenance_tasks (
    id BIGSERIAL PRIMARY KEY,

    mysim_id BIGINT NOT NULL UNIQUE,
    task_id TEXT NOT NULL,
    task_name TEXT NOT NULL,
    task_description TEXT,

    device_id BIGINT,
    frequency_id BIGINT,
    system_id BIGINT,
    status_id BIGINT,
    to_do_by_id BIGINT,

    estimated_time TEXT,
    preventive_manual_version TEXT,
    enabled BOOLEAN,

    raw_data JSONB NOT NULL,
    is_present_in_mysim BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_maintenance_tasks_task_id
    ON maintenance_tasks (task_id);

CREATE INDEX IF NOT EXISTS ix_maintenance_tasks_device
    ON maintenance_tasks (device_id);

CREATE INDEX IF NOT EXISTS ix_maintenance_tasks_frequency
    ON maintenance_tasks (frequency_id);

CREATE INDEX IF NOT EXISTS ix_maintenance_tasks_status
    ON maintenance_tasks (status_id);

CREATE INDEX IF NOT EXISTS ix_maintenance_tasks_enabled
    ON maintenance_tasks (enabled);

CREATE INDEX IF NOT EXISTS ix_maintenance_tasks_raw_data
    ON maintenance_tasks USING GIN (raw_data);