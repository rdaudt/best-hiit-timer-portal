export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  branding: {
    current: ['branding', 'current'] as const,
  },
  classLocations: {
    list: ['classLocations', 'list'] as const,
    detail: (id: string) => ['classLocations', 'detail', id] as const,
  },
};
