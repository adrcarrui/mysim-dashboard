BEGIN;

CREATE TABLE IF NOT EXISTS maintenance_briefing_task_execution (
    briefing_id BIGINT NOT NULL REFERENCES maintenance_briefings (id) ON DELETE CASCADE,
    source_id VARCHAR(300) NOT NULL CHECK (btrim(source_id) <> ''),
    version INTEGER NOT NULL CHECK (version > 0),
    started_at TIMESTAMPTZ,
    started_by UUID,
    running_since TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    completed_by UUID,
    active_duration INTERVAL,
    PRIMARY KEY (briefing_id, source_id),
    CHECK ((started_at IS NULL) = (started_by IS NULL)),
    CHECK ((completed_at IS NULL) = (completed_by IS NULL)),
    CHECK ((started_at IS NULL) = (active_duration IS NULL)),
    CHECK (started_at IS NOT NULL OR completed_at IS NOT NULL),
    CHECK (active_duration >= INTERVAL '0 seconds'),
    CHECK (running_since IS NULL OR (
        started_at IS NOT NULL AND completed_at IS NULL AND running_since >= started_at
    )),
    CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at)
);

COMMIT;
