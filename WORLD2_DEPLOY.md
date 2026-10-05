# World 2 deployment — no manual database migration

Upload this release over the existing repository, preserving the same structure:

```text
repo/
├── .github/
└── learnquest/
    ├── backend/
    ├── frontend/
    ├── package.json
    └── ...
```

Railway settings stay the same:

- Root Directory: `/learnquest`
- Existing `JWT_SECRET`: keep it unchanged
- Existing `MYSQL_URL=${{MySQL.MYSQL_URL}}`: keep it unchanged
- No new environment variable is required for Maths Kingdom
- No manual SQL import is required

On server startup, `seedDatabase()` safely upserts:

- Maths Kingdom as active World 2
- 10 Maths Kingdom levels
- 18 additional maths questions
- 3 new reward-shop items
- World 2 Level 1 progress for existing children who already completed Jungle Level 10

For children who have not completed Jungle Level 10, Maths Kingdom remains locked until they defeat the Jungle Guardian. Completing Jungle Level 10 after deployment unlocks Maths Kingdom automatically through normal backend progression.

After deploy, verify:

1. Open `/api/health` and confirm `ok: true`.
2. Login as a child who has not completed Jungle Level 10 — Maths Kingdom should show locked.
3. Complete Jungle Level 10 — the result screen should show **Enter Maths Kingdom**.
4. Maths Kingdom should open with Level 1 unlocked and Levels 2-10 locked.
5. Completing a Maths Kingdom level should unlock the next one and persist after refresh/login.
