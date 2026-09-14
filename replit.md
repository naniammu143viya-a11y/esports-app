# BattleZone

BattleZone is an Expo mobile app for BGMI and Free Fire tournaments with UPI payment verification.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/bgmi-tournament run dev` — run the Expo mobile preview
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Production payment ingestion requires `PAYMENT_WEBHOOK_SECRET`.
- Production admin payment review requires `PAYMENT_ADMIN_SECRET` and a secure admin-authenticated client.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/bgmi-tournament` — Expo Router mobile app and local tournament UI.
- `artifacts/api-server/src/routes/payments.ts` — UTR webhook, instant verification, joins, admin feed, and manual review APIs.
- `lib/db/src/schema/payments.ts` — central PostgreSQL payment and tournament-join tables.
- `artifacts/bgmi-tournament/components/PaymentReviewPanel.tsx` — polling admin review panel.

## Architecture decisions

- Paid UTRs are matched against verified webhook records in PostgreSQL; AsyncStorage is not used as the paid-payment source of truth.
- The admin panel polls the central payment feed every five seconds so multiple devices converge without requiring a new realtime transport.
- Webhook and admin secrets are optional in development but fail closed for their respective production paths.

## Product

- Players pay by UPI, submit a 12-digit UTR, and receive an immediate join approval only when the server finds an unused matching incoming transaction.
- Invalid and duplicate UTRs are rejected with `Invalid or Unverified UTR Number`.
- Admins can monitor flagged submissions and manually approve or reject them.

## User preferences

None recorded.

## Gotchas

- A bank/payment provider must POST `{ utr, amount }` to `/api/payments/webhook` before player verification can succeed.
- Set `PAYMENT_WEBHOOK_SECRET` and `PAYMENT_ADMIN_SECRET` before production; development intentionally allows local integration testing without these headers.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
