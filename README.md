# LearnQuest - Jungle Run

**Play it live (GitHub Pages):** `https://YOUR-USER.github.io/YOUR-REPOSITORY/`  ·  setup steps: [GITHUB_PAGES.md](GITHUB_PAGES.md)  ·  all platforms (Android, iPhone, desktop): [PLATFORMS.md](PLATFORMS.md)

# LearnQuest — 3D Jungle Runner + Learning Platform

LearnQuest is a parent + child gamified learning web app. This build is ready for a GitHub → Railway deployment and uses Railway MySQL when `MYSQL_URL` is configured.

## What is included

- Parent signup/login and child profiles with PIN login
- English / Hindi / Marathi interface data
- 90 bundled age-group learning questions (Maths / English / GK), including 18 fresh Maths Kingdom questions
- MySQL production database with automatic schema creation and seed data
- SQLite fallback for local development
- XP, coins, overall level and streaks
- Parent-assigned tasks and progress dashboard
- Reward shop with unlock + equip support
- 4 worlds in the roadmap; Jungle World and Maths Kingdom are implemented, while Space World and Puzzle Island remain future worlds
- 20 playable levels: 10 Jungle levels + 10 Maths Kingdom levels, each with progressive unlocks and a boss level
- **Three.js 3D Jungle Runner** with original procedural graphics (Three.js 0.185.1 is pinned server-side and served locally, with matching CDN fallbacks)
  - auto-running 3-lane runway
  - left/right lane switching
  - jump and slide
  - keyboard + touch/swipe controls
  - logs, hanging branches, boulders, pits, moving hazards and two-lane traps
  - one-hit crash gameplay; equipped shield can save one crash
  - coins, golden keys, shield, magnet and focus-boost pickups
  - rising speed and focus-combo score
  - age-group speed tuning
  - integrated learning gates placed directly in the 3D runway
  - wrong learning lane ends a normal run unless shielded
  - boss level uses Guardian HP + child lives
  - level missions, 3-star scoring and best-run statistics
  - level unlock, XP and coin rewards saved to MySQL
  - equipped cape, parrot, sword and power rewards affect the runner
- **World 2: Maths Kingdom 3D Castle Runner**
  - unlocks only after Jungle Level 10 / Jungle Guardian is completed
  - 10 new levels from Castle Gate to Dragon Tower
  - castle roads, towers, banners, moat bridge, dungeon, geometry garden and royal hall themes
  - new barrel, portcullis, knight-shield, broken-drawbridge and swinging-mace obstacle visuals
  - royal seal mission collectibles and maths-only learning gates
  - Level 10 boss battle against the procedural 3D Number Dragon
  - 18 additional age-group maths questions for more replay variety
  - new Royal Cape, Baby Dragon and Crystal Sword shop rewards
  - existing Jungle players who already beat Level 10 receive Maths Kingdom Level 1 automatically on deploy

The runner uses original low-poly/procedural geometry and Temple-Run-style **mechanics only**; it does not copy Temple Run art, characters, maps, branding or assets.

## Railway deployment

Repository layout must be:

```text
repo/
└── learnquest/
    ├── package.json
    ├── backend/
    └── frontend/
```

Set Railway service **Root Directory** to:

```text
/learnquest
```

Add these variables to the LearnQuest application service:

```text
JWT_SECRET=<long-random-secret>
MYSQL_URL=${{MySQL.MYSQL_URL}}
```

Then deploy. Database tables and bundled content are created/updated automatically at server startup.

Health check:

```text
/api/health
```

Expected production response:

```json
{"ok":true,"service":"learnquest-api","database":"mysql"}
```

## Runner controls

Desktop:

- Left: `←` or `A`
- Right: `→` or `D`
- Jump: `↑`, `W` or `Space`
- Slide: `↓` or `S`
- Pause: `P` or `Esc`

Touch:

- Swipe left/right to change lane
- Swipe up to jump
- Swipe down to slide
- On-screen controls are also available

## Learning gate rules

Normal levels use 3 learning gates and require at least 2 correct server-side. Because a wrong answer lane is a crash in the runner, a no-shield perfect run normally answers all gates correctly. A Guardian Shield can absorb one wrong choice.

The boss level provides 8 gates and requires 5 correct answers. Boss mistakes remove player lives instead of always ending the run immediately.

## Database tables

Core tables:

- `parents`
- `children`
- `subjects`
- `questions`
- `worlds`
- `game_levels`
- `child_level_progress`
- `question_log`
- `rewards`
- `child_rewards`
- `parent_tasks`
- `daily_activity`

3D runner additions:

- `game_runs`
- `game_run_answers`
- `level_run_stats`
- `child_equipped_rewards`

## Security & operations (upgrade notes)

- **Child PINs are bcrypt-hashed**, not stored in plaintext. Existing children are upgraded automatically on their next successful login; `npm run migrate` (from `/learnquest`) hashes everyone immediately if you'd rather not wait.
- **Rate limiting** protects `/api/auth/*` (signup/login) and child PIN login specifically (keyed per child, not just per IP) against brute-force guessing. A general limiter also caps overall API traffic.
- **Security headers** are set via `helmet` (CSP, `X-Frame-Options`, `X-Content-Type-Options`, etc.).
- **CORS** defaults to same-origin (the frontend is served by this same Express app). Set `ALLOWED_ORIGINS` only if you host the frontend separately.
- **`JWT_SECRET` is required** when `NODE_ENV=production` — the server refuses to start without it rather than silently using a shared default secret.
- **Structured logging** via `pino`; set `LOG_LEVEL` (default `info` in production, `debug` locally). Auth tokens, password hashes, and PINs are automatically redacted from logs.
- **Compression + caching**: gzip/brotli via `compression`, long-lived `Cache-Control` on static JS/CSS/vendor assets, `no-cache` on HTML so deploys are picked up immediately.
- **Automated tests**: `npm test` (from `/learnquest` or `/learnquest/backend`) runs a Node.js built-in test-runner suite covering validation helpers, PIN hashing/auth, and game mission logic.
- **CI**: `.github/workflows/ci.yml` (at the repo root, alongside this `learnquest` folder) runs `npm run check` and `npm test` on every push/PR.

See `UPGRADES_APPLIED.md` for the full list of changes made in this security/performance upgrade pass.

## Important

Do not commit a real `.env` file or Railway secrets to GitHub. `.env.example` is safe as a template.
## Local Jungle 3D Lab

The new Meshy jungle path can be tested locally before any GitHub/Railway update:

```bash
npm install
npm run jungle:local
```

Open `http://localhost:5177/jungle-local-preview.html`. On Windows, `START_JUNGLE_LOCAL.bat` performs the same local startup. See `JUNGLE_LOCAL_IMPLEMENTATION.md` for the asset structure and next Meshy drop-in slots.



## Node 24 local development

This local structured build targets **Node.js 24.x**. See `NODE24_UPGRADE.md`. For the Jungle-only local lab, use `START_JUNGLE_LOCAL.bat`; for the complete backend/database install, use `SETUP_FULL_PROJECT_NODE24.bat`.
