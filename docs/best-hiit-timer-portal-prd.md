# best-hiit-timer-portal - Product Requirements Document
> Status: Drafted on May 4, 2026

## 1. Product Overview
`best-hiit-timer-portal` is a coach admin web app for managing tenant-facing experience and viewing coach-scoped performance data for the HIIT timer ecosystem.

The portal serves coaches only and is separate from the end-user timer app frontend.

Primary goals:
- Let coaches manage branding and starter content without developer intervention.
- Let coaches manage and publish seed workout templates.
- Let coaches monitor coach-scoped analytics from timer usage.

## 2. Product Scope (v1)
Included in v1:
- Coach authentication (Google sign-in only).
- Coach workspace-scoped branding management.
- Coach workspace-scoped seed template management.
- Coach workspace-scoped analytics dashboard.

Out of scope in v1:
- Athlete-facing accounts and self-service.
- Billing, subscriptions, payments.
- Scheduling, booking, CRM, messaging.
- Full organization-wide business suite.

## 3. Users and Access Model
### 3.1 Primary user
- Coach user only.

### 3.2 Authentication
- Google sign-in only.
- No anonymous or shared-password access path for portal v1.

### 3.3 Authorization baseline
- Coaches can access only their own workspace data.
- Cross-workspace read/write is not permitted.

## 4. System Context and Shared Platform
The portal and timer app are separate frontends in separate repositories, but they share backend platform resources.

Shared platform constraints:
- Shared database across portal and timer app platform features.
- Shared object store across portal and timer app assets.
- Strict tenant scoping is required in both apps.

This shared infrastructure does not allow shared visibility across coach workspaces.

## 5. Tenancy and Data Ownership
### 5.1 Tenancy model
- Coach workspace isolation.
- All business data is scoped to authenticated coach/workspace identity.

### 5.2 High-level ownership boundaries
- Portal is the primary write surface for coach branding settings.
- Portal is the primary write surface for coach seed templates.
- Timer app consumes published branding/templates.
- Timer app emits usage analytics events.
- Portal reads coach-scoped analytics summaries and trends.

### 5.3 Shared object store boundary
- Assets are stored in a shared object store with workspace/coach-scoped namespacing.
- Cross-tenant asset access is prohibited.

## 6. Functional Requirements
### 6.1 Branding management
Coaches must be able to:
- View current workspace branding configuration.
- Update brand identity fields (for example logos, colors, brand text, asset references).
- Save and apply branding updates for downstream timer app consumption.
- View metadata such as last updated time.

### 6.2 Seed template management
Coaches must be able to:
- View list of workspace seed templates.
- Create new seed templates.
- Edit existing seed templates.
- Duplicate templates.
- Archive/unarchive templates.
- Mark templates as publish-ready for downstream use.

### 6.3 Analytics by coach
Coaches must be able to:
- View coach-scoped usage metrics and trends.
- Filter metrics by date range.
- Review core event-based summaries relevant to timer usage outcomes.

### 6.4 Audit visibility
For coach-managed resources (branding and templates), portal should display basic audit metadata:
- last updated timestamp
- actor identity (where available)

## 7. Non-Functional Requirements
- Portal routes require authenticated access.
- Coach workspace data isolation must be enforced by design.
- Dashboard and management screens should be responsive for desktop-first usage.
- Shared resource failures (missing assets, stale references, unauthorized access) must return safe user-visible states without data leakage.

## 8. Success Criteria
The v1 release is successful when:
- Coaches can complete branding updates without developer support.
- Coaches can create and maintain seed templates end-to-end.
- Coaches can view analytics for their own workspace.
- No cross-tenant data visibility incidents are observed in UAT.

## 9. Constraints and Compatibility Notes
- Timer app remains unauthenticated in v1 and is not retrofitted with end-user login as part of this portal scope.
- Portal and timer app must remain frontend-separated (separate repos and release cycles).
- UX should closely resemble timer app patterns where it improves consistency, while keeping portal-specific auth and data boundaries intact.

## 10. Explicitly Not Included (Current PRD)
- Implementation sequencing or engineering task plan.
- Detailed API contract definitions.
- Detailed database schema migrations.
- Detailed visualization specification for each analytics chart/card.

## 11. Open Decisions for Future Revision
- Final identity provider implementation path for Google auth.
- Final analytics metric catalog and exact dashboard layouts.
- Final media upload limits and object lifecycle/retention policies.
