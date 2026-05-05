# best-hiit-timer-portal Setup Guide
> Status: Drafted on May 4, 2026

## 1. Goal and Architecture Decisions
This guide defines how to start and manage `best-hiit-timer-portal` as a separate frontend app while reusing UX patterns from the existing timer app.

Final decisions:
- The portal frontend is a separate app in a separate local root folder.
- The portal app has a separate GitHub repository.
- The timer app and portal app share the same backend platform (database + object store).
- The portal requires Google authentication.
- The timer app remains unauthenticated.

Why this approach:
- Keeps frontend codebases and release cycles decoupled.
- Avoids clone-and-cleanup debt from copying the full timer app.
- Enables selective, controlled reuse of proven UX patterns and components.

## 2. Repository and Local Workspace Setup
### 2.1 Create local folder
Use another folder to the existing timer app (C:\Users\Carboteiro\projects\nodoubt-fitness-timer2), for example:
- `D:\projects\best-hiit-timer-portal` (created already)

### 2.2 Create GitHub repository
Create a new repository named:
- `best-hiit-timer-portal` (created already, url is https://github.com/rdaudt/best-hiit-timer-portal)

Set defaults:
- Default branch: `main`
- Enable branch protection for `main`
- Require PR reviews before merge
- Enable status checks once CI is added

### 2.3 Scaffold a fresh app
Use a clean React + TypeScript scaffold (matching current ecosystem choices where practical):
- React + TypeScript
- Vite build system
- ESLint + test setup from day one

Do not copy the entire timer app as a starting point.

### 2.4 Baseline repo hygiene
Add early:
- `.gitignore`
- `README.md` with architecture summary
- `.env.example` with placeholders only
- basic CI workflow (lint, test, build)

### 2.5 Suggested directory structure
Use a structure similar enough for familiarity, without tight coupling:

```text
src/
  components/
  pages/
  services/
  lib/
  auth/
  styles/
api/                  # if serverless routes are colocated
public/
docs/
```

## 3. Reuse-Without-Coupling Playbook
Reuse UX intentionally, not wholesale.

### 3.1 Reuse priorities
Start by porting:
- layout shell patterns
- visual design tokens/styles
- template-management UX flows
- pure helper utilities (formatting, safe transforms)

### 3.2 Do not copy directly
Avoid direct copy of timer-app-specific:
- route structure and assumptions
- local storage/IndexedDB persistence flows
- unauthenticated access assumptions
- timer-run engine/state logic not relevant to portal

### 3.3 Porting checklist for each candidate module
Before importing any component/module:
1. Dependency audit: list direct and transitive dependencies.
2. Auth audit: verify behavior under protected routes and signed-in identity.
3. Tenancy audit: confirm all data access is coach-workspace scoped.
4. API boundary audit: remove timer-specific service coupling.
5. Test audit: add or adapt tests in portal repo.

### 3.4 When to extract a shared package
Only extract shared package(s) after both apps stabilize on the same abstraction.
Use these criteria:
- code is reused by both apps with low churn
- no app-specific auth/state assumptions remain
- versioning overhead is lower than copy-maintenance overhead

## 4. Shared Backend Integration Rules (High-Level)
Both apps share backend resources, but remain tenant-safe.

### 4.1 Shared database rules
- Portal and timer app use the same database platform (`nodoubt-analytics`).
- Every read/write path must enforce coach workspace isolation.
- Cross-tenant data access is disallowed by default.

### 4.2 Shared object store rules
- Portal and timer app use the same object store.
- All objects must use tenant-scoped key prefixes (for example by workspace/coach id).
- Reads and writes must validate tenant ownership before access.

### 4.3 Cross-app ownership model
- Portal: primary write surface for branding and seed templates.
- Timer app: consumer of published branding/templates.
- Timer app: producer of usage analytics events.
- Portal: consumer of coach-scoped analytics views.

### 4.4 Shared-resource failure expectations
Define product behavior for:
- missing assets
- stale object references
- unauthorized access attempts
- unavailable analytics aggregation windows

## 5. Authentication and Access Baseline
### 5.1 Identity model
- Google sign-in only for portal v1.
- No anonymous portal access.

### 5.2 Route protection
- Portal routes are protected by auth.
- Unauthorized users are redirected to sign-in flow.

### 5.3 Authorization baseline
- v1 role baseline: coach user access to own workspace only.
- Any broader admin hierarchy is out of v1 unless explicitly added later.

### 5.4 Timer app boundary
- Timer app remains unauthenticated.
- No retrofit of timer app auth in this setup track.

## 6. Developer Workflow and Setup Milestones
This sequence covers platform setup and integration readiness, not feature implementation planning.

### M1: Repository bootstrap
Definition of done:
- new repo exists and is cloned locally
- scaffold app runs locally
- lint/test/build baseline scripts pass
- PR checks are wired in CI

### M2: Auth shell baseline
Definition of done:
- Google auth flow integrated
- protected route shell exists
- sign-in/sign-out paths tested at smoke level

### M3: First UX reuse port
Definition of done:
- at least one reusable layout/template-management UI slice is ported
- timer-app-specific coupling removed
- portal tests pass for the ported slice

### M4: Shared backend smoke integration
Definition of done:
- portal can read/write a coach-scoped record in shared DB
- portal can resolve tenant-scoped object store asset
- analytics coach-scoped read path smoke-tested

## 7. Risk Register and Mitigations
### Risk: accidental frontend coupling between repos
Mitigation:
- ban direct cross-repo imports
- enforce API/interface contracts, not source linkage
- document ownership boundaries in each repo README

### Risk: hidden dependencies in copied components
Mitigation:
- run porting checklist before merge
- require dependency diff in PR description
- add tests for imported module behavior under portal auth

### Risk: tenant data leakage in shared DB/object store
Mitigation:
- require tenant key in all data access services
- enforce tenant-prefixed object paths
- include negative tests for cross-tenant access

### Risk: auth assumption conflicts during reuse
Mitigation:
- wrap reused components with portal auth-aware adapters
- block merges if components assume anonymous state
- include auth-state test scenarios (signed in, signed out, expired session)

## 8. Environment and Operations Appendix
### 8.1 Environment variable matrix (high level)
Portal app (expected):
- Google auth client/config variables
- shared backend API/database connection values (as required by architecture)
- object store credentials/config (if direct use is required)

Timer app (existing):
- current timer app env vars remain as-is
- no end-user auth variables required for timer frontend

Shared backend platform:
- shared DB connection/config (shared Turso DB: `nodoubt-analytics`)
- shared object store config
- analytics pipeline/cron secrets as applicable

### 8.2 Bootstrap command checklist (example)
```bash
# create and enter folder
mkdir best-hiit-timer-portal
cd best-hiit-timer-portal

# initialize app scaffold (example toolchain)
npm create vite@latest . -- --template react-ts
npm install

# baseline checks
npm run lint
npm test
npm run build
```

### 8.3 Copy decision matrix
Use this rule:
- Copy as-is: pure presentational components with no app/service dependencies.
- Adapt: components with reusable UX but timer-specific service hooks.
- Rebuild: components tightly coupled to timer runtime, unauth state, or IndexedDB flows.

## 9. Immediate Next Actions
1. Create `best-hiit-timer-portal` GitHub repo and local folder.
2. Scaffold clean app and push initial baseline commit.
3. Implement Google auth shell before any major UI porting.
4. Port first template-management UX slice using the porting checklist.
5. Add shared-backend smoke checks with coach-tenant scoping.


