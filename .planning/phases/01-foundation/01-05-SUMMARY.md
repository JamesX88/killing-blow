---
phase: 01-foundation
plan: 05
subsystem: auth
tags: [socket.io, jwt, cookie, redis, react, profile, route-guards, zustand]

requires:
  - phase: 01-foundation plan 03
    provides: Auth routes (register, login, me, logout), session store with checkSession
  - phase: 01-foundation plan 04
    provides: OAuth routes (Google/Discord), profile route with authenticate decorator
provides:
  - Socket.IO gateway with JWT cookie middleware rejecting unauthenticated connections
  - Redis client plugin for Fastify
  - Profile page with formatNumber, em dash rank, member-since date, sign out
  - Socket.IO client singleton (autoConnect:false, withCredentials:true)
  - App.tsx route guards: AuthRedirect at /, loading guard, /profile and /profile/:userId routes
affects: [phase-02, phase-03, game-loop, leaderboard]

tech-stack:
  added:
    - cookie (npm) - manual cookie header parsing in Socket.IO middleware
    - jsonwebtoken (npm) - JWT verification in Socket.IO middleware (independent of @fastify/jwt)
    - "@types/cookie, @types/jsonwebtoken" - TypeScript types
    - socket.io-client (dev, server package) - gateway integration test client
  patterns:
    - Socket.IO JWT middleware reads token from cookie header, rejects before connection event fires
    - Redis plugin with fastify-plugin fp() for shared decoration and onClose hook
    - AuthRedirect component using useSessionStore + Navigate for smart / redirect
    - isLoading guard in App.tsx prevents unauthenticated flash on page load

key-files:
  created:
    - packages/server/src/ws/gateway.ts
    - packages/server/src/ws/gateway.test.ts
    - packages/server/src/plugins/redis.ts
    - packages/client/src/pages/Profile.tsx
    - packages/client/src/lib/socket.ts
  modified:
    - packages/server/src/server.ts
    - packages/client/src/App.tsx
    - packages/server/package.json

key-decisions:
  - "Gateway uses manual jwt.verify() + cookie.parse() instead of fastify.authenticate — Socket.IO middleware runs outside Fastify request lifecycle"
  - "Redis plugin registered in server.ts before app.ready() so it participates in Fastify lifecycle; not registered in buildApp() to keep test isolation"
  - "Profile page fetches /profile/:userId using userId from session store; unauthenticated state redirected at component level via useEffect"
  - "App.tsx isLoading guard returns null during checkSession() to prevent rendering routes before session state is known"

patterns-established:
  - "Pattern: Socket.IO gateway test mocks Prisma and starts real HTTP server on isolated port (3099) with socket.io-client"
  - "Pattern: All game numbers in Profile page pass through formatNumber() from @killing-blow/shared-types"
  - "Pattern: AuthRedirect at route / provides smart redirect based on session state"

requirements-completed: [AUTH-03, AUTH-04]

duration: 12min
completed: 2026-03-18
---

# Phase 1 Plan 05: WebSocket Gateway, Profile Page, and Route Guards Summary

**Socket.IO JWT cookie gateway, Redis plugin, Profile page with formatNumber integration, and auth-aware route guards completing the Phase 1 auth flow**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-03-18T09:54:00Z
- **Completed:** 2026-03-18T09:57:30Z
- **Tasks:** 2 of 3 (Task 3 is human verification checkpoint)
- **Files modified:** 7

## Accomplishments
- Socket.IO gateway middleware verifies JWT from HTTP-only cookie before any connection event fires; unauthenticated and invalid-token connections are rejected with specific error messages
- Redis client plugin wired via fastify-plugin with connect-on-start and quit-on-close hooks
- Profile page renders username at 28px/600, kill count and rank via formatNumber(), em dash when rank is null, member since date, and sign out link
- App.tsx upgraded with session-aware AuthRedirect, loading guard (prevents unauthenticated flash), and Profile routes

## Task Commits

Each task was committed atomically:

1. **Task 1: WebSocket gateway with JWT middleware, Redis client plugin, and server.ts wiring** - `301a440` (feat)
2. **Task 2: Profile page, socket client, route guards, and App.tsx wiring** - `f7161c8` (feat)

_Task 3 is a human-verify checkpoint — awaiting browser verification_

## Files Created/Modified
- `packages/server/src/ws/gateway.ts` - Socket.IO JWT middleware + global-boss-room join on connection
- `packages/server/src/ws/gateway.test.ts` - TDD tests: no-cookie reject, invalid-token reject, valid-token accept
- `packages/server/src/plugins/redis.ts` - Redis createClient plugin with REDIS_URL env var
- `packages/server/src/server.ts` - Register Redis, await app.ready(), attach Socket.IO, call setupGateway(io)
- `packages/client/src/pages/Profile.tsx` - Full profile UI matching UI-SPEC: Display typography, formatNumber, em dash, sign out
- `packages/client/src/lib/socket.ts` - socket.io-client singleton (autoConnect:false, withCredentials:true)
- `packages/client/src/App.tsx` - AuthRedirect, checkSession on mount, isLoading guard, profile routes

## Decisions Made
- Used standalone `jsonwebtoken` + `cookie` packages in gateway.ts rather than Fastify's JWT plugin, because Socket.IO middleware operates outside the Fastify request/reply lifecycle — there is no `request.jwtVerify()` available there
- Redis plugin registered in `server.ts` (not in `buildApp()`/`app.ts`) to preserve test isolation — tests use `buildApp()` and don't need a Redis connection
- TDD gateway test starts a real HTTP server on port 3099 with a real Socket.IO server and connects via `socket.io-client` to exercise the actual middleware path

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added Prisma mock to gateway.test.ts**
- **Found during:** Task 1 TDD RED phase
- **Issue:** gateway.test.ts imports `buildApp` which transitively imports Prisma routes. Without DATABASE_URL set, PrismaClient initialization throws at test time
- **Fix:** Added `vi.mock('../db/prisma.js', ...)` at top of gateway.test.ts matching the pattern used in all other server tests
- **Files modified:** packages/server/src/ws/gateway.test.ts
- **Verification:** All 24 server tests pass
- **Committed in:** 301a440 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for test isolation; consistent with established Prisma mock pattern across all server tests.

## Issues Encountered
None beyond the Prisma mock deviation above.

## User Setup Required
None for automated tasks. Task 3 requires:
- `docker compose up -d` (Redis + PostgreSQL)
- `npx prisma migrate dev --name init`
- Start server and client, then verify full auth flow in browser

## Next Phase Readiness
- Phase 1 auth flow is complete end-to-end pending human browser verification (Task 3 checkpoint)
- WebSocket gateway is ready for Phase 2 game loop events
- Redis client is wired and available via `fastify.redis` decorator for Phase 2 boss HP atomics
- Profile page is ready; kill count and rank will update in Phase 2 when game loop writes to DB

## Self-Check: PASSED

- `packages/server/src/ws/gateway.ts` exists: FOUND
- `packages/server/src/ws/gateway.test.ts` exists: FOUND
- `packages/server/src/plugins/redis.ts` exists: FOUND
- `packages/client/src/pages/Profile.tsx` exists: FOUND
- `packages/client/src/lib/socket.ts` exists: FOUND
- Commit `301a440` exists: FOUND
- Commit `f7161c8` exists: FOUND

---
*Phase: 01-foundation*
*Completed: 2026-03-18*
