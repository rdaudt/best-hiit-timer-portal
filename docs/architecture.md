# Portal Architecture and Ownership

## Boundary
- Portal and timer app are separate repos and deploy independently.
- Both share Turso and object storage.

## Ownership
- Portal is the primary write surface for coach branding and seed templates.
- Timer app consumes published branding/templates.
- Portal APIs are in this repo under `api/portal/*`.

## Identity
- Google OIDC sign-in only.
- One Google account maps to one workspace via `owner_google_sub`.
- Session is server-side validated for every portal API.

## Non-goals in this phase
- No template CRUD API yet.
- No branding write API yet.
- No analytics dashboard implementation yet.