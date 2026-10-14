---
name: pnpm firewall installs
description: Handling Replit package-firewall failures during workspace installs.
---

Workspace installs can resolve the lockfile and then fail with 403 responses for transitive package tarballs. A timed-out or failed `--no-frozen-lockfile` operation may also change unrelated lockfile entries before package linking completes. Expo CLI may also request fresh SDK patch releases that pnpm's `minimumReleaseAge` guard rejects, even when the configured registry has the package.

**Why:** Firewall rejections can be package-specific, while workspace-wide resolution may refresh many packages; the release-age guard additionally prevents using versions that have not aged long enough.

**How to apply:** Follow the package-management firewall guidance: check the latest compatible package and its parent, never weaken the workspace release-age guard broadly, and review or revert unrelated lockfile changes if installation does not complete. For fresh Expo patches, keep Metro on the locked SDK-compatible set and retry after the release-age window rather than allowing a premature update.
