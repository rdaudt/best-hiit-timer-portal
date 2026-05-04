import { createClient } from '@libsql/client/web';

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

const addColumnIfMissing = async (table: string, columnDef: string, columnName: string) => {
  if (await hasColumn(table, columnName)) {
    return;
  }
  const db = getDb();
  await db.execute(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
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
        qr_code_url TEXT NOT NULL DEFAULT '',
        theme_primary_color TEXT NOT NULL DEFAULT '#f97316',
        theme_secondary_color TEXT NOT NULL DEFAULT '#111827',
        brand_headline TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        published_at TEXT,
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
    `CREATE INDEX IF NOT EXISTS idx_coach_templates_tenant_status_sort ON coach_templates (tenant_id, status, sort_order);`,
  ], 'write');

  await addColumnIfMissing('coach_tenants', "bio TEXT NOT NULL DEFAULT ''", 'bio');
  await addColumnIfMissing('coach_tenants', "logo_url TEXT NOT NULL DEFAULT ''", 'logo_url');
  await addColumnIfMissing('coach_tenants', "coach_photo_url TEXT NOT NULL DEFAULT ''", 'coach_photo_url');
  await addColumnIfMissing('coach_tenants', "qr_code_url TEXT NOT NULL DEFAULT ''", 'qr_code_url');
  await addColumnIfMissing('coach_tenants', "theme_primary_color TEXT NOT NULL DEFAULT '#f97316'", 'theme_primary_color');
  await addColumnIfMissing('coach_tenants', "theme_secondary_color TEXT NOT NULL DEFAULT '#111827'", 'theme_secondary_color');
  await addColumnIfMissing('coach_tenants', "brand_headline TEXT NOT NULL DEFAULT ''", 'brand_headline');
  await addColumnIfMissing('coach_tenants', 'published_at TEXT', 'published_at');
  await addColumnIfMissing('coach_tenants', 'updated_by_google_sub TEXT', 'updated_by_google_sub');
  await addColumnIfMissing('coach_tenants', 'updated_by_email TEXT', 'updated_by_email');

  await addColumnIfMissing('coach_templates', 'published_at TEXT', 'published_at');
  await addColumnIfMissing('coach_templates', 'archived_at TEXT', 'archived_at');
  await addColumnIfMissing('coach_templates', 'updated_by_google_sub TEXT', 'updated_by_google_sub');
  await addColumnIfMissing('coach_templates', 'updated_by_email TEXT', 'updated_by_email');
}

export async function findWorkspaceByGoogleSub(sub: string) {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT id, slug FROM coach_tenants WHERE owner_google_sub = ? LIMIT 1`,
    args: [sub],
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