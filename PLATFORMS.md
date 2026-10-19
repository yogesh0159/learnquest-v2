# LearnQuest on every platform: website, Android, iOS, Windows / macOS / Linux

One game, one code base (JavaScript + WebGL, with a small C/C++ WebAssembly core). Each platform is the same game inside a different "shell":

| Platform | Shell | Where it lives | Status in this project |
|---|---|---|---|
| **Website** (any browser, phone or PC) | the site itself | `frontend/` served by `backend/` | tested |
| **Live on GitHub** (free, every push publishes) | GitHub Pages: `.github/workflows/pages.yml`, `scripts/build-pages.mjs` | `GITHUB_PAGES.md` | tested: built, served like Pages (sub-folder and root), game + offline |
| **Installable web app** (Android Chrome, desktop Chrome / Edge, iPhone / iPad "Add to Home Screen") | PWA: `manifest.webmanifest`, `sw.js`, `js/pwa.js` | `frontend/` | tested incl. fully offline |
| **Android app** | Capacitor 8 | `mobile/android` | targets **Android 16 / API 36** (Google Play rule since 31 Aug 2026); built by **GitHub Actions** (`.github/workflows/android.yml`) into an `.aab` for Play; guide: `PLAYSTORE_GUIDE.md` |
| **iPhone / iPad app** | Capacitor | `mobile/ios` | project generated and checked; **IPA not built here (needs a Mac)** |
| **Windows / macOS / Linux app** | Electron | `desktop/` | **runs and was tested on Linux**; Windows / macOS installers must be built on those systems |

The game itself decides its picture quality for each device (graphics card, memory, screen size; 4K only where it is smooth), and phones / tablets are capped at 2K to protect battery and heat.

## 1. Website (live)
1. Deploy `backend/` + `frontend/` (Railway or any Node host). HTTPS is required for installing and offline play.
2. For the Android / iOS / desktop apps to talk to this server set the environment variable **`APP_ORIGINS=1`** (opens CORS for exactly: `https://localhost`, `http://localhost`, `capacitor://localhost`, `ionic://localhost`, `http://127.0.0.1:47655`). Keep `ALLOWED_ORIGINS` for your own domains.
3. After changing anything in `frontend/` run `npm run pwa:build` (refreshes the offline file list; `npm run pwa:check` verifies it).

## 2. Installable web app (PWA)
* Android Chrome / desktop Chrome / Edge: open the site, then in the game **Settings -> App -> "Install the app"**.
* iPhone / iPad (Safari): **Share -> Add to Home Screen** (the game shows this hint on iOS).
* **Settings -> "Download for offline play"** stores the 15 3D models (about 55 MB) so the game starts with no internet. The first visit already saves the small part (3 MB).
* A new version is downloaded in the background; the player taps **Reload now** (a run is never interrupted).

## 3. Android app
**Easiest way (no Android Studio):** push to GitHub, then Actions -> **Build Android app** -> Run workflow. It builds on GitHub's servers and gives you `LearnQuest-release.aab` (upload to Play Console), a signed `.apk` and a test `.apk`. Full steps, secrets for the upload key and the Play Console forms: **`PLAYSTORE_GUIDE.md`**; store texts, graphics and form answers: `mobile/store-listing/`.

**Own computer (Windows / macOS / Linux):** Node 22+, JDK 21, Android SDK 36.
```
npm install                                   (project root: the game's three.js)
cd mobile
npm install
set LQ_API_BASE=https://your-server.up.railway.app      (optional; empty = offline game, no accounts)
npm run sync                                  # copies the game into the app
cd android && gradlew bundleRelease           # -> app/build/outputs/bundle/release/app-release.aab
```
(`npm run android` opens Android Studio instead.) Signing: set `LQ_KEYSTORE_FILE`, `LQ_KEYSTORE_PASSWORD`, `LQ_KEY_ALIAS`, `LQ_KEY_PASSWORD`; without them the bundle is left unsigned.
Already set up: app id `com.learnquest.junglerun`, launcher icons (all densities, adaptive), splash, full-screen game with the screen kept on, sound without a first tap, vibration, back button (pause / resume / exit), backups off, **only three permissions** (internet, vibrate, keep awake), no Google Fonts / CDN requests inside the app, version code from the CI run number.
You still need: a Play developer account, the Families / kids policy answers, a privacy policy URL, the closed test (12 testers, 14 days for new personal accounts) and testing on real phones.

## 4. iPhone / iPad app
**Note:** `mobile/ios` was generated with an older Capacitor. Before the first build on the Mac run `npx cap migrate` inside `mobile/` (the packages are now Capacitor 8) or delete `mobile/ios` and run `npx cap add ios`, then re-apply the icon / splash assets (`npm run assets`).

Needs: a **Mac**, Xcode 15+, CocoaPods, an Apple Developer account.
```
cd mobile
npm install
LQ_API_BASE=https://your-server.up.railway.app npm run ios      # opens Xcode (ios/App/App.xcworkspace)
```
In Xcode: select your Team under Signing, then **Product -> Archive -> Distribute App** (App Store Connect / TestFlight).
Already set up: app id, icon and splash, landscape + portrait, status bar hidden, full screen, no export-compliance prompt. Pause on leaving the app and the iOS silent-switch audio fix are in the game.
You still need: the Apple account, signing, the **Kids Category** requirements, privacy details (and a privacy manifest if Apple's checker asks for one), and testing on real iPhones / iPads. Browsers on iOS use Safari's engine (WebKit); WebKit could **not** be tested in this project's environment.

## 5. Desktop app (Windows, macOS, Linux)
```
cd desktop
npm install
npm start                 # run it now
npm run dist:win          # on Windows  -> dist/*.exe (installer + portable)
npm run dist:mac          # on a Mac    -> dist/*.dmg   (signing / notarisation needs an Apple account)
npm run dist:linux        # on Linux    -> AppImage + .deb
```
The game runs from a tiny server that listens only on this computer (`127.0.0.1:47655`). For accounts and progress set the server address once: environment variable `LQ_API_BASE`, or `config.json` in the app's data folder: `{ "apiBase": "https://your-server.up.railway.app" }`. Window size and fullscreen (F11) are remembered. Without a server address the Jungle Run works fully offline.

## What was checked, and what you must check
Checked here: platform detection (6 environments), PWA install / update / full offline with the server switched off, phone layouts (iPhone portrait + landscape, Pixel), app-shell behaviour (home button pause, back button, screen kept awake, GPU context loss, iOS audio loop - simulated), Android / iOS project settings, icon sizes, app bundle contents (58 MB), the desktop app actually running (Linux) and loading all 9 models.
**Not checked (cannot be, in this environment):** building the APK / AAB (the Android SDK cannot be downloaded here; GitHub Actions builds it, see `PLAYSTORE_GUIDE.md`) or IPA, Windows and macOS installers, real phones and tablets (heat, memory, touch feel), Safari / WebKit, store review rules.
