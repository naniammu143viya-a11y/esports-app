---
name: pnpm firewall installs
description: Handling Replit package-firewall failures during workspace installs.
---

Workspace installs can resolve the lockfile and then fail with 403 responses for transitive package tarballs. A timed-out or failed `--no-frozen-lockfile` operation may also change unrelated lockfile entries before package linking completes.

**Why:** Firewall rejections can be package-specific, while workspace-wide resolution may refresh many packages; a partial install is not proof the app is ready.

**How to apply:** Follow the package-management firewall guidance: check the latest compatible package and its parent, never bypass the firewall, and review or revert unrelated lockfile changes if installation does not complete.
