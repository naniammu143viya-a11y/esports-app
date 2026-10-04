---
name: GitHub connector workflow writes
description: Replit's GitHub connector may block writes to .github/workflows even when repository read and ordinary Contents writes work.
---

Writes to `.github/workflows` can be blocked by the connector's Cloudflare layer, while normal repository reads and root file creation still succeed. The native GitHub SDK may expose REST and GraphQL clients, but GraphQL commit mutations can require a scope the connection does not have.

An attached GitHub App does not necessarily configure credentials for local `git push`. A GitHub Contents API write can publish the file, but it creates a different commit SHA and does not advance the workspace's `origin/main` tracking ref, even when the local and remote trees match.

**Why:** A repository write can appear authorized while the specific workflow path is rejected, so repeated retries through the same endpoint do not resolve it.

**How to apply:** Verify the exact remote path after every attempted write. If workflow writes fail with Cloudflare HTML or a scope error, report the connector limitation instead of claiming the workflow was pushed; ordinary root-file writes may still work.

**Why:** Git CLI credentials and the GitHub App API connection are separate, and API-created commits do not automatically synchronize the local Git refs.

**How to apply:** After a Contents API write, verify the remote branch head and commit contents. Do not retry `git push` or rewrite local refs solely because local status still reports an ahead commit.

For PAT-based Git pushes, secret presence is not proof that the credential is usable; validate the token against GitHub before attempting the push and treat HTTP 401 as blocked.

**Why:** A configured secret can still be expired, malformed, or scoped to another repository, producing an authentication failure after the local commit is already prepared.

**How to apply:** Check GitHub authentication without printing the token, then retry the push only after the credential is accepted.