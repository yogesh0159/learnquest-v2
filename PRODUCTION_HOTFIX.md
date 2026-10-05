# Production hotfix — existing Railway/MySQL deployments

This build is based on the current GitHub project and preserves its CI, rate limiting,
validation, logging, Three.js runner, MySQL support, and tests.

## Automatic fixes

- Existing MySQL databases from older LearnQuest builds used `children.pin VARCHAR(16)`.
  Current builds store bcrypt hashes, so startup now automatically widens this column
  to `VARCHAR(255)`. No Railway shell command and no manual SQL is required.
- Child creation verifies that the parent still exists before inserting. A stale JWT
  now returns a clean `401 STALE_PARENT_SESSION` instead of a foreign-key `500`.
- Authenticated `401` responses clear stale browser sessions and redirect to the
  correct login page.
- CSP now permits the Google Fonts already referenced by the frontend and the
  jsDelivr/unpkg Three.js fallback URLs.
- The Create Child Profile form disables its submit button while saving to prevent
  duplicate submissions.

## Railway variables

Keep these on the `learnquest` application service:

```text
NODE_ENV=production
JWT_SECRET=<your existing strong private secret>
MYSQL_URL=${{MySQL.MYSQL_URL}}
```

Keep Railway Root Directory as `/learnquest`.

After deploy, open `/api/health`. It should report `database: "mysql"`.
