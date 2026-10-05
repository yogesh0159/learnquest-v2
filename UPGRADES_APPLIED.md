# LearnQuest — Security, performance & code-quality upgrade pass

This documents everything upgraded in this pass, on top of the existing
`IMPLEMENTED_UPGRADES.md` feature set. Nothing here changes gameplay,
scoring, or the data model beyond widening one column — it's a hardening
and maintainability pass on the existing build.

## Security
- [x] Child PIN hashed with bcrypt instead of stored as plaintext
- [x] Automatic transparent migration: a legacy plaintext PIN is upgraded to
      a bcrypt hash the first time that child logs in successfully
- [x] Standalone `npm run migrate` script for widening the MySQL `pin`
      column and bulk-hashing every existing child's PIN immediately,
      without waiting for their next login
- [x] Rate limiting on parent signup/login and child PIN login (PIN login is
      keyed per child, not just per IP, so siblings aren't penalized for
      each other's typos)
- [x] General API rate limit as a ceiling against runaway/abusive clients
- [x] `helmet` security headers (CSP, X-Frame-Options, X-Content-Type-Options,
      etc.) — CSP allows `unsafe-inline` for now since several pages use
      inline `<script>` blocks; tightening this to nonces is a good follow-up
- [x] CORS locked to same-origin by default; `ALLOWED_ORIGINS` env var for the
      rare case the frontend is hosted separately from this API
- [x] `JWT_SECRET` is mandatory when `NODE_ENV=production` — the server now
      fails to start rather than falling back to a shared dev secret
- [x] Timing-safe login comparisons (parent login and child PIN login always
      run a bcrypt compare, even on a non-existent account, so response
      timing can't be used to enumerate valid emails/child IDs)
- [x] `trust proxy` enabled so rate limiting and logging see the real client
      IP behind Railway's reverse proxy
- [x] Sensitive fields (tokens, password hashes, PINs) redacted from logs

## Performance
- [x] `compression` middleware (gzip/brotli) on all API and static responses
- [x] Long-lived `Cache-Control` on static JS/CSS/vendor assets; `no-cache`
      on HTML so deploys are visible immediately to returning users
- [x] Existing 7-day cache on the locally-served Three.js vendor bundle kept
      and marked `immutable`

## Code quality & maintainability
- [x] `utils/validate.js` — shared, dependency-free validation helpers
      (email, PIN, password, string bounds, integer clamping) used by
      `routes/auth.js` instead of ad-hoc `String()`/`Number()` checks
      repeated per route
- [x] `utils/logger.js` — structured JSON logging via `pino`, replacing
      `console.log`/`console.error`; human-readable in local dev
- [x] `utils/rate-limit.js` — shared, named rate-limit configurations
- [x] Request logging middleware (method, path, status, duration) on every
      request

## Testing
- [x] `backend/test/` — Node.js built-in test runner (`node --test`), no new
      test-framework dependency
- [x] Coverage: validation helpers, PIN hashing/verification (including the
      legacy-plaintext compatibility path), JWT sign/verify middleware, and
      the game's pure mission/clamping helper functions
- [x] `npm test` added at both the repo root and `backend/`

## DevOps
- [x] `.github/workflows/ci.yml` (repo root) — runs `npm run check` and
      `npm test` on every push/PR to `main`
- [x] `/api/health` now reports `dbLatencyMs` alongside dialect/status
- [x] `.env.example` documents the new `NODE_ENV`, `ALLOWED_ORIGINS`, and
      `LOG_LEVEL` variables
- [x] `RAILWAY_SETUP.md` updated with the new required/optional variables
      and an "upgrading an existing deployment" section

## Explicitly out of scope for this pass
These were also identified as opportunities but are product/design work
rather than hardening, so they weren't built automatically:
- Additional playable worlds beyond Jungle (desert/ice/space are in the data
  model but need art + level design)
- Leaderboards, push notifications, offline/PWA support
- Voice narration for the 4-6 age group
- Deeper Three.js rendering optimizations (instancing/pooling) — a pass over
  `frontend/js/jungle-runner.js` found tile/prop geometry is already built
  once per spawned tile rather than per animation frame, so there was no
  obvious hot-path win to make safely without in-browser testing
