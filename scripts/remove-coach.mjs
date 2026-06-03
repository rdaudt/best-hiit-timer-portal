import { createClient } from '@libsql/client';
import { del, list } from '@vercel/blob';
import { fileURLToPath } from 'node:url';

const DEFAULT_LIST_LIMIT = 1000;

const requireEnv = (name) => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

export function buildTenantBlobPrefix(workspaceId) {
  return `tenants/${workspaceId}/`;
}

export function extractBlobPath(value) {
  if (!value) {
    return '';
  }

  try {
    const parsed = new URL(value);
    return parsed.pathname.replace(/^\/+/, '');
  } catch {
    return value.replace(/^\/+/, '');
  }
}

function isTenantBlobValue(value, workspaceId) {
  const prefix = buildTenantBlobPrefix(workspaceId);
  const path = extractBlobPath(value);
  return path.startsWith(prefix);
}

async function execute(db, sql, args = []) {
  return db.execute({ sql, args });
}

export function createDefaultDb() {
  return createClient({
    url: requireEnv('TURSO_DATABASE_URL'),
    authToken: requireEnv('TURSO_AUTH_TOKEN'),
  });
}

export function createDefaultBlobClient() {
  return {
    list: (options) => list({ ...options, token: requireEnv('BLOB_READ_WRITE_TOKEN') }),
    del: (urlOrPathname) => del(urlOrPathname, { token: requireEnv('BLOB_READ_WRITE_TOKEN') }),
  };
}

async function listTableNames(db) {
  const result = await execute(db, "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'");
  return result.rows.map((row) => String(row.name));
}

async function listTableColumns(db, tableName) {
  const result = await execute(db, `PRAGMA table_info(${tableName})`);
  return result.rows.map((row) => String(row.name));
}

async function resolveWorkspaceByEmail(db, normalizedEmail) {
  const result = await execute(
    db,
    `
      SELECT id, slug, owner_google_sub, owner_email, status, deleted_at
      FROM coach_tenants
      WHERE LOWER(TRIM(owner_email)) = ?
      ORDER BY created_at ASC, id ASC
      LIMIT 2
    `,
    [normalizedEmail],
  );

  if (result.rows.length === 0) {
    return { kind: 'missing' };
  }

  if (result.rows.length > 1) {
    return { kind: 'ambiguous' };
  }

  const row = result.rows[0];
  return {
    kind: 'found',
    workspace: {
      id: String(row.id),
      slug: String(row.slug),
      ownerGoogleSub: String(row.owner_google_sub),
      ownerEmail: String(row.owner_email),
      status: String(row.status ?? 'draft'),
      deletedAt: row.deleted_at ? String(row.deleted_at) : null,
    },
  };
}

async function discoverTenantTables(db, tableNames) {
  const tables = [];
  for (const tableName of tableNames) {
    if (tableName === 'coach_tenants') {
      continue;
    }
    const columns = await listTableColumns(db, tableName);
    if (columns.includes('tenant_id')) {
      tables.push(tableName);
    }
  }
  return tables;
}

async function countRows(db, sql, args = []) {
  const result = await execute(db, sql, args);
  return Number(result.rows[0]?.count ?? 0);
}

async function countRowsByTenant(db, tableName, workspaceId) {
  return countRows(db, `SELECT COUNT(*) AS count FROM ${tableName} WHERE tenant_id = ?`, [workspaceId]);
}

async function deleteRowsByTenant(db, tableName, workspaceId) {
  const result = await execute(db, `DELETE FROM ${tableName} WHERE tenant_id = ?`, [workspaceId]);
  return Number(result.rowsAffected ?? 0);
}

async function countInviteRows(db, normalizedEmail, workspaceId) {
  return countRows(
    db,
    `
      SELECT COUNT(*) AS count
      FROM coach_invite_codes
      WHERE LOWER(TRIM(issued_to_email)) = ?
         OR LOWER(TRIM(used_by_email)) = ?
         OR consumed_workspace_id = ?
    `,
    [normalizedEmail, normalizedEmail, workspaceId],
  );
}

async function deleteInviteRows(db, normalizedEmail, workspaceId) {
  const result = await execute(
    db,
    `
      DELETE FROM coach_invite_codes
      WHERE LOWER(TRIM(issued_to_email)) = ?
         OR LOWER(TRIM(used_by_email)) = ?
         OR consumed_workspace_id = ?
    `,
    [normalizedEmail, normalizedEmail, workspaceId],
  );
  return Number(result.rowsAffected ?? 0);
}

