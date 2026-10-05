# Put LearnQuest on GitHub and run it live from there (GitHub Pages)

After this, **every `git push` publishes the game** at `https://<your-user>.github.io/<repository-name>/` - on phones, tablets and computers, installable as an app, and playable offline.

## One-time steps (about 10 minutes)
1. On github.com click **New repository**. Give it a name (for example `LearnQuest`). Choose **Public**\* and leave "Add a README" **unticked**. Create it.
2. On your computer, open a terminal **inside the `learnquest` folder** of this project and run (replace `YOUR-USER` and `LearnQuest`):
   ```
   git init -b main
   git add -A
   git commit -m "LearnQuest Jungle Run"
   git remote add origin https://github.com/YOUR-USER/LearnQuest.git
   git push -u origin main
   ```
   GitHub asks you to sign in (browser or a personal access token). The repository is about 70 MB; the 328 MB `source_assets/` folder is **not** uploaded (see `.gitignore`).
3. In the repository open **Settings -> Pages -> Build and deployment -> Source** and choose **GitHub Actions**.
4. Open the **Actions** tab. The workflow **"Deploy LearnQuest to GitHub Pages"** runs by itself (re-run it with *Run workflow* if it started before step 3). After 2-4 minutes it turns green and shows the live address.
5. Open `https://YOUR-USER.github.io/LearnQuest/`. On a phone: **Settings -> App -> Install the app** (iPhone: Share -> Add to Home Screen).

\* GitHub Pages is free for **public** repositories. Private repositories need a paid GitHub plan.

## Updating
Change files, then `git add -A`, `git commit -m "..."`, `git push`. The live site updates in a few minutes. Players who installed it get a "A new version is ready - Reload now" button in Settings (a run is never interrupted).

## What runs on GitHub Pages
| Works | Does not (needs a server) |
|---|---|
| Jungle Run with the teacher, Hindi / Marathi / English, all 3D models, sound, quality auto-detect up to 4K, the C/C++ WebAssembly core | parent / child accounts, dashboards, rewards, progress saved on a server |
| Install as an app (Android, iPhone, desktop), full offline play after "Download for offline play" | the Explorer Hub (it needs the Node backend) |
| Self-check page (`/selftest.html`): a device report for any visitor, the 3D lab | |

GitHub Pages only serves files, it cannot run the Node backend. Keep the backend on Railway (see `RAILWAY_SETUP.md`) and, when you connect them, allow the Pages address in the backend: `ALLOWED_ORIGINS=https://YOUR-USER.github.io`.
Progress of the Jungle Run itself is saved on the player's device, so it works on Pages without any server.

## Try the exact same build on your computer first
```
npm ci
node scripts/build-pages.mjs --base /LearnQuest/ --out site
node scripts/test-pages.mjs site /LearnQuest/
node scripts/serve-pages.mjs site /LearnQuest/ 8080        # open http://127.0.0.1:8080/LearnQuest/
```
`serve-pages.mjs` behaves like GitHub Pages (only the sub-folder exists, 10-minute cache, no special headers).

## If something is wrong
* **Blank page / 404:** the repository name must match the address. The workflow reads it automatically. A repository named `YOUR-USER.github.io` is published at the root `https://YOUR-USER.github.io/`.
* **Workflow cannot deploy:** Settings -> Pages -> Source must be "GitHub Actions"; Settings -> Actions -> General -> Workflow permissions: allow read and write.
* **Old version still shown:** hard-refresh once, or tap "Reload now" in Settings -> App. The browser keeps the app files for offline play and updates them in the background.
* **Push is rejected for a big file:** GitHub blocks single files over 100 MB. None of the shipped files is that large (the biggest is 53 MB and is not uploaded).
