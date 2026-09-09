CREATE TABLE IF NOT EXISTS mysim_query_cache (
    cache_key VARCHAR(64) PRIMARY KEY,
    entity TEXT NOT NULL,
    extra_query TEXT,
    raw_response JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_mysim_query_cache_entity
    ON mysim_query_cache (entity);

CREATE INDEX IF NOT EXISTS ix_mysim_query_cache_expires_at
    ON mysim_query_cache (expires_at);