async function countContentJobRows(db, workspaceId) {
  const prefix = buildTenantBlobPrefix(workspaceId);
  const like = `%${prefix}%`;
  return countRows(
    db,
    `
      SELECT COUNT(*) AS count
      FROM content_jobs
      WHERE COALESCE(blob_url, '') LIKE ?
         OR COALESCE(blob_pathname, '') LIKE ?
    `,
    [like, like],
  );
}

async function deleteContentJobRows(db, workspaceId) {
  const prefix = buildTenantBlobPrefix(workspaceId);
  const like = `%${prefix}%`;
  const result = await execute(
    db,
    `
      DELETE FROM content_jobs
      WHERE COALESCE(blob_url, '') LIKE ?
         OR COALESCE(blob_pathname, '') LIKE ?
    `,
    [like, like],
  );
  return Number(result.rowsAffected ?? 0);
}

async function markWorkspaceDeleted(db, workspaceId) {
  const timestamp = new Date().toISOString();
  await execute(
    db,
    `
      UPDATE coach_tenants
      SET deleted_at = COALESCE(deleted_at, ?),
          updated_at = ?
      WHERE id = ?
    `,
    [timestamp, timestamp, workspaceId],
  );
}

async function hardDeleteWorkspace(db, workspaceId) {
  const result = await execute(db, 'DELETE FROM coach_tenants WHERE id = ?', [workspaceId]);
  return Number(result.rowsAffected ?? 0);
}

async function listTenantBlobUrls(blobClient, workspaceId, blobToken) {
  const prefix = buildTenantBlobPrefix(workspaceId);
  const urls = [];
  let cursor;

  while (true) {
    const page = await blobClient.list({
      prefix,
      cursor,
      limit: DEFAULT_LIST_LIMIT,
      token: blobToken,
    });

    for (const blob of page.blobs) {
      if (isTenantBlobValue(blob.url, workspaceId) || isTenantBlobValue(blob.pathname, workspaceId)) {
        urls.push(blob.url);
      }
    }

    if (!page.hasMore || !page.cursor) {
      break;
    }
    cursor = page.cursor;
  }

  return urls;
}

async function deleteTenantBlobs(blobClient, urls) {
  if (urls.length === 0) {
    return 0;
  }

  await blobClient.del(urls);
  return urls.length;
}

export async function buildRemovalPlan({
  db = createDefaultDb(),
  blobClient = createDefaultBlobClient(),
  blobToken = process.env.BLOB_READ_WRITE_TOKEN?.trim(),
  email,
}) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new Error('Email is required.');
  }

  const workspaceResult = await resolveWorkspaceByEmail(db, normalizedEmail);
  if (workspaceResult.kind === 'missing') {
    return { kind: 'missing', normalizedEmail };
  }
  if (workspaceResult.kind === 'ambiguous') {
    return { kind: 'ambiguous', normalizedEmail };
  }

  const { workspace } = workspaceResult;
  const tableNames = await listTableNames(db);
  const tenantTables = await discoverTenantTables(db, tableNames);
  const blobUrls = await listTenantBlobUrls(blobClient, workspace.id, blobToken);

  const tenantTableCounts = [];
  for (const tableName of tenantTables) {
    tenantTableCounts.push({
      tableName,
      rows: await countRowsByTenant(db, tableName, workspace.id),
    });
  }

  return {
    kind: 'found',
    normalizedEmail,
    workspace,
    tenantTables: tenantTableCounts,
    inviteCodeCount: tableNames.includes('coach_invite_codes') ? await countInviteRows(db, normalizedEmail, workspace.id) : 0,
    contentJobCount: tableNames.includes('content_jobs') ? await countContentJobRows(db, workspace.id) : 0,
    blobPrefix: buildTenantBlobPrefix(workspace.id),
    blobUrls,
  };
}

