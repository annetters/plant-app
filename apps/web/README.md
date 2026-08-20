# plant-app web

The browser app: sign up, log in, and land on an empty Dashboard shell. Built
with Vite + React + TypeScript, imports shared logic from `@plant-app/domain`.

## One-time setup: Supabase project

This app needs a real Supabase project — that's an account-level step only a
human can do:

1. Create a project at [supabase.com](https://supabase.com).
2. Email/password auth is on by default under Authentication → Providers —
   nothing to change for this ticket.
3. Copy `.env.example` to `.env.local` and fill in the project's URL and
   anon key (Project Settings → API):

   ```
   cp .env.example .env.local
   ```

`.env.local` is gitignored — never commit it.

## One-time setup: database schema

SQL migrations live in `supabase/migrations/` at the repo root, applied via
the Supabase CLI (`supabase` — a root npm dev dependency, so `npx supabase
...` or the `npm run db:*` scripts below both work with no separate
install). This project only ever uses the CLI against the *remote* hosted
project — never `supabase start`, which spins up a full local Postgres
stack in Docker. That keeps this workflow Docker-free.

Linking the CLI to your project is a one-time, per-machine, human step (it
needs an interactive browser login):

```
npx supabase login                          # opens a browser to authenticate
npx supabase link --project-ref <your-ref>  # Project Settings → General → Reference ID
```

From then on, applying migrations is:

```
npm run db:push   # supabase db push — applies supabase/migrations/*.sql to the linked project
```

Currently applied:

- `0001_plants.sql` — the `plants` table (ticket #3: Plant record CRUD),
  its row-level security policies, and the private `plant-reference-photos`
  storage bucket + policies reference photos are uploaded to.

Every migration here is written idempotently (`if not exists` / `on
conflict do nothing` / `create or replace`), so re-running is always safe —
useful if you ever do apply one by hand (Supabase dashboard → SQL Editor)
instead of via the CLI.

Other useful CLI commands once linked:

```
npm run db:diff    # supabase db diff — compares local migrations against the linked project's schema
npm run db:types   # supabase gen types typescript --linked — prints generated row types to stdout
```

## Baseline schema conventions

Every table follows the baseline conventions ADR-0003 calls out as
non-negotiable regardless of where the rest of the domain logic runs:
foreign keys, `NOT NULL` on required columns, and cheap `CHECK`s (e.g.
`quantity > 0`). See `docs/adr/0003-web-desktop-native-mobile-cloud-backend.md`,
"Domain logic execution" → "Baseline, regardless of the above".

## Commands

Run from the repo root (workspace-aware) or from this directory:

```
npm run dev         # start the dev server
npm run test         # watch mode
npm run test:run     # single run
npm run typecheck    # tsc -b
npm run build         # production build
```
