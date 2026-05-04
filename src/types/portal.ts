export type Branding = {
  id: string;
  slug: string;
  businessName: string;
  coachName: string;
  bio: string;
  logoUrl: string;
  coachPhotoUrl: string;
  qrCodeUrl: string;
  themePrimaryColor: string;
  themeSecondaryColor: string;
  brandHeadline: string;
  status: string;
  updatedAt: string;
  publishedAt: string | null;
};

export type Template = {
  id: string;
  tenantId: string;
  name: string;
  stationCount: number;
  stationWorkoutTypes: string[];
  roundsPerStation: number;
  workMinutes: number;
  workSeconds: number;
  restMinutes: number;
  restSeconds: number;
  stationTransitionMinutes: number;
  stationTransitionSeconds: number;
  startStationWorkManually: boolean;
  warmupEnabled: boolean;
  warmupMinutes: number;
  warmupSeconds: number;
  cooldownEnabled: boolean;
  cooldownMinutes: number;
  cooldownSeconds: number;
  status: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  archivedAt: string | null;
};

export type AnalyticsSummary = {
  totals: {
    appOpened: number;
    timersCreated: number;
    timerRunsCompleted: number;
    timerRunsIncomplete: number;
    timersCreatedFromTemplates: number;
  } & Record<string, number>;
  averages: Record<string, number>;
  trend: Array<{ dayUtc: string; appOpened: number; runsCompleted: number; runsIncomplete: number }>;
};