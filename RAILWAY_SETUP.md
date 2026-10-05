# Railway setup — LearnQuest 3D Runner

1. Upload the contents of this `learnquest` folder to your GitHub repo's existing `/learnquest` directory.
2. In Railway, select the **learnquest application service**.
3. Settings → Root Directory: `/learnquest`
4. Variables → add:
   - `NODE_ENV` = `production`
   - `JWT_SECRET` = a long random secret (**required** — the server now refuses to start in production without it)
   - `MYSQL_URL` = `${{MySQL.MYSQL_URL}}`
   - `ALLOWED_ORIGINS` (optional) — only needed if the frontend is ever hosted on a different domain than this API. Leave blank for the default same-origin setup.
5. Confirm the Railway MySQL service is Online.
6. Redeploy the application.
7. Open `/api/health` on the public LearnQuest domain. It should report `"database":"mysql"` and a `dbLatencyMs` value.
8. Open the main domain, create/login a child, enter Jungle World and start Level 1.

No manual SQL import is required. Startup creates the runner tables, updates seed content, and automatically applies the compatibility upgrade needed by older MySQL databases (including widening `children.pin` for bcrypt hashes).

### Upgrading an existing (already-deployed) instance

If you're redeploying on top of a database that already has parents/children in it:

- Child PIN storage moved from plaintext to bcrypt hashes. Existing children are upgraded **automatically the first time they log in** after this deploy — no action needed. If you'd rather hash every existing child's PIN immediately (instead of waiting for their next login), run `npm run migrate` once against the same database (locally with `MYSQL_URL` set, or via a Railway one-off shell/job).
- Set `NODE_ENV=production` and `JWT_SECRET` before redeploying — the server intentionally fails to start in production without a real `JWT_SECRET` now, instead of silently falling back to a shared default.

Three.js 0.185.1 is pinned with the backend and served locally from `/vendor/three/three.module.js`. The runner also has jsDelivr/unpkg fallbacks.
