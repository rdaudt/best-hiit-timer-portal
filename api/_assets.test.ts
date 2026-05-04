import { describe, expect, it } from 'vitest';
import { buildTenantAssetPath, isTenantOwnedAsset, validateTenantAssetRefs } from './_assets';

describe('tenant asset helpers', () => {
  it('builds tenant-prefixed path', () => {
    const path = buildTenantAssetPath('tenant-1', 'branding', 'Logo Main.png');
    expect(path.startsWith('tenants/tenant-1/branding/')).toBe(true);
  });

  it('rejects cross-tenant urls', () => {
    expect(isTenantOwnedAsset('https://blob.vercel-storage.com/tenants/tenant-2/branding/logo.png', 'tenant-1')).toBe(false);
    expect(validateTenantAssetRefs(['https://blob.vercel-storage.com/tenants/tenant-1/branding/logo.png'], 'tenant-1')).toBe(true);
  });
});