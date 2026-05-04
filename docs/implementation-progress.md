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
- [ ] Phase 4: Portal UI features
- [ ] Phase 5: Coach-scoped analytics
- [ ] Phase 6: Hardening + launch readiness

## Phase 0-1 Outcomes
- Scaffolded React+TS+Vite app with lint/test/build scripts.
- Added Vitest + Testing Library baseline.
- Added CI workflow running lint/test/build.
- Added `.env.example` and README architecture summary.
- Implemented auth shell with protected route + sign-in/out UX.
- Implemented API auth session endpoints and workspace guard endpoint.

## Phase 2 Outcomes
- Aligned Turso schema for portal admin fields and audit metadata in `coach_tenants` and `coach_templates`.
- Added column-safe migration logic (`ALTER TABLE ... ADD COLUMN` when missing).
- Added standardized API error envelope.
- Added portal branding API (`GET`, `PUT`, `POST?action=publish`) with optimistic concurrency check.
- Added portal templates APIs for list/create, detail/update, and lifecycle actions (publish/archive/unarchive/duplicate).
- Enforced workspace-scoped SQL predicates for all template/branding writes and reads.
- Added API contract doc and endpoint behavior summary.

## Phase 3 Outcomes
- Added tenant asset helper utilities for prefixed blob paths and ownership checks.
- Added authenticated blob upload endpoint: `POST /api/portal/assets-upload`.
- Enforced tenant-prefixed storage keys (`tenants/{workspaceId}/...`) on uploads.
- Added branding asset ownership guard that rejects cross-tenant asset URLs.
- Added negative tests for cross-tenant asset references and upload auth checks.

## Test Outcomes
- `npm run lint` passes.
- `npm run test` passes (9 tests).
- `npm run build` passes.

## Risks / Blockers
- OIDC callback currently decodes ID token claims but does not yet verify signature against Google JWKS.
- Workspace bootstrap/admin onboarding flow not implemented; existing workspace record is required.
- Upload API currently accepts base64 payloads directly; a signed direct-upload flow could reduce API memory pressure in future.