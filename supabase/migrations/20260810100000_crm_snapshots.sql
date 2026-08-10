CREATE TABLE IF NOT EXISTS crm_snapshots (
  month_key TEXT PRIMARY KEY,
  data      JSONB        NOT NULL,
  frozen_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
