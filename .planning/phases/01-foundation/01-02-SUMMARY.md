---
phase: 01-foundation
plan: "02"
subsystem: auth
tags: [fastify, prisma, jwt, argon2, cookie, tdd, vitest]

requires:
  - 01-01 (monorepo scaffold, prisma schema, server package structure)
provides:
  - Fastify app factory (buildApp) wired with cookie + JWT plugins
  - PrismaClient singleton at packages/server/src/db/prisma.ts
  - authenticate decorator for route protection
  - POST /auth/register — creates user with argon2id hash, returns JWT cookie
  - POST /auth/login — verifies argon2id hash, returns JWT cookie + killCount
  - GET /auth/me — protected endpoint returning authenticated user profile
  - FastifyInstance type augmentation for authenticate + request.user
  - 11 passing auth route tests using vi.mock() prisma approach
affects:
  - 01-03 (client UI login/register pages depend on these endpoints)
  - 01-04 (OAuth routes will extend the same app factory pattern)
  - 01-05 (Socket.IO gateway uses the same authenticate decorator pattern)

tech-stack:
  added:
    - fastify-plugin 5.0.0 (encapsulation-breaking plugin pattern for decorators)
  patterns:
    - buildApp() factory pattern — Fastify instance created separately from server.ts for testability
    - fp() (fastify-plugin) to escape plugin encapsulation and share decorators across routes
    - vi.mock() prisma with mockImplementation to capture real argon2id hashes for login tests
    - Register-then-login test pattern — real argon2id hash captured from register, used in login test
    - try-catch around argon2.verify() to treat hash format errors as invalid credentials

key-files:
  created:
    - packages/server/src/db/prisma.ts
    - packages/server/src/plugins/cookie.ts
    - packages/server/src/plugins/jwt.ts
    - packages/server/src/app.ts
    - packages/server/src/server.ts
    - packages/server/src/types.d.ts
    - packages/server/src/routes/auth.ts
    - packages/server/src/routes/auth.test.ts
  modified:
    - packages/server/package.json (added fastify-plugin dependency)
    - pnpm-lock.yaml

key-decisions:
  - "argon2.verify() wrapped in try-catch to treat malformed hash errors as invalid credentials (not 500)"
  - "Login tests use register-then-login pattern to capture real argon2id hashes rather than mocking argon2"
  - "fastify-plugin (fp) used for cookie and JWT plugins to escape encapsulation and share decorators"

patterns-established:
  - "Pattern: buildApp() factory for all Fastify instance creation — never import app.listen() directly in tests"
  - "Pattern: fastify.authenticate as onRequest hook for protected routes"
  - "Pattern: COOKIE_OPTIONS constant with httpOnly=true, 30-day maxAge, sameSite=lax"

requirements-completed:
  - AUTH-01
  - AUTH-02

duration: 5min
completed: "2026-03-18"
---

# Phase 1 Plan 02: Auth Routes Summary

**JWT auth endpoints (register, login, me) with argon2id password hashing stored in httpOnly cookie — 11 tests pass using vi.mock() prisma with real argon2id hash capture pattern**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-18T13:33:54Z
- **Completed:** 2026-03-18T13:39:00Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Fastify app factory (`buildApp`) with cookie plugin registered before JWT plugin (required ordering)
- PrismaClient singleton with `fastify-plugin` used to escape encapsulation for shared decorators
- JWT plugin with `authenticate` decorator using `@fastify/jwt` cookie mode (`cookieName: 'token'`)
- POST /auth/register: validates input with Zod, argon2id hash, 409 on duplicate, JWT cookie response
- POST /auth/login: argon2id verification with error handling, 401 on bad credentials, JWT cookie
- GET /auth/me: protected by `fastify.authenticate`, returns `{id, username, killCount, kbRank}`
- httpOnly cookie with 30-day maxAge (2592000s), sameSite=lax, secure in production only
- All 11 tests pass: register (4 tests), login (4 tests), /me (2 tests + 1 combined)

## Task Commits

Each task was committed atomically:

1. **Task 1: Prisma singleton, Fastify app factory, JWT + cookie plugins** - `d585463` (feat)
2. **Task 2: TDD RED — failing tests for auth routes** - `c14d22a` (test)
3. **Task 2: TDD GREEN — implement auth routes** - `ef420da` (feat)

_Note: TDD task has two commits (test RED → feat GREEN)_

## Files Created/Modified

