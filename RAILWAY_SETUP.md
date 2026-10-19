# Railway: put the LearnQuest server online (do this FIRST)

The Android app and the website talk to this server for parent accounts, child profiles and progress. The repository root is the project; a `Dockerfile` and `railway.json` are included, so Railway builds it by itself.

## 1. Create the project
1. https://railway.com -> sign in with GitHub -> **New Project -> Deploy from GitHub repo** -> `yogesh0159/learnquest-v2`.
2. Leave **Root Directory** empty (the repo root). Railway finds `Dockerfile` + `railway.json`.
3. In the same project: **+ New -> Database -> Add MySQL**. (Needed: it keeps the accounts safe when the server restarts. Without a database the server refuses to start in production, on purpose.)

## 2. Variables (app service -> Variables)
| Name | Value |
|---|---|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | a long random text (32+ characters). Use the one in `android-keys/RAILWAY_VARIABLES.txt` if you got it, or generate your own. Never share it, never change it later (everyone gets logged out). |
| `MYSQL_URL` | `${{MySQL.MYSQL_URL}}` (type exactly this; Railway fills it in. If your database service has another name, use that name instead of `MySQL`) |
| `APP_ORIGINS` | `1` (lets the Android app talk to the server) |
| `ALLOWED_ORIGINS` | only if you also use the GitHub Pages site with accounts: `https://yogesh0159.github.io` |

## 3. Public address
App service -> **Settings -> Networking -> Generate Domain**. You get `https://something.up.railway.app`.

## 4. Check it works
* Open `https://something.up.railway.app/api/health` -> must show `"ok":true` and `"database":"mysql"`. If it says `sqlite`, `MYSQL_URL` is wrong.
* Open `https://something.up.railway.app/` -> the game. Create a parent account, add a child, play.
* Open `/privacy.html` and `/delete-account.html` -> both must load (Google Play needs these two addresses).

## 5. Connect the Android app
GitHub repo -> **Settings -> Secrets and variables -> Actions -> Variables -> New variable**: `LQ_API_BASE` = `https://something.up.railway.app` (no slash at the end). Then run **Actions -> Build Android app**. See `PLAYSTORE_GUIDE.md`.

## Notes
* Railway is paid after the trial; a small server + MySQL is usually a few dollars a month. Check current prices on Railway.
* Back up: Railway MySQL service -> Backups (enable).
* Three.js is served by the server itself (`/vendor/three`), no outside CDN is needed.
* Older child PINs stored in plain text are upgraded automatically on first login. `npm run migrate` hashes them all at once.
* Delete-account is built in: Parents -> Privacy and account, and the public page `/delete-account.html`.
