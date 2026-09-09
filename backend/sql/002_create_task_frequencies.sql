CREATE TABLE IF NOT EXISTS task_frequencies (
    id BIGSERIAL PRIMARY KEY,
    mysim_id BIGINT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    num_of_days INTEGER,
    enabled BOOLEAN,
    raw_data JSONB NOT NULL,
    is_present_in_mysim BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_task_frequencies_name
    ON task_frequencies (name);

CREATE INDEX IF NOT EXISTS ix_task_frequencies_enabled
    ON task_frequencies (enabled);

CREATE INDEX IF NOT EXISTS ix_task_frequencies_raw_data
    ON task_frequencies USING GIN (raw_data);