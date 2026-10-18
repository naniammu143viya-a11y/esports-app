---
name: EAS Corepack signature mismatch
description: Older Corepack bundled with pinned Node.js versions may fail to download current pnpm releases.
---

Avoid custom EAS pre-install hooks that use an old Node-bundled Corepack to prepare a current pnpm version. Corepack 0.30.0 (bundled with Node.js 22.13.0) rejects current pnpm signatures with `Cannot find matching keyid`; the new registry signing key is absent from Corepack's trusted key list.

**Why:** EAS only reports a generic pre-install hook failure in the GitHub Actions output, while the actual issue is a package-manager signature trust mismatch.

**How to apply:** When `eas.json` already pins `pnpm` and `package.json` declares the same `packageManager`, remove redundant Corepack bootstrap hooks. If a hook is genuinely required, use a maintained Corepack release rather than the stale bundled version.
