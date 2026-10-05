# LearnQuest Node 24 Upgrade

## Runtime target

- Node.js: `24.x`
- npm: `11.17.0` (the version currently used on the Windows test machine)

## Dependency compatibility change

The previous backend lock resolved `better-sqlite3` 11.10.0. That line did not provide the required prebuilt binary for Node.js 24 in the failed Windows install, so npm fell back to `node-gyp`.

This build changes the backend dependency to:

```json
"better-sqlite3": "^13.0.3"
```

The database adapter only uses the stable synchronous APIs already present in current better-sqlite3 (`Database`, `pragma`, `exec`, `prepare().all/get/run`), so no application-level DB API rewrite was necessary.

## Local Jungle Lab isolation

`START_JUNGLE_LOCAL.bat` no longer runs the full backend postinstall. It performs:

```bat
npm install --ignore-scripts --no-audit --no-fund
```

for the root Three.js dependency only. This means Jungle environment work can run without SQLite, Python, node-gyp, login, API, Railway, or GitHub.

## Full local install

Run:

```bat
SETUP_FULL_PROJECT_NODE24.bat
```

It verifies Node 24, removes an incomplete backend `node_modules` directory, runs the complete install, and then runs `npm run check`.

## Package-lock note

The old Node-20-generated lockfiles were removed from this local upgrade package because they pinned `better-sqlite3` 11.x. On the first successful Node 24 / npm 11 install, fresh `package-lock.json` files will be generated automatically. Keep those regenerated lockfiles after the Windows install/test pass.
