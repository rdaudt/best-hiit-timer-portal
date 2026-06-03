import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRemovalPlan, buildTenantBlobPrefix, normalizeEmail, runCoachRemoval } from './remove-coach.mjs';

type TableRow = Record<string, unknown>;

function createFakeDb(initial: { schemas: Record<string, string[]>; tables: Record<string, TableRow[]> }) {
  const state = {
    schemas: Object.fromEntries(Object.entries(initial.schemas).map(([table, columns]) => [table, [...columns]])),
    tables: Object.fromEntries(Object.entries(initial.tables).map(([table, rows]) => [table, rows.map((row) => ({ ...row }))])),
    calls: [] as Array<{ sql: string; args: unknown[] }>,
    mutations: [] as string[],
  };

  const execute = vi.fn(async (input: { sql: string; args?: unknown[] } | string) => {
    const sql = typeof input === 'string' ? input : input.sql;
    const args = typeof input === 'string' ? [] : input.args ?? [];
    const normalized = sql.replace(/\s+/g, ' ').trim();
    state.calls.push({ sql: normalized, args });

    if (normalized === "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'") {
      return {
        rows: Object.keys(state.schemas)
          .filter((name) => !name.startsWith('sqlite_'))
          .map((name) => ({ name })),
      };
    }

    const pragmaMatch = normalized.match(/^PRAGMA table_info\((.+)\)$/);
    if (pragmaMatch) {
      const tableName = pragmaMatch[1];
      return {
        rows: (state.schemas[tableName] ?? []).map((name) => ({ name })),
      };
    }

    if (normalized.startsWith('SELECT id, slug, owner_google_sub, owner_email, status, deleted_at FROM coach_tenants WHERE LOWER(TRIM(owner_email)) = ?')) {
      const email = String(args[0] ?? '');
      const rows = (state.tables.coach_tenants ?? [])
        .filter((row) => String(row.owner_email ?? '').trim().toLowerCase() === email)
        .sort((left, right) => String(left.created_at ?? '').localeCompare(String(right.created_at ?? '')) || String(left.id ?? '').localeCompare(String(right.id ?? '')))
        .slice(0, 2)
        .map((row) => ({
          id: row.id,
          slug: row.slug,
          owner_google_sub: row.owner_google_sub,
          owner_email: row.owner_email,
          status: row.status,
          deleted_at: row.deleted_at,
        }));
      return { rows };
    }

    const tenantCountMatch = normalized.match(/^SELECT COUNT\(\*\) AS count FROM ([a-z_]+) WHERE tenant_id = \?$/i);
    if (tenantCountMatch) {
      const tableName = tenantCountMatch[1];
      const tenantId = String(args[0] ?? '');
      const rows = (state.tables[tableName] ?? []).filter((row) => String(row.tenant_id ?? '') === tenantId);
      return { rows: [{ count: rows.length }] };
    }

    const tenantDeleteMatch = normalized.match(/^DELETE FROM ([a-z_]+) WHERE tenant_id = \?$/i);
    if (tenantDeleteMatch) {
      const tableName = tenantDeleteMatch[1];
      const tenantId = String(args[0] ?? '');
      const rows = state.tables[tableName] ?? [];
      const remaining = rows.filter((row) => String(row.tenant_id ?? '') !== tenantId);
      const deleted = rows.length - remaining.length;
      state.tables[tableName] = remaining;
      state.mutations.push(normalized);
      return { rows: [], rowsAffected: deleted };
    }

    if (normalized.startsWith('SELECT COUNT(*) AS count FROM coach_invite_codes')) {
      const email = String(args[0] ?? '');
      const workspaceId = String(args[2] ?? '');
      const rows = (state.tables.coach_invite_codes ?? []).filter((row) => {
        const issued = String(row.issued_to_email ?? '').trim().toLowerCase();
        const used = String(row.used_by_email ?? '').trim().toLowerCase();
        return issued === email || used === email || String(row.consumed_workspace_id ?? '') === workspaceId;
      });
      return { rows: [{ count: rows.length }] };
    }

    if (normalized.startsWith('DELETE FROM coach_invite_codes')) {
      const email = String(args[0] ?? '');
      const workspaceId = String(args[2] ?? '');
      const rows = state.tables.coach_invite_codes ?? [];
      const remaining = rows.filter((row) => {
        const issued = String(row.issued_to_email ?? '').trim().toLowerCase();
        const used = String(row.used_by_email ?? '').trim().toLowerCase();
        return !(issued === email || used === email || String(row.consumed_workspace_id ?? '') === workspaceId);
      });
      const deleted = rows.length - remaining.length;
      state.tables.coach_invite_codes = remaining;
      state.mutations.push(normalized);
      return { rows: [], rowsAffected: deleted };
    }

    if (normalized.startsWith('SELECT COUNT(*) AS count FROM content_jobs')) {
      const prefix = String(args[0] ?? '').replace(/%/g, '');
      const rows = (state.tables.content_jobs ?? []).filter((row) => {
        const blobUrl = String(row.blob_url ?? '');
        const blobPath = String(row.blob_pathname ?? '');
        return blobUrl.includes(prefix) || blobPath.includes(prefix);
      });
      return { rows: [{ count: rows.length }] };
    }

    if (normalized.startsWith('DELETE FROM content_jobs')) {
      const prefix = String(args[0] ?? '').replace(/%/g, '');
      const rows = state.tables.content_jobs ?? [];
      const remaining = rows.filter((row) => {
        const blobUrl = String(row.blob_url ?? '');
        const blobPath = String(row.blob_pathname ?? '');
        return !(blobUrl.includes(prefix) || blobPath.includes(prefix));
      });
      const deleted = rows.length - remaining.length;
      state.tables.content_jobs = remaining;
      state.mutations.push(normalized);
      return { rows: [], rowsAffected: deleted };
    }

    if (normalized.startsWith('UPDATE coach_tenants SET deleted_at = COALESCE(deleted_at, ?), updated_at = ? WHERE id = ?')) {
      const [deletedAt, updatedAt, workspaceId] = args;
      const row = (state.tables.coach_tenants ?? []).find((item) => String(item.id ?? '') === String(workspaceId ?? ''));
      if (row) {
        row.deleted_at = row.deleted_at ?? deletedAt;
        row.updated_at = updatedAt;
        state.mutations.push(normalized);
        return { rows: [], rowsAffected: 1 };
      }
      return { rows: [], rowsAffected: 0 };
    }

    if (normalized === 'DELETE FROM coach_tenants WHERE id = ?') {
      const workspaceId = String(args[0] ?? '');
      const rows = state.tables.coach_tenants ?? [];
      const remaining = rows.filter((row) => String(row.id ?? '') !== workspaceId);
      const deleted = rows.length - remaining.length;
      state.tables.coach_tenants = remaining;
      state.mutations.push(normalized);
      return { rows: [], rowsAffected: deleted };
    }

    throw new Error(`Unexpected SQL: ${normalized}`);
  });

  return { state, execute };
}

