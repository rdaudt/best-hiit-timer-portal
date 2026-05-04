# Implementation Progress

## Decisions Locked
- Turso is shared DB platform.
- Google auth uses Vercel-hosted OIDC flow.
- Portal repo owns portal write APIs.
- One Google user maps to one workspace in v1.

## Phase Checklist
- [x] Phase 0-1: Foundation + Auth shell
- [x] Phase 2: Turso data + portal write APIs
- [x] Phase 3: Blob storage tenant safety
- [x] Phase 4: Portal UI features
- [x] Phase 5: Coach-scoped analytics
- [x] Phase 6: Hardening + launch readiness

## Phase 4 Outcomes
- Implemented portal app shell with protected navigation.
- Added Dashboard, Branding, Templates list, and Template Editor pages.
- Wired UI flows to portal APIs for branding save/publish and template lifecycle actions.
- Added tenant asset uploads in branding UX.

## Phase 5 Outcomes
- Added tenant-aware analytics ingestion endpoint.
- Added cron-secured daily analytics rollup endpoint.
- Added authenticated, workspace-scoped analytics summary endpoint with date filtering.
- Wired dashboard date-range filters and trend/metric rendering.

## Phase 6 Outcomes
- Hardened Google OIDC callback with JWT signature verification via Google JWKS.
- Added analytics and tenant-safety endpoint tests.
- Added operational runbook and final env matrix.
- Added analytics DB indexes and tenant-safe query patterns.

## Test Outcomes
- `npm run lint` passes.
- `npm run test` passes.
- `npm run build` passes.

## Residual Risks
- Analytics ingest assumes slug is provided correctly by timer app integration; rollout should include contract validation in timer app.
- Asset upload currently uses base64 API relay; direct signed uploads may be preferable at scale.