---
name: GitHub connector workflow writes
description: Replit's GitHub connector may block writes to .github/workflows even when repository read and ordinary Contents writes work.
---

Writes to `.github/workflows` can be blocked by the connector's Cloudflare layer, while normal repository reads and root file creation still succeed. The native GitHub SDK may expose REST and GraphQL clients, but GraphQL commit mutations can require a scope the connection does not have.

**Why:** A repository write can appear authorized while the specific workflow path is rejected, so repeated retries through the same endpoint do not resolve it.

**How to apply:** Verify the exact remote path after every attempted write. If workflow writes fail with Cloudflare HTML or a scope error, report the connector limitation instead of claiming the workflow was pushed; ordinary root-file writes may still work.