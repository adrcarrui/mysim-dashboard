CREATE TABLE IF NOT EXISTS devices (
    id BIGSERIAL PRIMARY KEY,
    mysim_id BIGINT NOT NULL UNIQUE,
    name TEXT,
    code TEXT,
    enabled BOOLEAN,
    raw_data JSONB NOT NULL,
    is_present_in_mysim BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_devices_name
    ON devices (name);

CREATE INDEX IF NOT EXISTS ix_devices_enabled
    ON devices (enabled);

CREATE INDEX IF NOT EXISTS ix_devices_raw_data
    ON devices USING GIN (raw_data);

CREATE TABLE IF NOT EXISTS mysim_entity_cache (
    entity TEXT PRIMARY KEY,
    raw_response JSONB NOT NULL,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);