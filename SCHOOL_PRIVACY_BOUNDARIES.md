# School foundation privacy boundaries

## Status and activation gate

The school data model is **disabled by default**. Its tables are created only when
`SCHOOL_FEATURE_ENABLED=true`. Enabling the schema is not approval to expose a
school UI or begin a pilot; legal/privacy review, role-authorisation endpoints,
retention configuration, backup/restore rehearsal, accessibility QA and educator
review remain release gates.

## Data minimisation

- Schools store a display name and operational settings, not child identity data.
- Class membership references the existing opaque child ID. It must not copy a
  child's name, PIN, email, photo, address, date of birth or parent details.
- Teachers are represented by an opaque account reference and school-scoped
  display label. Passwords, invitation secrets and child credentials never belong
  in school reporting tables.
- Curriculum evidence stores skill IDs, counts and server-verified outcomes. Raw
  gameplay telemetry and cosmetic scores are not mastery evidence.
- Real-child images, voiceprints, biometrics, device fingerprints and precise
  location are outside the V1 school model and must not be collected.

## Access and isolation boundary

Every future school API must enforce an authenticated role and school/class
membership on the server for each request. School admins and teachers must never
receive child PINs, auth tokens, parent contact details or another school's data.
Class leaderboards remain off by default. Parent access continues through the
existing parent-child relationship rather than school membership.

## Retention, export and deletion

Before a pilot, each deployment must define retention periods and identify its
controller/processor responsibilities and jurisdictional requirements. Exports
must contain the minimum educational evidence requested. Deleting a class
membership must not delete the family's child account; deleting the child account
must cascade its school membership and mastery rows. Administrative actions must
be audited without request bodies, secrets or child-authentication data.

## Telemetry boundary

Operational security logs and learning analytics are separate concerns. Logs may
include request IDs, route, status and coarse timings, but not answers, names,
PINs, bearer/run tokens or device fingerprints. Frame-time quality selection runs
locally and need not identify a device or child.
