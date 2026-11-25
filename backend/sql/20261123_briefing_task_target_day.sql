ALTER TABLE maintenance_briefing_items
    ADD COLUMN IF NOT EXISTS target_day DATE;
