---
name: GitHub connector workflow writes
description: Replit's GitHub connector may block writes to .github/workflows even when repository read and ordinary Contents writes work.
---

Writes to `.github/workflows` can be blocked by the connector's Cloudflare layer, while normal repository reads and root file creation still succeed. The native GitHub SDK may expose REST and GraphQL clients, but GraphQL commit mutations can require a scope the connection does not have.

Git CLI authentication also needs verification: a healthy GitHub OAuth connection with `repo` and `workflow` scopes still produced `Invalid username or token` on a shell push in this workspace. Neither a successful bind result nor a healthy connection proves GitHub accepted a push.

Concurrent Git Data API blob writes through the connector can return HTTP 429 despite ample GitHub rate-limit quota; serialized writes with brief pauses succeeded. Treat this as connector burst throttling, not evidence that the account quota is exhausted.

Keep this project's Git remote credential-free; never embed a PAT in its URL.

**Why:** The user explicitly requested that PATs stay out of the remote URL; this workspace has rejected shell pushes even when OAuth reports healthy and has throttled concurrent connector writes.

**How to apply:** Prefer the GitHub OAuth connection for pushes; serialize blob writes, retry HTTP 429 with backoff or `Retry-After`, and verify the remote branch after every attempt. Never claim success until the branch SHA is confirmed. If auth still fails, request OAuth reauthorization or explain the remaining secure setup; do not inspect or place token values in remotes or logs. If workflow writes fail with Cloudflare HTML or a scope error, report the connector limitation.