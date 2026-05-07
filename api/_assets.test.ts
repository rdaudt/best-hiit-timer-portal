import { describe, expect, it } from 'vitest';
import { buildTenantAssetPath, isTenantOwnedAsset, validateTenantAssetRefs } from './_assets';

describe('tenant asset helpers', () => {
  it('builds tenant-prefixed path', () => {
    const path = buildTenantAssetPath('tenant-1', 'branding', 'Logo Main.png');
    expect(path).toBe('tenants/tenant-1/branding/logo_main.png');
  });

  it('uses deterministic path for same tenant and asset type', () => {
    const first = buildTenantAssetPath('tenant-1', 'branding', 'asset.png');
    const second = buildTenantAssetPath('tenant-1', 'branding', 'asset.png');
    expect(first).toBe('tenants/tenant-1/branding/asset.png');
    expect(second).toBe(first);
  });

  it('rejects cross-tenant urls', () => {
    expect(isTenantOwnedAsset('https://blob.vercel-storage.com/tenants/tenant-2/branding/logo.png', 'tenant-1')).toBe(false);
    expect(validateTenantAssetRefs(['https://blob.vercel-storage.com/tenants/tenant-1/branding/logo.png'], 'tenant-1')).toBe(true);
  });
});
