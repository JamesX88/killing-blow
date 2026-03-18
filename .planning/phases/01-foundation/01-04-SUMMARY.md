---
phase: 01-foundation
plan: "04"
subsystem: auth
tags: [fastify, oauth2, google, discord, jwt, cookie, prisma, profile, tdd, vitest]

requires:
  - 01-02 (buildApp factory, cookie+JWT plugins, authenticate decorator)

provides:
  - Google and Discord OAuth2 redirect + callback routes
  - OAuth callback upserts User and OAuthAccount records in Prisma
  - JWT cookie issued after OAuth sign-in (same COOKIE_OPTIONS as auth routes)
  - POST /auth/logout clears JWT cookie
  - GET /profile/:userId protected endpoint returning {id, username, killCount, kbRank, createdAt}
  - 10 new tests covering oauth callbacks and profile route

affects:
  - 01-03 (client login/OAuth pages can now call these endpoints)
  - 01-05 (Socket.IO gateway builds on same authenticate decorator pattern)

tech-stack:
  added:
    - "@fastify/oauth2 8.2.0 (already in package.json from Plan 01-01 setup)"
  patterns:
    - Conditional OAuth plugin registration (only registers if env vars are set — avoids startup failure in test env without credentials)
    - OAuth callback: find-then-update-or-create pattern (no upsert used; explicit findUnique+update or create for clarity)
    - vi.stubGlobal('fetch', mockFetch) for mocking global fetch in OAuth callback tests
    - Direct property assignment to fastify instance (app.googleOAuth2 = mock) to bypass plugin encapsulation in tests
    - TDD: profile.ts created as blocking-import fix (Rule 3) then tested with 4 profile tests

key-files:
  created:
    - packages/server/src/plugins/oauth.ts
    - packages/server/src/routes/oauth.ts
    - packages/server/src/routes/oauth.test.ts
    - packages/server/src/routes/profile.ts
    - packages/server/src/routes/profile.test.ts
  modified:
    - packages/server/src/app.ts (added oauthPlugin + oauthRoutes + profileRoutes registration)

key-decisions:
  - "Conditional OAuth registration: wrap each provider block in if (CLIENT_ID && CLIENT_SECRET) so buildApp() works in tests without real OAuth credentials set"
  - "OAuth callback uses find-then-update-or-create (not prisma upsert) for OAuthAccount to allow including the user relation in a single query"
  - "profile.ts created alongside oauth.ts (Task 1) as a Rule 3 auto-fix to unblock the app.ts import — TDD tests written in Task 2 confirm the implementation"

metrics:
  duration: "3 min"
  completed: "2026-03-18"
  tasks: 2
  files: 6
---

# Phase 1 Plan 04: OAuth2 + Profile Routes Summary

**Google and Discord OAuth2 callbacks with user upsert and JWT cookie issuance, plus protected profile endpoint — 21 total server tests pass (11 auth + 6 oauth + 4 profile)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-18T13:45:16Z
- **Completed:** 2026-03-18T13:48:41Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- `packages/server/src/plugins/oauth.ts`: Registers `googleOAuth2` (with PKCE S256) and `discordOAuth2` plugins only when credentials are present in env — prevents startup failure in test environments
- `packages/server/src/routes/oauth.ts`: Google and Discord callback handlers that fetch user info, upsert OAuthAccount+User records, sign a JWT, set httpOnly cookie, and redirect to `CLIENT_URL/profile`
- `packages/server/src/routes/oauth.ts`: POST `/auth/logout` clears the `token` cookie
- `packages/server/src/app.ts`: Updated to register oauthPlugin, oauthRoutes (/auth prefix), and profileRoutes
- `packages/server/src/routes/profile.ts`: GET `/profile/:userId` protected by `fastify.authenticate`, returns `{id, username, killCount, kbRank, createdAt}`, 401 unauthenticated, 404 not found
- `packages/server/src/routes/oauth.test.ts`: 6 tests — Google new user, Google existing user (token refresh), Google failure redirect, Discord new user, Discord failure redirect, logout cookie clear
- `packages/server/src/routes/profile.test.ts`: 4 tests — authenticated 200 with correct shape, unauthenticated 401, nonexistent 404, killCount=0 for new users

## Task Commits

