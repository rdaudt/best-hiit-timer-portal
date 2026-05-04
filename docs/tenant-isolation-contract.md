# Tenant Isolation Contract

## Rules
1. Workspace identity must be resolved from authenticated session, never from client payload.
2. All portal reads/writes must include workspace guard checks server-side.
3. Cross-tenant access must return safe denied responses (`401`/`403`) without leaking tenant existence details.
4. Shared object paths must use tenant prefixes in later phases.

## Current Phase Coverage
- `api/portal/workspace` resolves workspace by `owner_google_sub` from session.
- Unauthenticated requests are denied.
- Accounts with no workspace mapping are denied.