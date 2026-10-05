---
name: Generated API Zod barrels
description: Prevent duplicate exports when regenerating API-Zod code from the OpenAPI specification.
---

Run barrel normalization as part of code generation. Orval can produce model type names that collide with runtime schema exports; manually removing generated exports is temporary because the next generation rewrites them.

**Why:** Duplicate barrel exports caused the workspace typecheck to fail after API-spec changes, while hand edits were lost on regeneration.

**How to apply:** When changing OpenAPI schemas or operations, run the full codegen pipeline and verify the workspace typecheck rather than editing generated barrel files directly.
