-- E2B template auto-bake queue (internal)
-- Stores npm packages that were auto-installed at runtime and should be baked into the E2B template.

CREATE TABLE IF NOT EXISTS e2b_template_bake_queue (
  package_name TEXT PRIMARY KEY,
  dep_type TEXT NOT NULL DEFAULT 'dependency', -- dependency | devDependency
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  seen_count INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | baked | failed | ignored
  last_error TEXT,
  baked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_e2b_template_bake_queue_status ON e2b_template_bake_queue(status);
CREATE INDEX IF NOT EXISTS idx_e2b_template_bake_queue_last_seen_at ON e2b_template_bake_queue(last_seen_at DESC);

-- Keep the table private (server-only). Service role bypasses RLS.
ALTER TABLE e2b_template_bake_queue ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'e2b_template_bake_queue_dep_type_check'
  ) THEN
    ALTER TABLE e2b_template_bake_queue
      ADD CONSTRAINT e2b_template_bake_queue_dep_type_check
      CHECK (dep_type IN ('dependency', 'devDependency'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'e2b_template_bake_queue_status_check'
  ) THEN
    ALTER TABLE e2b_template_bake_queue
      ADD CONSTRAINT e2b_template_bake_queue_status_check
      CHECK (status IN ('pending', 'baked', 'failed', 'ignored'));
  END IF;
END $$;