Each task was committed atomically:

1. **Task 1: OAuth2 plugin registration and callback route handlers** - `d4a88d8` (feat)
2. **Task 2: Protected profile route with TDD tests** - `bb76ba1` (feat)

## Files Created/Modified

- `packages/server/src/plugins/oauth.ts` - Google + Discord OAuth2 plugin with conditional registration and PKCE
- `packages/server/src/routes/oauth.ts` - OAuth callback handlers and logout route
- `packages/server/src/routes/oauth.test.ts` - 6 OAuth callback tests with mocked token exchange and fetch
- `packages/server/src/routes/profile.ts` - Protected profile GET endpoint
- `packages/server/src/routes/profile.test.ts` - 4 TDD profile route tests
- `packages/server/src/app.ts` - Added OAuth plugin + routes + profile routes registration

## Decisions Made

- **Conditional OAuth registration:** Each provider block is wrapped in `if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET)`. This allows `buildApp()` to succeed in unit tests without real OAuth credentials in the environment. Without this, the `@fastify/oauth2` plugin would attempt network requests or fail on missing credentials during `app.ready()`.
- **Find-then-update-or-create over prisma.upsert:** The OAuth callback uses `prisma.oAuthAccount.findUnique({ include: { user: true } })` then either updates or creates. This is preferred over `upsert` because it allows fetching the related `user` record in the same query (upsert with `include` on create path is more complex and less readable).
- **profile.ts created in Task 1 as Rule 3 auto-fix:** `app.ts` imports `profileRoutes` from `profile.ts`. Since `app.ts` was modified in Task 1, the missing import would have crashed all tests. Creating the full implementation immediately rather than a stub avoids a two-step write — the TDD tests in Task 2 then confirmed the implementation is correct.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created profile.ts alongside oauth.ts in Task 1 to unblock app.ts import**
- **Found during:** Task 1 — updating `app.ts` to add `import profileRoutes from './routes/profile.js'`
- **Issue:** The import in `app.ts` would make all tests fail with "Cannot find module './routes/profile.js'" until profile.ts existed
- **Fix:** Created complete `profile.ts` implementation immediately (the plan's intended implementation) rather than a stub, then wrote the TDD tests in Task 2 to confirm correctness
- **Files modified:** `packages/server/src/routes/profile.ts`
- **Commit:** `d4a88d8` (included with Task 1 oauth files)

No other deviations — plan executed as specified.

## Issues Encountered

- None beyond the profile.ts import blocking issue (Rule 3 auto-fix above)

## User Setup Required

OAuth providers require real credentials to function end-to-end:
- **Google:** Create OAuth 2.0 Client ID in Google Cloud Console, add `http://localhost:3000/auth/google/callback` as authorized redirect URI, add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to `.env`
- **Discord:** Create Application in Discord Developer Portal, add `http://localhost:3000/auth/discord/callback` as redirect URI, add `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` to `.env`
- Also set `SERVER_URL=http://localhost:3000` and `CLIENT_URL=http://localhost:5173` in `.env`

Tests run without real credentials — OAuth plugin registration is conditional on env var presence.

## Next Phase Readiness

- OAuth sign-in flows (`/auth/google`, `/auth/discord`) are functional when credentials are configured
- Profile endpoint (`/profile/:userId`) ready for client integration in Plan 03 UI
- All authentication routes complete: register, login, OAuth (Google+Discord), logout, me, profile
- AUTH-03 and AUTH-04 requirements satisfied

---
*Phase: 01-foundation*
*Completed: 2026-03-18*

## Self-Check: PASSED

All created files verified on disk. All task commits verified in git log.

| Check | Result |
|-------|--------|
| packages/server/src/plugins/oauth.ts | FOUND |
| packages/server/src/routes/oauth.ts | FOUND |
| packages/server/src/routes/oauth.test.ts | FOUND |
| packages/server/src/routes/profile.ts | FOUND |
| packages/server/src/routes/profile.test.ts | FOUND |
| packages/server/src/app.ts (modified) | FOUND |
| .planning/phases/01-foundation/01-04-SUMMARY.md | FOUND |
| commit d4a88d8 (Task 1) | FOUND |
| commit bb76ba1 (Task 2) | FOUND |
