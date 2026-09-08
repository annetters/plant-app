# Expo HAS CHANGED

Don't write mobile code from memory — read the exact versioned docs for the
SDK this app is actually pinned to:

**https://docs.expo.dev/versions/v54.0.0/**

`apps/mobile/package.json` pins `expo` to **54.0.37** and `react-native` to
**0.81.5**. SDK 54 is a deliberate choice, not lag: ADR-0004 records it as
"deliberately downgraded to match Expo Go", and Tag Scan's custom EAS dev
client is built against it.

**Check the pin before trusting this file.** If `package.json` and the URL
above disagree, `package.json` wins and this line needs updating — that is
exactly how this file went wrong before. It pointed at v57 (React Native
0.86, React 19.2.3, Node 22.13+) from the day it was written, three SDK
versions ahead of the pin it shipped alongside in the same commit.
