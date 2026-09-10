---
name: Expo SDK upgrades
description: Lessons for upgrading the Expo mobile artifact in this pnpm monorepo.
---

Expo SDK upgrades in this monorepo must be scoped to the mobile workspace, followed by `expo install --fix` and a typecheck. Major upgrades can change Expo Router native-tab component APIs and tighten TypeScript/SF Symbol typings even when the app still launches.

**Why:** A core Expo upgrade without the matching managed-module versions left peer mismatches and compile errors that were not visible from the initial Metro startup.

**How to apply:** Upgrade from `artifacts/bgmi-tournament`, align SDK-managed dependencies, update changed Router/icon APIs, restart the Expo workflow once, then verify with `expo install --check`, typecheck, and a preview screenshot.

Android release validation still needs an authenticated external build service and
a physical device or emulator; Replit can validate the config and Android bundle,
but cannot produce the signed APK/AAB or complete Play Console upload validation.

**Why:** The workspace has no Android SDK/Gradle/device and the release build
requires credentials that are intentionally unavailable to the local workflow.

**How to apply:** Treat successful Expo config resolution, dependency checks,
typecheck, and Android bundle export as local preflight only; run preview and
production builds externally before calling the release ready.