- `packages/server/src/db/prisma.ts` - PrismaClient singleton export
- `packages/server/src/plugins/cookie.ts` - @fastify/cookie registration with fp()
- `packages/server/src/plugins/jwt.ts` - @fastify/jwt registration + authenticate decorator
- `packages/server/src/app.ts` - buildApp() factory (cookie before JWT, auth routes at /auth)
- `packages/server/src/server.ts` - Production entry point with dotenv/config
- `packages/server/src/types.d.ts` - FastifyInstance.authenticate + FastifyRequest.user augmentation
- `packages/server/src/routes/auth.ts` - Register, login, me route handlers
- `packages/server/src/routes/auth.test.ts` - 11 TDD tests with vi.mock() prisma
- `packages/server/package.json` - fastify-plugin dependency added

## Decisions Made

- **argon2.verify try-catch:** `argon2.verify()` throws (not returns false) on malformed hash format. Wrapping in try-catch converts throw to `valid = false` so the response is a clean 401 rather than an unhandled 500 error. This is a correctness fix.
- **Register-then-login test pattern:** Instead of mocking argon2, the login tests call the register route first (which captures the real argon2id hash via `mockImplementation`), then pass that captured hash to `findUnique` for the login test. This tests the full argon2 round-trip without any mock.
- **fastify-plugin required:** Without `fp()`, cookie and JWT plugins are scoped to their encapsulation context. The `authenticate` decorator would not be visible to `authRoutes`. Using `fp()` breaks encapsulation to share state across the app.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Wrapped argon2.verify() in try-catch to prevent 500 on malformed hashes**
- **Found during:** Task 2 (TDD GREEN — tests returning 500 instead of 401)
- **Issue:** `argon2.verify()` throws an `Error` when given a malformed hash string (e.g., test fixture `$argon2id$...$fakehash`). The route had no error handling around verify, so the thrown error produced a 500.
- **Fix:** Wrapped `argon2.verify()` in try-catch; catch sets `valid = false` so the route continues to the standard 401 response
- **Files modified:** `packages/server/src/routes/auth.ts`
- **Commit:** `ef420da`

**2. [Rule 1 - Bug] Rewrote login tests to use register-then-login pattern with real hash capture**
- **Found during:** Task 2 (TDD GREEN — login tests failing due to fake hash causing 500)
- **Issue:** Initial login tests used a fake argon2id hash string that caused `argon2.verify()` to throw, making it impossible to test the "correct password" path without mocking argon2 itself
- **Fix:** Rewrote login tests to call the register route first with `mockImplementation` to capture the real hash, then pass that captured hash into `findUnique` mock for the login test. This validates the full argon2 hash/verify round-trip.
- **Files modified:** `packages/server/src/routes/auth.test.ts`
- **Commit:** `ef420da`

---

**Total deviations:** 2 auto-fixed (both Rule 1 bugs found during TDD GREEN phase)
**Impact on plan:** Fixes improved correctness and test reliability. No scope creep.

## Issues Encountered

- `argon2.verify()` behavior on malformed hashes is "throw" not "return false" — not obvious from the API docs. Fixed with try-catch.
- TDD loop caught the issue properly: RED showed missing file, GREEN showed verify behavior, iteration fixed the implementation.

## User Setup Required

- `packages/server/.env` file created with dev credentials (git-ignored). Copy from `.env.example` if needed.
- Docker Compose services (`docker compose up -d`) needed before running the server against a real database.
- Tests run with mocked prisma — no database required for `pnpm --filter server test --run`.

## Next Phase Readiness

- `buildApp()` factory ready for use in subsequent plan tests
- `fastify.authenticate` decorator available for any future protected route
- Auth endpoints (`/auth/register`, `/auth/login`, `/auth/me`) ready for client integration in Plan 03
- prisma singleton exported — Plans 03+ can import and use directly

---
*Phase: 01-foundation*
*Completed: 2026-03-18*

## Self-Check: PASSED

All created files verified on disk. All task commits verified in git log.

| Check | Result |
|-------|--------|
| packages/server/src/db/prisma.ts | FOUND |
| packages/server/src/plugins/cookie.ts | FOUND |
| packages/server/src/plugins/jwt.ts | FOUND |
| packages/server/src/app.ts | FOUND |
| packages/server/src/server.ts | FOUND |
| packages/server/src/types.d.ts | FOUND |
| packages/server/src/routes/auth.ts | FOUND |
| packages/server/src/routes/auth.test.ts | FOUND |
| .planning/phases/01-foundation/01-02-SUMMARY.md | FOUND |
| commit d585463 (Task 1) | FOUND |
| commit c14d22a (Task 2 RED) | FOUND |
| commit ef420da (Task 2 GREEN) | FOUND |
