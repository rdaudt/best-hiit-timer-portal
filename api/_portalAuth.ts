import { createCoachTenantTablesIfNeeded, findWorkspaceByGoogleSub } from './_db.js';
import { parseSession } from './_session.js';

export type NodeReq = { headers?: Record<string, string | string[] | undefined> };

export async function requirePortalSession(req: NodeReq) {
  const session = parseSession(req);
  if (!session) {
    return { ok: false as const, status: 401, body: { error: 'Unauthorized' } };
  }

  await createCoachTenantTablesIfNeeded();
  const workspace = await findWorkspaceByGoogleSub(session.sub);
  if (!workspace) {
    return { ok: false as const, status: 403, body: { error: 'No workspace linked to this account.' } };
  }
  if (workspace.deletedAt) {
    return { ok: false as const, status: 403, body: { error: 'Workspace is not available.' } };
  }

  return {
    ok: true as const,
    session: {
      ...session,
      workspaceId: workspace.workspaceId,
      workspaceSlug: workspace.workspaceSlug,
    },
  };
}
