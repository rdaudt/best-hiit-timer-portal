# best-hiit-timer-portal

Coach admin portal PWA for branding, seed templates, and coach-scoped analytics for the HIIT timer ecosystem.

## Architecture Summary
- Separate frontend repo from timer app.
- Environment-scoped backend resources:
  - Development: isolated Turso DB + Blob store + Google OAuth client.
  - Preview/Production: shared Turso DB + Blob store + Google OAuth client.
- Google OIDC sign-in for coaches only.
- Portal owns coach-write surfaces.
- Timer app remains separate and consumes published data.

## Tech Stack
- React + TypeScript + Vite
- React Router
- Vercel Serverless (`api/*`)
- Turso (`@libsql/client` via API layer)
- Vitest + Testing Library

## Scripts
- `npm run dev`
- `npm run lint`
- `npm run test`
- `npm run build`

## Environment
Copy `.env.example` to `.env.local` and fill values.

For deployment environment mapping, see [Environment Matrix](./docs/environment-matrix.md).
