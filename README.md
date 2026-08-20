# plant-app

Personal garden plant registry. Spec: [GitHub issue #1](https://github.com/annetters/plant-app/issues/1).
Domain glossary: `CONTEXT.md`. Decisions: `docs/adr/`.

## Layout

npm-workspaces monorepo:

- `packages/domain` — shared TypeScript domain logic, imported by every
  frontend (web today, React Native later per ADR-0003)
- `apps/web` — the browser app (Vite + React). See `apps/web/README.md` for
  setup, including the one-time Supabase project step.

## Commands

```
npm install
npm run dev         # apps/web dev server
npm run test:run     # all workspaces
npm run typecheck    # all workspaces
```
