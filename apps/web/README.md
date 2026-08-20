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

SQL migrations live in `supabase/migrations/` at the repo root. There's no
Supabase CLI in this repo yet, so apply them by hand against your project's
SQL editor (Supabase dashboard → SQL Editor → paste the file → Run), in
filename order:

- `0001_plants.sql` — the `plants` table (ticket #3: Plant record CRUD),
  its row-level security policies, and the private `plant-reference-photos`
  storage bucket + policies reference photos are uploaded to.

Re-running an already-applied migration is safe — every statement is
idempotent (`if not exists` / `on conflict do nothing` / `create or
replace`).

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
