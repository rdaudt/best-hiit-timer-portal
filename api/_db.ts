import { createClient } from '@libsql/client';
import { randomUUID } from 'node:crypto';

let cachedClient: ReturnType<typeof createClient> | null = null;

const requireEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export const getDb = () => {
  if (cachedClient) {
    return cachedClient;
  }

  cachedClient = createClient({
    url: requireEnv('TURSO_DATABASE_URL'),
    authToken: requireEnv('TURSO_AUTH_TOKEN'),
  });

  return cachedClient;
};

const hasColumn = async (table: string, column: string): Promise<boolean> => {
  const db = getDb();
  const result = await db.execute(`PRAGMA table_info(${table})`);
  return result.rows.some((row) => String((row as Record<string, unknown>).name) === column);
};

const addColumnIfMissing = async (table: string, columnDef: string, columnName: string): Promise<boolean> => {
  if (await hasColumn(table, columnName)) {
    return false;
  }
  const db = getDb();
  await db.execute(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
  return true;
};

export async function createCoachTenantTablesIfNeeded() {
  const db = getDb();
  await db.batch([
    `
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
        theme_primary_color TEXT NOT NULL DEFAULT '#f97316',
        theme_secondary_color TEXT NOT NULL DEFAULT '#111827',
        brand_headline TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        published_at TEXT,
        deleted_at TEXT,
        deleted_by_google_sub TEXT,
        deleted_by_email TEXT,
        updated_by_google_sub TEXT,
        updated_by_email TEXT
      );
    `,
    `
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
    `,
    `CREATE INDEX IF NOT EXISTS idx_coach_tenants_owner_sub ON coach_tenants(owner_google_sub);`,
    `CREATE INDEX IF NOT EXISTS idx_coach_tenants_slug ON coach_tenants(slug);`,
    `CREATE INDEX IF NOT EXISTS idx_coach_templates_tenant_status_sort ON coach_templates (tenant_id, status, sort_order);`,
    `
      CREATE TABLE IF NOT EXISTS coach_class_locations (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        business_name TEXT NOT NULL,
        location_name TEXT NOT NULL,
        logo_url TEXT NOT NULL DEFAULT '',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        updated_by_google_sub TEXT,
        updated_by_email TEXT
      );
    `,
    `CREATE INDEX IF NOT EXISTS idx_class_locations_tenant ON coach_class_locations(tenant_id, sort_order, updated_at);`,
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_class_locations_tenant_names ON coach_class_locations(tenant_id, LOWER(business_name), LOWER(location_name));`,
  ], 'write');

  await addColumnIfMissing('coach_tenants', "bio TEXT NOT NULL DEFAULT ''", 'bio');
  await addColumnIfMissing('coach_tenants', "logo_url TEXT NOT NULL DEFAULT ''", 'logo_url');
  await addColumnIfMissing('coach_tenants', "coach_photo_url TEXT NOT NULL DEFAULT ''", 'coach_photo_url');
  await addColumnIfMissing('coach_tenants', "coach_header_image_url TEXT NOT NULL DEFAULT ''", 'coach_header_image_url');
  await addColumnIfMissing('coach_tenants', "header_tagline TEXT NOT NULL DEFAULT ''", 'header_tagline');
  await addColumnIfMissing('coach_tenants', "ig_username TEXT NOT NULL DEFAULT ''", 'ig_username');
  await addColumnIfMissing('coach_tenants', "tiktok_username TEXT NOT NULL DEFAULT ''", 'tiktok_username');
  await addColumnIfMissing('coach_tenants', "qr_code_url TEXT NOT NULL DEFAULT ''", 'qr_code_url');
  await addColumnIfMissing('coach_tenants', "theme_primary_color TEXT NOT NULL DEFAULT '#f97316'", 'theme_primary_color');
  await addColumnIfMissing('coach_tenants', "theme_secondary_color TEXT NOT NULL DEFAULT '#111827'", 'theme_secondary_color');
  await addColumnIfMissing('coach_tenants', "brand_headline TEXT NOT NULL DEFAULT ''", 'brand_headline');
  await addColumnIfMissing('coach_tenants', 'published_at TEXT', 'published_at');
  await addColumnIfMissing('coach_tenants', 'deleted_at TEXT', 'deleted_at');
  await addColumnIfMissing('coach_tenants', 'deleted_by_google_sub TEXT', 'deleted_by_google_sub');
  await addColumnIfMissing('coach_tenants', 'deleted_by_email TEXT', 'deleted_by_email');
  await addColumnIfMissing('coach_tenants', 'updated_by_google_sub TEXT', 'updated_by_google_sub');
  await addColumnIfMissing('coach_tenants', 'updated_by_email TEXT', 'updated_by_email');

  await addColumnIfMissing('coach_templates', 'published_at TEXT', 'published_at');
  await addColumnIfMissing('coach_templates', 'archived_at TEXT', 'archived_at');
  await addColumnIfMissing('coach_templates', 'updated_by_google_sub TEXT', 'updated_by_google_sub');
  await addColumnIfMissing('coach_templates', 'updated_by_email TEXT', 'updated_by_email');

  const isDefaultAdded = await addColumnIfMissing('coach_class_locations', 'is_default INTEGER NOT NULL DEFAULT 0', 'is_default');
  if (isDefaultAdded) {
    await db.execute(`
      UPDATE coach_class_locations
      SET is_default = 1
      WHERE id IN (
        SELECT (
          SELECT id FROM coach_class_locations
          WHERE tenant_id = t.tenant_id
          ORDER BY sort_order ASC, created_at ASC
          LIMIT 1
        )
        FROM (
          SELECT DISTINCT tenant_id
          FROM coach_class_locations
          WHERE NOT EXISTS (
            SELECT 1 FROM coach_class_locations cl2
            WHERE cl2.tenant_id = coach_class_locations.tenant_id AND cl2.is_default = 1
          )
        ) t
      )
    `);
  }
}

export async function createAnalyticsTablesIfNeeded() {
  const db = getDb();
  await db.batch([
    `
      CREATE TABLE IF NOT EXISTS analytics_events (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        event_name TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        payload_json TEXT NOT NULL DEFAULT '{}'
      );
    `,
    `
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
    `,
    `CREATE INDEX IF NOT EXISTS idx_analytics_events_tenant_time ON analytics_events(tenant_id, occurred_at);`,
    `CREATE INDEX IF NOT EXISTS idx_analytics_events_name ON analytics_events(event_name);`,
    `CREATE INDEX IF NOT EXISTS idx_analytics_rollup_tenant_day ON analytics_rollup_daily(tenant_id, day_utc);`,
  ], 'write');
}

export async function findWorkspaceByGoogleSub(sub: string) {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT id, slug, deleted_at FROM coach_tenants WHERE owner_google_sub = ? LIMIT 1`,
    args: [sub],
  });
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    return null;
  }

  return {
    workspaceId: String(row.id),
    workspaceSlug: String(row.slug),
    deletedAt: row.deleted_at ? String(row.deleted_at) : null,
  };
}

