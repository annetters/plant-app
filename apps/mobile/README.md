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
full platform SDK installed locally. **Exception**: Tag Scan's on-device OCR
module needs a custom dev client instead of Expo Go — see "Native dev
client" below.

```
npm start          # expo start — prints a QR code for Expo Go
npm run ios         # expo run:ios — builds + runs the native project (Xcode/CocoaPods required)
npm run android      # expo run:android — builds + runs the native project (Android Studio required)
npm run web           # expo start --web — runs the same app in a browser tab
```

`ios`/`android` point at `expo run:*` rather than `expo start --ios`/`--android`
because `npx expo prebuild` (see "Native dev client" below) generated real
`ios/`/`android/` projects — `expo prebuild` rewrites these scripts
automatically as part of that. `ios/`/`android/` are gitignored (`/ios`,
`/android` in `.gitignore`) — regenerate them locally with
`npx expo prebuild --clean` rather than expecting them checked in.

## Native dev client (Tag Scan OCR — issue #22)

Tag Scan's on-device Vision OCR module (`modules/tag-ocr`) needs a custom
EAS dev client, not Expo Go — see `scripts/setup-tag-ocr-dev-client.sh` for
a guided walkthrough of building and installing it on a physical iPhone
with a free Apple ID (no paid Apple Developer Program account required).

**Non-admin macOS accounts**: several of that walkthrough's underlying
tools (`gem install`/`brew install`, accepting the Xcode license) normally
want admin rights. If your macOS user account isn't an admin (`sudo` fails
with "is not in the sudoers file"), here's what actually worked, worked
around from a real non-admin account on a Homebrew install originally set
up by a different (admin) user on the same Mac:

