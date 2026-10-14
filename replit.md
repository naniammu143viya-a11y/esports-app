# BattleZone

BattleZone is an Expo mobile app and Express API for BGMI and Free Fire tournaments, player registrations, and wallet payments.

## Run & Operate

- Run the **BGMI & Free Fire Tournaments** workflow to start the Expo mobile preview.
- Run the **API Server** workflow alongside it for backend requests (`/api/healthz`).
- `pnpm install --frozen-lockfile` — install workspace dependencies
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push` — apply the existing schema to the development database only
- Runtime database: Replit's managed development PostgreSQL (`DATABASE_URL`)
- Admin sign-in requires the `ADMIN_PASSWORD` Replit Secret. Customer registration does not require it.
- `SESSION_SECRET` is already configured as a Replit Secret.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/bgmi-tournament/` — Expo Router customer/admin mobile app.
- `artifacts/api-server/` — Express API and esports routes.
- `lib/db/` — PostgreSQL schema and Drizzle configuration.
- `lib/api-client-react/` — shared API client.

## Architecture decisions

- Keep the imported pnpm workspace and Expo app identity intact.
- Do not seed demo users or tournaments during development setup.

## Product

Browse and register for BGMI and Free Fire tournaments, with administrator features and wallet/payment flows backed by the API.

## User preferences

Do not change production data or build/publish a release without the user's explicit approval.

## Gotchas

- Expo Go phone preview uses Replit's managed preview. Expo account sign-in is optional for Metro startup.
- The API server requires `DATABASE_URL`; admin authentication requires `ADMIN_PASSWORD`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
