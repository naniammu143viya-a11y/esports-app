---
name: BattleZone recovery guardrails
description: User requirements for Build 41 recovery, production data safety, app identity, and release approval.
---

For BattleZone recovery, use the verified Build 41 source as the code base and apply only required changes. Preserve the existing EAS app identity and backup refs, keep production records intact, add no demo accounts or tournaments, and never reset branches or force-push. Do not change production or build/publish an APK until the user has reviewed the findings and explicitly approved the production changes; verify signing/EAS access first.

**Why:** the user explicitly requires source fidelity, production data protection, preservation of app identity and backups, and a confirmation gate before release-impacting work.

**How to apply:** inspect the existing source, deployment, database, and signing configuration first. Keep changes non-destructive and report any source/schema/identity mismatch before deployment.
