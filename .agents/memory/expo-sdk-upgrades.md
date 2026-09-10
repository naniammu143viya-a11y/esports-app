---
name: Expo SDK upgrades
description: Lessons for upgrading the Expo mobile artifact in this pnpm monorepo.
---

Expo SDK upgrades in this monorepo must be scoped to the mobile workspace, followed by `expo install --fix` and a typecheck. Major upgrades can change Expo Router native-tab component APIs and tighten TypeScript/SF Symbol typings even when the app still launches.

**Why:** A core Expo upgrade without the matching managed-module versions left peer mismatches and compile errors that were not visible from the initial Metro startup.

**How to apply:** Upgrade from `artifacts/bgmi-tournament`, align SDK-managed dependencies, update changed Router/icon APIs, restart the Expo workflow once, then verify with `expo install --check`, typecheck, and a preview screenshot.