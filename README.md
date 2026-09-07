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

npm run db:push      # supabase db push
npm run db:diff      # supabase db diff
npm run db:types     # regenerate types from the linked project
npm run functions:deploy
```

The Supabase CLI is a local devDependency, not a global install, so a bare
`supabase db push` fails with "command not found". Use the `npm run` scripts
above, or prefix with `npx`.
