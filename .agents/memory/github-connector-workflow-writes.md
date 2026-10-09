---
name: GitHub connector access
description: GitHub workflow-path writes and Git pushes can fail independently of repository reads or an apparently active integration.
---

Writes to `.github/workflows` can be blocked by the connector's Cloudflare layer, while normal repository reads and root file creation still succeed. The native GitHub SDK may expose REST and GraphQL clients, but GraphQL commit mutations can require a scope the connection does not have.

**Why:** A repository write can appear authorized while the specific workflow path is rejected, so repeated retries through the same endpoint do not resolve it.

**How to apply:** Verify the exact remote path after every attempted write. If workflow writes fail with Cloudflare HTML or a scope error, report the connector limitation instead of claiming the workflow was pushed; ordinary root-file writes may still work.

GitHub integration status is not sufficient proof that a shell push can authenticate. In one workspace, `addIntegration` reported the connection active and reauthorization context reported healthy OAuth, but `gh` had no login and `git push` was rejected as invalid credentials. Public Actions run/job/check annotations were readable, while downloading full run logs required repository-admin access.

**Why:** GitHub access can differ between Replit's connection UI, connector sandbox, and shell Git credentials; a successful read does not establish write capability.

**How to apply:** Before promising a push, verify it with `git push` and confirm the remote ref. If shell authentication is rejected, do not handle or print tokens; leave the commit intact and ask the user to repair the GitHub connection through the supported UI. Public check annotations may still reveal failed workflow steps when full logs are unavailable.