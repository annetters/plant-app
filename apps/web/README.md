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

## Baseline schema conventions

No tables exist yet (Plant/Planting land in later tickets), but every table
added from here on follows the baseline conventions ADR-0003 calls out as
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
