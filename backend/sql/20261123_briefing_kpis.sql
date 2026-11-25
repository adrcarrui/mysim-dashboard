BEGIN;

ALTER TABLE maintenance_briefing_task_execution
    ADD COLUMN IF NOT EXISTS performers JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS intervals_complete BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS metrics_snapshot JSONB;

CREATE TABLE IF NOT EXISTS maintenance_briefing_task_interval (
    briefing_id BIGINT NOT NULL,
    source_id VARCHAR(300) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    PRIMARY KEY (briefing_id, source_id, started_at),
    FOREIGN KEY (briefing_id, source_id)
        REFERENCES maintenance_briefing_task_execution (briefing_id, source_id) ON DELETE CASCADE,
    CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS maintenance_briefing_one_open_interval
    ON maintenance_briefing_task_interval (briefing_id, source_id) WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS maintenance_briefing_execution_completed
    ON maintenance_briefing_task_execution (completed_at) WHERE completed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS maintenance_briefing_execution_source_completed
    ON maintenance_briefing_task_execution (source_id, completed_at, briefing_id) WHERE completed_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS maintenance_backlog_snapshot (
    snapshot_day DATE PRIMARY KEY,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    tasks JSONB NOT NULL
);

COMMIT;