function createFakeBlob(initialUrls: string[]) {
  const state = {
    urls: [...initialUrls],
    listCalls: [] as Array<Record<string, unknown>>,
    delCalls: [] as Array<string[] | string>,
  };

  return {
    state,
    async list(options: { prefix?: string; cursor?: string; limit?: number }) {
      state.listCalls.push(options);
      const prefix = options.prefix ?? '';
      const blobs = state.urls
        .filter((url) => url.includes(prefix))
        .map((url) => ({ url, pathname: url.replace(/^https?:\/\/[^/]+\//, '') }));
      return { blobs, hasMore: false, cursor: undefined };
    },
    async del(urlOrPathname: string[] | string) {
      state.delCalls.push(urlOrPathname);
      const targets = new Set(Array.isArray(urlOrPathname) ? urlOrPathname : [urlOrPathname]);
      state.urls = state.urls.filter((url) => !targets.has(url) && !targets.has(url.replace(/^https?:\/\/[^/]+\//, '')));
    },
  };
}

const schemas = {
  coach_tenants: ['id', 'slug', 'owner_google_sub', 'owner_email', 'status', 'deleted_at', 'created_at', 'updated_at'],
  coach_templates: ['id', 'tenant_id', 'name'],
  coach_class_locations: ['id', 'tenant_id', 'business_name'],
  coach_social_links: ['id', 'tenant_id', 'label'],
  analytics_events: ['id', 'tenant_id', 'event_name'],
  analytics_rollup_daily: ['tenant_id', 'day_utc'],
  coach_invite_codes: ['id', 'issued_to_email', 'used_by_email', 'consumed_workspace_id'],
  content_jobs: ['id', 'blob_url', 'blob_pathname', 'deleted_at'],
};

function createFixture() {
  const db = createFakeDb({
    schemas,
    tables: {
      coach_tenants: [
        {
          id: 'tenant-1',
          slug: 'coach-one',
          owner_google_sub: 'sub-1',
          owner_email: 'coach@example.com',
          status: 'published',
          deleted_at: null,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ],
      coach_templates: [
        { id: 'template-1', tenant_id: 'tenant-1', name: 'Workout 1' },
      ],
      coach_class_locations: [
        { id: 'loc-1', tenant_id: 'tenant-1', business_name: 'Studio 1' },
      ],
      coach_social_links: [
        { id: 'social-1', tenant_id: 'tenant-1', label: 'Instagram' },
      ],
      analytics_events: [
        { id: 'event-1', tenant_id: 'tenant-1', event_name: 'app_opened' },
      ],
      analytics_rollup_daily: [
        { tenant_id: 'tenant-1', day_utc: '2026-01-01' },
      ],
      coach_invite_codes: [
        { id: 'invite-1', issued_to_email: 'coach@example.com', used_by_email: null, consumed_workspace_id: null },
        { id: 'invite-2', issued_to_email: 'other@example.com', used_by_email: 'coach@example.com', consumed_workspace_id: 'tenant-1' },
      ],
      content_jobs: [
        { id: 'job-1', blob_url: 'https://blob.vercel-storage.com/tenants/tenant-1/branding/logo.png', blob_pathname: 'tenants/tenant-1/branding/logo.png', deleted_at: null },
        { id: 'job-2', blob_url: 'https://blob.vercel-storage.com/tenants/tenant-2/branding/logo.png', blob_pathname: 'tenants/tenant-2/branding/logo.png', deleted_at: null },
      ],
    },
  });

  const blob = createFakeBlob([
    'https://blob.vercel-storage.com/tenants/tenant-1/branding/logo.png',
    'https://blob.vercel-storage.com/tenants/tenant-1/branding/qr.png',
    'https://blob.vercel-storage.com/tenants/tenant-2/branding/logo.png',
  ]);

  return { db, blob };
}

describe('remove-coach script', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes email and builds the tenant blob prefix', () => {
    expect(normalizeEmail('  Coach@Example.com  ')).toBe('coach@example.com');
    expect(buildTenantBlobPrefix('tenant-1')).toBe('tenants/tenant-1/');
  });

  it('returns missing when no workspace matches the email', async () => {
    const { db, blob } = createFixture();
    const result = await buildRemovalPlan({ db, blobClient: blob, email: 'missing@example.com', blobToken: 'token' });

    expect(result.kind).toBe('missing');
    expect(db.state.mutations).toHaveLength(0);
    expect(blob.state.listCalls).toHaveLength(0);
  });

  it('fails closed when multiple workspaces match the same email', async () => {
    const { db, blob } = createFixture();
    db.state.tables.coach_tenants.push({
      id: 'tenant-2',
      slug: 'coach-two',
      owner_google_sub: 'sub-2',
      owner_email: 'coach@example.com',
      status: 'draft',
      deleted_at: null,
      created_at: '2026-01-02T00:00:00.000Z',
      updated_at: '2026-01-02T00:00:00.000Z',
    });

    const result = await runCoachRemoval({
      db,
      blobClient: blob,
      blobToken: 'token',
      email: 'coach@example.com',
      dryRun: true,
    });

    expect(result.status).toBe('ambiguous');
    expect(db.state.mutations).toHaveLength(0);
    expect(blob.state.listCalls).toHaveLength(0);
  });

  it('builds a dry-run plan without mutating db or blobs', async () => {
    const { db, blob } = createFixture();
    const result = await runCoachRemoval({
      db,
      blobClient: blob,
      blobToken: 'token',
      email: 'coach@example.com',
      dryRun: true,
    });

    expect(result.status).toBe('dry-run');
    expect(result.plan.kind).toBe('found');
    expect(result.plan.tenantTables.map((table) => `${table.tableName}:${table.rows}`)).toEqual([
      'coach_templates:1',
      'coach_class_locations:1',
      'coach_social_links:1',
      'analytics_events:1',
      'analytics_rollup_daily:1',
    ]);
    expect(result.plan.inviteCodeCount).toBe(2);
    expect(result.plan.contentJobCount).toBe(1);
    expect(result.plan.blobUrls).toEqual([
      'https://blob.vercel-storage.com/tenants/tenant-1/branding/logo.png',
      'https://blob.vercel-storage.com/tenants/tenant-1/branding/qr.png',
    ]);
    expect(db.state.mutations).toHaveLength(0);
    expect(blob.state.delCalls).toHaveLength(0);
  });

  it('purges tenant rows, invite rows, content jobs, blobs, and the workspace row', async () => {
    const { db, blob } = createFixture();
    const result = await runCoachRemoval({
      db,
      blobClient: blob,
      blobToken: 'token',
      email: 'coach@example.com',
      confirmed: true,
    });

    expect(result.status).toBe('deleted');
    expect(db.state.tables.coach_tenants).toHaveLength(0);
    expect(db.state.tables.coach_templates).toHaveLength(0);
    expect(db.state.tables.coach_class_locations).toHaveLength(0);
    expect(db.state.tables.coach_social_links).toHaveLength(0);
    expect(db.state.tables.analytics_events).toHaveLength(0);
    expect(db.state.tables.analytics_rollup_daily).toHaveLength(0);
    expect(db.state.tables.coach_invite_codes).toHaveLength(0);
    expect(db.state.tables.content_jobs).toHaveLength(1);
    expect(db.state.tables.content_jobs[0]).toMatchObject({ id: 'job-2' });
    expect(blob.state.delCalls).toEqual([
      [
        'https://blob.vercel-storage.com/tenants/tenant-1/branding/logo.png',
        'https://blob.vercel-storage.com/tenants/tenant-1/branding/qr.png',
      ],
    ]);
  });
});
