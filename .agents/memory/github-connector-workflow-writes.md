---
name: GitHub connector workflow writes
description: Replit's GitHub connector may block writes to .github/workflows even when repository read and ordinary Contents writes work.
---

Writes to `.github/workflows` can be blocked by the connector's Cloudflare layer, while normal repository reads and root file creation still succeed. The native GitHub SDK may expose REST and GraphQL clients, but GraphQL commit mutations can require a scope the connection does not have.

Git CLI authentication also needs verification: in this workspace, adding the GitHub connection reported success while its status remained `not_added`, and a push using a `GIT_URL` secret was rejected. Neither a successful bind result nor a saved-secret confirmation proves GitHub accepted a push.

**Why:** A repository write can appear authorized while the specific workflow path is rejected, and an authentication setup can report success without a successful Git operation.

**How to apply:** Keep credentials out of Git remotes and logs. Verify the remote branch after every attempted push. If workflow writes fail with Cloudflare HTML or a scope error, report the connector limitation; if auth fails, ask for credential repair through Replit Secrets without inspecting the value. Never claim a workflow was pushed until the push succeeds.