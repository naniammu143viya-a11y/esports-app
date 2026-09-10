# BattleZone — Android Build Instructions

## What's inside this folder
Complete Expo (React Native) source for the BattleZone BGMI & Free Fire tournament app.
No backend needed — 100% AsyncStorage offline app.

---

## Option A: EAS Build (Recommended — runs in Expo's cloud, no Android Studio needed)

The Replit workspace can validate the Expo config, TypeScript, dependency alignment,
and Android JavaScript bundle, but it cannot authenticate to an external Android
build service or install an APK on a device. Run the two release builds below from
an authenticated machine before submitting to Google Play.

### 1. Install prerequisites
```bash
node -v          # must be 18+
npm install -g eas-cli
```

### 2. Install dependencies
```bash
pnpm install --filter @workspace/bgmi-tournament...
cd artifacts/bgmi-tournament
```

### 3. Login to Expo
Create a free account at https://expo.dev if you don't have one, then:
```bash
eas login
```

### 4. Link the project (first time only)
```bash
eas build:configure
```
Accept all defaults. This creates a project on your Expo account.

### 5. Build the APK (sideload / test on your phone)
```bash
eas build --platform android --profile preview
```
- Builds in Expo's cloud — takes ~10–15 minutes
- When done, a download link appears in the terminal
- Also visible at https://expo.dev/accounts/[you]/projects/bgmi-tournament/builds

### 6. Build the AAB (Google Play Store)
```bash
eas build --platform android --profile production
```
- Produces a `.aab` file (required by Play Store)
- Download from the EAS dashboard link

### 7. Release validation checklist

After the preview build completes:

- Install the generated APK on a physical Android device or emulator.
- Create an account and sign in again after closing and reopening the app.
- Join an available free tournament and confirm it appears in My Matches.
- Confirm a tournament at its maximum slot count shows `Match Full` and cannot be joined.
- Open a paid tournament and verify the entry fee, prize pool, per-kill amount,
  rank prizes, and configured admin UPI are visible before confirming.
- In Wallet, verify a prize earning can be expanded to show its kill/rank breakdown.
- Submit a withdrawal request, then sign in as an admin and mark it paid.
- Confirm the withdrawal moves from `PENDING` to `PAID`.

After the production build completes, upload the `.aab` to Google Play Console's
internal testing track. The build is ready for submission only when Play Console
accepts the upload without package-name, version-code, signing, or bundle errors.

---

## Option B: GitHub Codespaces (no local machine required)

1. Push this folder to a GitHub repo
2. Open the repo → click **Code** → **Codespaces** → **e code codespace**
3. Run the commands from Option A in the Codespace terminal
4. Download the APK/AAB from the Codespace file explorer

---

## Google Play Store submission

1. Go to https://play.google.com/console → Create app
2. Production → Releases → Create new release
3. Upload the `.aab` from step 6 above
4. Fill in: app name, description, screenshots, content rating
5. Submit for review (typically 1–3 days)

---

## App config summary

| Field          | Value                    |
|----------------|--------------------------|
| App name       | BattleZone               |
| Package name   | com.battlezone.app       |
| Version        | 1.0.0                    |
| Version code   | 1                        |
| Min Android    | 6.0 (API 23)             |
| Orientation    | Portrait only            |

> **Important:** The package name `com.battlezone.app` is permanent once published.
> Change it in `app.json` → `expo.android.package` BEFORE your first EAS build if you want a different name.

---

## Incrementing versions for future updates

Before each new Play Store release, update `app.json`:
```json
"version": "1.0.1",          ← human-readable
"versionCode": 2              ← must increase by at least 1 each release
```
