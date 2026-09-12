---
name: EAS remote build logs
description: GitHub Actions can authenticate and submit an EAS build while only reporting a generic Gradle failure.
---

When an EAS build is launched from GitHub Actions, the Actions log may only show `Gradle build failed with unknown error`; the actionable compiler or Gradle detail is in the Expo build's phase-specific log URL.

**Why:** The CI job is only the EAS client and does not stream the complete remote Android build output into GitHub Actions.

**How to apply:** Preserve the Expo build URL from the EAS CLI output and inspect the `Run gradlew` phase before changing project configuration or retrying another remote build.