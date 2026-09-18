---
name: Expo package-age alignment
description: How to handle current-day Expo SDK patch releases with the workspace package-age policy.
---

When Expo's compatibility checker requires a patch release published within the workspace's minimum release-age window, keep the age gate enabled and allow only the trusted Expo package family rather than disabling the gate globally.

**Why:** The workspace intentionally delays newly published packages for supply-chain protection, while Expo's SDK checker can require same-day patch releases for a clean mobile build.

**How to apply:** Add a narrow Expo-only exclusion in `pnpm-workspace.yaml`, refresh the lockfile, run a frozen install, and verify with `expo install --check` and `expo-doctor`.