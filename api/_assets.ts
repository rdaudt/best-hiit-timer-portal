const ASSET_BASE_PREFIX = 'tenants';

const normalizePath = (value: string) => value.replace(/^\/+/, '');

export function buildTenantAssetPath(workspaceId: string, assetType: string, filename: string) {
  const safeType = assetType.replace(/[^a-z0-9_-]/gi, '').toLowerCase() || 'generic';
  const safeName = filename.replace(/[^a-z0-9._-]/gi, '_').toLowerCase() || 'asset.bin';
  return `${ASSET_BASE_PREFIX}/${workspaceId}/${safeType}/${safeName}`;
}

export function getTenantPrefix(workspaceId: string) {
  return `${ASSET_BASE_PREFIX}/${workspaceId}/`;
}

export function extractPathFromAssetUrl(value: string): string {
  if (!value) {
    return '';
  }
  try {
    const parsed = new URL(value);
    return normalizePath(parsed.pathname);
  } catch {
    return normalizePath(value);
  }
}

export function isTenantOwnedAsset(value: string, workspaceId: string): boolean {
  if (!value) {
    return true;
  }
  const path = extractPathFromAssetUrl(value);
  return path.startsWith(getTenantPrefix(workspaceId));
}

export function validateTenantAssetRefs(values: string[], workspaceId: string) {
  for (const value of values) {
    if (!isTenantOwnedAsset(value, workspaceId)) {
      return false;
    }
  }
  return true;
}