export async function findWorkspaceBySlug(slug: string) {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT id, slug FROM coach_tenants WHERE slug = ? AND deleted_at IS NULL LIMIT 1`,
    args: [slug],
  });
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    return null;
  }

  return {
    workspaceId: String(row.id),
    workspaceSlug: String(row.slug),
  };
}

export async function workspaceSlugExists(slug: string) {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT 1 AS exists_flag FROM coach_tenants WHERE slug = ? LIMIT 1`,
    args: [slug],
  });
  return result.rows.length > 0;
}

type CreateWorkspaceArgs = {
  ownerGoogleSub: string;
  ownerEmail: string;
  slug: string;
  initialCoachName?: string;
};

export async function createWorkspaceForOwner(args: CreateWorkspaceArgs) {
  const db = getDb();
  const now = new Date().toISOString();
  const emailPrefix = args.ownerEmail.split('@')[0]?.trim() ?? '';
  const coachName = args.initialCoachName?.trim() || emailPrefix || 'Coach';
  const businessName = `${coachName} Fitness`;
  const id = randomUUID();

  await db.execute({
    sql: `
      INSERT INTO coach_tenants (
        id, slug, owner_google_sub, owner_email, business_name, coach_name, bio,
        logo_url, coach_photo_url, coach_header_image_url, header_tagline, ig_username, tiktok_username, qr_code_url, theme_primary_color,
        theme_secondary_color, brand_headline, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, '', '', '', '', '', '', '', '', '#f97316', '#111827', '', 'draft', ?, ?)
    `,
    args: [id, args.slug, args.ownerGoogleSub, args.ownerEmail, businessName, coachName, now, now],
  });

  return {
    workspaceId: id,
    workspaceSlug: args.slug,
    deletedAt: null,
  };
}

export async function updateWorkspaceQrCodeUrl(workspaceId: string, qrCodeUrl: string) {
  const db = getDb();
  await db.execute({
    sql: `UPDATE coach_tenants SET qr_code_url = ?, updated_at = ? WHERE id = ?`,
    args: [qrCodeUrl, new Date().toISOString(), workspaceId],
  });
}