export async function executeRemovalPlan({
  db = createDefaultDb(),
  blobClient = createDefaultBlobClient(),
  plan,
}) {
  if (plan.kind !== 'found') {
    return { status: plan.kind };
  }

  await markWorkspaceDeleted(db, plan.workspace.id);

  const deletedRows = [];
  for (const table of plan.tenantTables) {
    deletedRows.push({
      tableName: table.tableName,
      rows: await deleteRowsByTenant(db, table.tableName, plan.workspace.id),
    });
  }

  let inviteRowsDeleted = 0;
  if (plan.inviteCodeCount > 0) {
    inviteRowsDeleted = await deleteInviteRows(db, plan.normalizedEmail, plan.workspace.id);
  }

  let contentJobRowsDeleted = 0;
  if (plan.contentJobCount > 0) {
    contentJobRowsDeleted = await deleteContentJobRows(db, plan.workspace.id);
  }

  const blobsDeleted = await deleteTenantBlobs(blobClient, plan.blobUrls);
  const workspaceRowsDeleted = await hardDeleteWorkspace(db, plan.workspace.id);

  return {
    status: 'deleted',
    workspaceId: plan.workspace.id,
    workspaceSlug: plan.workspace.slug,
    deletedRows,
    inviteRowsDeleted,
    contentJobRowsDeleted,
    blobsDeleted,
    workspaceRowsDeleted,
  };
}

export async function runCoachRemoval({
  db = createDefaultDb(),
  blobClient = createDefaultBlobClient(),
  blobToken = process.env.BLOB_READ_WRITE_TOKEN?.trim(),
  email,
  dryRun = false,
  confirmed = false,
}) {
  if (!dryRun && !confirmed) {
    return { status: 'needs-confirmation' };
  }

  const plan = await buildRemovalPlan({ db, blobClient, blobToken, email });
  if (plan.kind === 'missing' || plan.kind === 'ambiguous') {
    return { status: plan.kind, plan };
  }

  if (dryRun) {
    return { status: 'dry-run', plan };
  }

  const result = await executeRemovalPlan({ db, blobClient, plan });
  return { status: 'deleted', plan, result };
}

export function parseArgs(argv) {
  const args = {
    email: '',
    dryRun: false,
    confirmed: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--email') {
      args.email = argv[i + 1] ?? '';
      i += 1;
      continue;
    }
    if (value.startsWith('--email=')) {
      args.email = value.slice('--email='.length);
      continue;
    }
    if (value === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (value === '--yes' || value === '--confirm') {
      args.confirmed = true;
      continue;
    }
    if (value === '--help' || value === '-h') {
      args.help = true;
    }
  }

  return args;
}

export async function main(argv = process.argv.slice(2), io = console) {
  const args = parseArgs(argv);
  if (args.help || !args.email) {
    io.log('Usage: node scripts/remove-coach.mjs --email coach@example.com [--dry-run] [--yes|--confirm]');
    return args.help ? 0 : 1;
  }

  if (!args.dryRun && !args.confirmed) {
    io.error('Refusing to run destructive purge without --yes or --confirm.');
    return 1;
  }

  const outcome = await runCoachRemoval({
    email: args.email,
    dryRun: args.dryRun,
    confirmed: args.confirmed,
  });

  if (outcome.status === 'needs-confirmation') {
    io.error('Refusing to run destructive purge without --yes or --confirm.');
    return 1;
  }

  if (outcome.status === 'missing') {
    io.log(`No coach found for ${outcome.plan.normalizedEmail}. Nothing to delete.`);
    return 0;
  }
  if (outcome.status === 'ambiguous') {
    io.error(`Multiple coaches match ${outcome.plan.normalizedEmail}. Aborting.`);
    return 1;
  }

  const { plan } = outcome;
  io.log(`Resolved workspace ${plan.workspace.id} (${plan.workspace.slug}) for ${plan.normalizedEmail}.`);
  io.log(`Tenant tables: ${plan.tenantTables.map((table) => `${table.tableName}=${table.rows}`).join(', ') || 'none'}`);
  io.log(`Invite codes: ${plan.inviteCodeCount}`);
  io.log(`Content jobs: ${plan.contentJobCount}`);
  io.log(`Blob objects: ${plan.blobUrls.length} under ${plan.blobPrefix}`);

  if (outcome.status === 'dry-run') {
    io.log('Dry run only. No data was changed.');
    return 0;
  }

  const result = outcome.result;
  io.log(`Deleted workspace ${result.workspaceSlug}.`);
  io.log(`Blobs deleted: ${result.blobsDeleted}`);
  return 0;
}

const isEntryPoint = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isEntryPoint) {
  main().then((code) => {
    process.exitCode = code;
  }).catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
