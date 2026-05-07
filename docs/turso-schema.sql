CREATE TABLE IF NOT EXISTS content_jobs (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  error_message TEXT,
  blob_url TEXT,
  blob_pathname TEXT,
  view_token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS coach_tenants (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  owner_google_sub TEXT NOT NULL UNIQUE,
  owner_email TEXT NOT NULL,
  business_name TEXT NOT NULL,
  coach_name TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  logo_url TEXT NOT NULL DEFAULT '',
  coach_photo_url TEXT NOT NULL DEFAULT '',
  coach_header_image_url TEXT NOT NULL DEFAULT '',
  header_tagline TEXT NOT NULL DEFAULT '',
  ig_username TEXT NOT NULL DEFAULT '',
  tiktok_username TEXT NOT NULL DEFAULT '',
  qr_code_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT,
  deleted_at TEXT,
  deleted_by_google_sub TEXT,
  deleted_by_email TEXT,
  theme_primary_color TEXT NOT NULL DEFAULT '#f97316',
  theme_secondary_color TEXT NOT NULL DEFAULT '#111827',
  brand_headline TEXT NOT NULL DEFAULT '',
  updated_by_google_sub TEXT,
  updated_by_email TEXT
);

CREATE TABLE IF NOT EXISTS coach_social_links (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS coach_templates (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  station_count INTEGER NOT NULL,
  station_workout_types_json TEXT NOT NULL DEFAULT '[]',
  rounds_per_station INTEGER NOT NULL,
  work_minutes INTEGER NOT NULL,
  work_seconds INTEGER NOT NULL,
  rest_minutes INTEGER NOT NULL,
  rest_seconds INTEGER NOT NULL,
  station_transition_minutes INTEGER NOT NULL,
  station_transition_seconds INTEGER NOT NULL,
  start_station_work_manually INTEGER NOT NULL DEFAULT 0,
  warmup_enabled INTEGER NOT NULL DEFAULT 0,
  warmup_minutes INTEGER NOT NULL DEFAULT 0,
  warmup_seconds INTEGER NOT NULL DEFAULT 0,
  cooldown_enabled INTEGER NOT NULL DEFAULT 0,
  cooldown_minutes INTEGER NOT NULL DEFAULT 0,
  cooldown_seconds INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT,
  archived_at TEXT,
  updated_by_google_sub TEXT,
  updated_by_email TEXT
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS analytics_rollup_daily (
  tenant_id TEXT NOT NULL,
  day_utc TEXT NOT NULL,
  app_opened_count INTEGER NOT NULL DEFAULT 0,
  timer_created_count INTEGER NOT NULL DEFAULT 0,
  timer_run_completed_count INTEGER NOT NULL DEFAULT 0,
  timer_run_incomplete_count INTEGER NOT NULL DEFAULT 0,
  timer_created_from_template_count INTEGER NOT NULL DEFAULT 0,
  total_timer_duration_sec_sum INTEGER NOT NULL DEFAULT 0,
  station_count_sum INTEGER NOT NULL DEFAULT 0,
  rounds_per_station_sum INTEGER NOT NULL DEFAULT 0,
  work_sec_sum INTEGER NOT NULL DEFAULT 0,
  rest_sec_sum INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, day_utc)
);

CREATE INDEX IF NOT EXISTS idx_content_jobs_run_id_created ON content_jobs (run_id, created_at);
CREATE INDEX IF NOT EXISTS idx_content_jobs_status_updated ON content_jobs (status, updated_at);
CREATE INDEX IF NOT EXISTS idx_coach_tenants_slug ON coach_tenants (slug);
CREATE INDEX IF NOT EXISTS idx_coach_tenants_owner_sub ON coach_tenants (owner_google_sub);
CREATE INDEX IF NOT EXISTS idx_coach_tenants_slug_status ON coach_tenants (slug, status);
CREATE INDEX IF NOT EXISTS idx_coach_social_links_tenant_sort ON coach_social_links (tenant_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_coach_templates_tenant_status_sort ON coach_templates (tenant_id, status, sort_order);
CREATE INDEX IF NOT EXISTS idx_analytics_events_name ON analytics_events (event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_events_tenant_time ON analytics_events (tenant_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_analytics_rollup_tenant_day ON analytics_rollup_daily (tenant_id, day_utc);