- **CocoaPods**: installed cleanly via `brew install cocoapods` once
  Homebrew's own directories were made writable (see below) — no need to
  fight the system Ruby (which on an unupdated Mac may be an old version,
  e.g. 2.6.x, too old for modern CocoaPods' dependencies) or use
  `gem install --user-install`.
- **Homebrew directories owned by a different user**: `brew install`
  refuses to write to `/opt/homebrew` if it's not owned/writable by the
  current account. Fix (needs to be run once, briefly, as the actual admin
  account — e.g. via Fast User Switching, not by working from that account
  day-to-day): make the directories group-writable rather than transferring
  ownership outright, so *every* local account (both the admin one and this
  one) keeps full access going forward:
  ```
  sudo chgrp -R staff /opt/homebrew /opt/homebrew/Cellar /opt/homebrew/Frameworks /opt/homebrew/bin /opt/homebrew/etc /opt/homebrew/etc/bash_completion.d /opt/homebrew/include /opt/homebrew/lib /opt/homebrew/lib/pkgconfig /opt/homebrew/opt /opt/homebrew/sbin /opt/homebrew/share /opt/homebrew/share/aclocal /opt/homebrew/share/doc /opt/homebrew/share/man /opt/homebrew/share/man/man1 /opt/homebrew/share/man/man3 /opt/homebrew/share/man/man5 /opt/homebrew/share/man/man7 /opt/homebrew/share/zsh /opt/homebrew/share/zsh/site-functions /opt/homebrew/var/homebrew/linked /opt/homebrew/var/homebrew/locks
  sudo chmod -R g+w /opt/homebrew /opt/homebrew/Cellar /opt/homebrew/Frameworks /opt/homebrew/bin /opt/homebrew/etc /opt/homebrew/etc/bash_completion.d /opt/homebrew/include /opt/homebrew/lib /opt/homebrew/lib/pkgconfig /opt/homebrew/opt /opt/homebrew/sbin /opt/homebrew/share /opt/homebrew/share/aclocal /opt/homebrew/share/doc /opt/homebrew/share/man /opt/homebrew/share/man/man1 /opt/homebrew/share/man/man3 /opt/homebrew/share/man/man5 /opt/homebrew/share/man/man7 /opt/homebrew/share/zsh /opt/homebrew/share/zsh/site-functions /opt/homebrew/var/homebrew/linked /opt/homebrew/var/homebrew/locks
  ```
  (`staff` is a group every local macOS account belongs to by default —
  admin or not — so this doesn't require creating a new group.)
- **"fatal: not in a git directory" / "unknown install step" errors from
  `brew`**: looked like Homebrew itself was broken, but wasn't — Git's
  "dubious ownership" safety check was silently blocking Homebrew's
  internal git calls, because `/opt/homebrew`'s `.git` files are still
  *owned* by the admin account even after the group-write fix above (`chgrp`
  changes group, not owner). Fix, run once as the affected account:
  ```
  git config --global --add safe.directory /opt/homebrew
  ```
- **Xcode license**: normally needs `sudo xcodebuild -license accept`. Check
  first whether it's already accepted system-wide (e.g. by whoever set up
  this Mac) before assuming it's a blocker:
  ```
  xcodebuild -license check   # exit code 0 (check with `echo $?`) = already accepted, nothing to do
  ```
- **iOS version mismatch**: Xcode may refuse to build for a connected
  iPhone running an older iOS than it expects. Fix is a normal iOS update
  on the phone (Settings → General → Software Update) — no project-side
  workaround.
- **"Signing for 'mobile' requires a development team" / stuck on a dead
  "Apple Development" certificate**: if Xcode's automatic signing can't
  create a fresh certificate — `Manage Certificates` → `+` fails with "You
  already have a current certificate or a pending request," even after
  deleting the old key+certificate pair from Keychain Access (Access
  Control tab already lists `codesign` as allowed — that's not the cause)
  and signing out/back into the Apple ID in Xcode's Accounts settings —
  the free/Personal Team account has hit Apple's small certificate quota
  with no self-service way to revoke the orphaned one:
  `developer.apple.com`'s certificate list is gated behind the *paid*
  Developer Program and returns "Unable to find a team..." for a free
  account. No fix found beyond clearing local caches
  (`~/Library/Developer/Xcode/DerivedData`,
  `~/Library/MobileDevice/Provisioning Profiles`) and waiting — Apple
  expires a stuck "pending request" server-side on its own, but not
  immediately (could be hours). A second Apple ID, if you have one,
  sidesteps it entirely since the quota is per Apple ID.
- The **"codesign wants to access key... in your keychain"** prompt wants
  your **Mac login password** (the one that unlocks the machine), not your
  Apple ID password.
- The **Team** dropdown in Signing & Capabilities can silently reset to
  "None" after signing out/back into the Apple ID account in Xcode —
  reselect your Personal Team there before pressing Run again.

## Day-to-day workflow, once the dev client is installed

Two separate tools are involved here, doing different jobs — worth keeping
straight:

- **Xcode** builds the native "shell" app and installs it onto the phone.
  This is a rare step — only needed when *native* code changes (e.g.
  `modules/tag-ocr` itself, or a new native dependency/config-plugin).
- **Metro** (`npx expo start --dev-client`) serves the app's actual
  JavaScript to that already-installed shell live, over Wi-Fi, every time
  it opens. This is the everyday step.

So every normal session working on this app:

1. `cd apps/mobile && npx expo start --dev-client` — leave it running.
2. Confirm the iPhone is on the **same Wi-Fi network** as the Mac.
3. Open the already-installed app on the phone directly (swipe down on the
   Home Screen → search "mobile" — it uses a custom icon, not the generic
   Expo one). **Not** the separate Expo Go app.
4. If it can't connect (a red error screen, "No script URL provided"):
   check Settings → Privacy & Security → Local Network on the phone and
   make sure this app is allowed — iOS blocks local-network access by
   default until granted, which is a more common culprit than Metro
   actually not running.

You do **not** need to open Xcode or press ▶ Run again for routine work —
screens, styling, business logic — only when native code changes.

## Troubleshooting: dev client won't connect (blank screen / crash / stuck attach)

Found while debugging a genuinely broken dev client build (2026-08-29/30) —
several distinct problems stacked on top of each other, worth reading in the
order below since each one masked the next:

1. **Blank white screen, then a native crash**: `RCTFatal`, `No script URL
   provided`, `UnsanitizedURLString = (null)`. Root cause: `scripts/setup-
   tag-ocr-dev-client.sh` never actually runs `npx expo install expo-dev-
   client` — none of its 7 stages install the package, so `expo prebuild`
   (which only bakes in plugins/modules already installed) never wires the
   real dev-launcher into the native project. A dev client built by that
   script today is missing the one thing that makes it a dev client. **A
   reliable tell**: Metro itself prints this when you start it against such
   a build — "Unable to determine the default URI scheme for deep linking
   into the app. Ensure that the expo-dev-client package is installed." —
   recognize that line immediately if it comes up again.
   This can look like it works anyway if you're driving the app live from
   Xcode's ▶ Run each time, since Xcode injects the Metro server location
   directly at build/launch time regardless of the dev-launcher. It only
   breaks once you rely on the day-to-day workflow above (open the app
   cold, no Xcode attached) — there's no dev-launcher to rediscover Metro.
   **Fix**, from `apps/mobile`: `npx expo install expo-dev-client`, then
   `npx expo prebuild --clean` (regenerates `ios/`/`android/` with the
   dev-launcher wired in, reruns `pod install`), then rebuild via Xcode
   (stage 6 of the setup script). Confirms fixed when a cold launch shows a
   real "Development servers" screen instead of crashing.
2. **Metro started from the repo root instead of `apps/mobile`** doesn't
   fail loudly — it silently scaffolds a stray `.expo/` folder and
   `tsconfig.json` at the repo root and prints confusing downstream errors,
   since Expo CLI treats whatever directory it's run from as "the project."
   Always check the CLI's own "Starting project at ..." line points at
   `.../apps/mobile` before troubleshooting anything else; delete any stray
   `.expo/`/`tsconfig.json` that end up at the repo root by mistake.
3. **Xcode says "Build Succeeded" but then hangs indefinitely at "Attaching
   to [device]"** — no error, no trust prompt on the phone. Not a project
   issue: reproduced with the device fully paired, wired, developer-mode
   enabled, and tunnel-connected (confirmed via `xcrun devicectl device
   info details`), so this is a known flaky spot in Xcode's own
   device-attach pipeline (CoreDevice/RemoteXPC). Fix, in the order that
   tends to resolve it: restart the iPhone (a full restart, not just
   force-quitting the app) and retry; if still stuck, Xcode's **Window →
   Devices and Simulators** → right-click the device → **Unpair Device** →
   reconnect the cable (re-trust if prompted) → retry.
4. Even with a genuine dev-launcher present, its "Development servers"
   screen can say "No development servers found" with Metro running and
   the phone on the same Wi-Fi — Bonjour/QR auto-discovery isn't reliable.
   Use the launcher's **"Enter URL manually"** option instead:
   `<mac-ip>:8081`, where `<mac-ip>` is `ipconfig getifaddr en0` on the Mac.
5. `npx expo start --dev-client --tunnel` failed here with `@expo/ngrok`'s
   global install returning exit code 243 — plausibly the same non-admin-
   account/Homebrew-permissions class of issue documented above, not fully
   diagnosed. Treat tunnel mode as unreliable on this machine for now; the
   manual-URL entry in point 4 is the practical fallback.

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
