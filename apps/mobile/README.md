# plant-app mobile

The React Native (iPhone-first) app: sign up, log in, and land on an empty
Dashboard shell with placeholder nav. Built with Expo + TypeScript, imports
shared logic from `@plant-app/domain` — the same package the web app uses
(see ADR-0003, "Domain logic execution").

Mirrors ticket #2's web scaffold: same Supabase auth flow (email/password),
same `AuthContext`/`useCredentialsForm` shape, same `DASHBOARD_TILES` from
the shared domain package. The web app uses `react-router-dom` route guards
(`RequireAuth`); this app uses `RootNavigator` switching between an Auth
stack and a Main stack based on `AuthContext`'s status instead, since
there's no URL to redirect.

## One-time setup: Supabase project

Uses the same Supabase project as `apps/web` — see `apps/web/README.md` for
creating it. This app only needs its own env file pointed at that project:

1. Copy `.env.example` to `.env.local` and fill in the project's URL and
   anon key (Project Settings → API):

   ```
   cp .env.example .env.local
   ```

`.env.local` is gitignored — never commit it. Expo only inlines variables
prefixed `EXPO_PUBLIC_` into the client bundle.

## Running the app

No Xcode/CocoaPods install is required for day-to-day development — this is
a managed Expo project with no native code of its own, so **Expo Go** (the
free app from the App Store/Play Store) can run it by scanning the QR code
`npm start` prints. A simulator (`npm run ios`/`npm run android`) needs the
full platform SDK installed locally.

```
npm start          # expo start — prints a QR code for Expo Go
npm run ios         # expo start --ios — requires Xcode + iOS Simulator
npm run android      # expo start --android — requires Android Studio + emulator
npm run web           # expo start --web — runs the same app in a browser tab
```

## Commands

Run from the repo root (workspace-aware) or from this directory:

```
npm run test         # jest --watch
npm run test:run     # jest (single run)
npm run typecheck    # tsc --noEmit
```

## Monorepo notes

- `metro.config.js` adds the repo root to `watchFolders`/`nodeModulesPaths`
  so Metro can resolve the sibling `@plant-app/domain` workspace package,
  and works around a Metro/TypeScript mismatch: `@plant-app/domain`'s source
  imports use explicit `.js` extensions (NodeNext module resolution, which
  `tsc`/Vite resolve to the sibling `.ts` file automatically); Metro has no
  such fallback by default, so `resolver.resolveRequest` retries as `.ts`
  whenever the literal `.js` isn't found.
- The root `package.json` pins `react`/`react-dom` to a single version via
  `overrides`. Without it, npm installs two copies of `react` — Expo pins an
  exact version for compatibility with its React Native version, which
  doesn't satisfy the web app's `^` range — and packages that get hoisted to
  the workspace root (e.g. `@react-navigation/*`) resolve against the wrong
  copy, breaking React's hooks with "Cannot read properties of null" style
  errors at runtime, not just in tests.
