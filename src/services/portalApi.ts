import type { AnalyticsSummary, Branding, ClassLocation, Template } from '../types/portal';

async function api<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const raw = await response.text();
  let json: { data?: T; error?: { message?: string } } | null;
  try {
    json = JSON.parse(raw) as { data?: T; error?: { message?: string } };
  } catch {
    json = null;
  }

  if (!response.ok) {
    const message = json?.error?.message ?? raw.slice(0, 160) ?? `Request failed (${response.status})`;
    throw new Error(message);
  }

  if (!json) {
    throw new Error('API returned non-JSON success response.');
  }

  return (json.data ?? json) as T;
}

export const portalApi = {
  getBranding: () => api<Branding>('/api/portal/branding'),
  saveBranding: (payload: Record<string, unknown>) => api<Branding>('/api/portal/branding', { method: 'PUT', body: JSON.stringify(payload) }),
  publishBranding: () => api<Branding>('/api/portal/branding?action=publish', { method: 'POST' }),
  unpublishBranding: () => api<Branding>('/api/portal/branding?action=unpublish', { method: 'POST' }),
  regenerateBrandingQrCode: () => api<Branding>('/api/portal/branding?action=regenerate-qr', { method: 'POST' }),
  deleteBranding: () => api<Branding>('/api/portal/branding?action=delete', { method: 'POST' }),
  logout: () => api<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),

  listTemplates: (status = 'all') => api<Template[]>(`/api/portal/templates?status=${encodeURIComponent(status)}`),
  createTemplate: (payload: Record<string, unknown>) => api<Template>('/api/portal/templates', { method: 'POST', body: JSON.stringify(payload) }),
  getTemplate: (id: string) => api<Template>(`/api/portal/templates?id=${encodeURIComponent(id)}`),
  updateTemplate: (id: string, payload: Record<string, unknown>) => api<Template>(`/api/portal/templates?id=${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) }),
  templateAction: (id: string, action: 'publish' | 'archive' | 'unarchive' | 'duplicate') => api<Template>(`/api/portal/templates?id=${encodeURIComponent(id)}&action=${action}`, { method: 'POST' }),

  listClassLocations: () => api<ClassLocation[]>('/api/portal/class-locations'),
  getClassLocation: (id: string) => api<ClassLocation>(`/api/portal/class-locations?id=${encodeURIComponent(id)}`),
  createClassLocation: (payload: Record<string, unknown>) => api<ClassLocation>('/api/portal/class-locations', { method: 'POST', body: JSON.stringify(payload) }),
  updateClassLocation: (id: string, payload: Record<string, unknown>) => api<ClassLocation>(`/api/portal/class-locations?id=${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteClassLocation: (id: string) => api<{ id: string }>(`/api/portal/class-locations?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),

  getAnalyticsSummary: (dateFrom: string, dateTo: string) => api<AnalyticsSummary>(`/api/portal/analytics-summary?dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}`),

  uploadAsset: (payload: { assetType: string; filename: string; contentType: string; dataBase64: string }) => api<{ url: string; pathname: string }>('/api/portal/assets-upload', { method: 'POST', body: JSON.stringify(payload) }),
};
