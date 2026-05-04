# best-hiit-timer-portal

Coach admin portal PWA for branding, seed templates, and coach-scoped analytics for the HIIT timer ecosystem.

## Architecture Summary
- Separate frontend repo from timer app.
- Shared Turso database and shared object storage platform.
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