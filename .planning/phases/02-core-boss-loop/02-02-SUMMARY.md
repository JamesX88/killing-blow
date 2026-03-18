---
phase: 02-core-boss-loop
plan: "02"
subsystem: api
tags: [socket.io, redis, prisma, websocket, real-time, boss-loop]

requires:
  - phase: 02-core-boss-loop/02-01
    provides: bossState.ts with applyDamage, spawnNextBoss, ensureActiveBoss, getBossState, getCurrentBossId, getBaseDamage

provides:
  - attack:intent WebSocket handler that processes damage atomically and broadcasts results to room
  - boss:hp_update broadcast to all clients on every attack
  - boss:damage_dealt emitted only to attacking socket (BOSS-02 foundation)
  - boss:death + immediate boss:spawn lifecycle on kill (BOSS-03)
  - GET /boss/current HTTP endpoint returning live boss state from Redis
  - Server spawns Boss #1 on startup via ensureActiveBoss
  - 100ms per-socket rate limiting on attack:intent
  - Full fight contribution persistence to Prisma on boss kill

affects:
  - 02-core-boss-loop/02-03 (client game UI subscribes to these events)
  - 02-03 (client socket hooks consume boss:hp_update, boss:death, boss:spawn, player:list_update)

tech-stack:
  added: []
  patterns:
    - ReturnType<typeof createClient> as canonical Redis type (avoids RedisClientType generic mismatch)
    - setupGateway(io, redis) — gateway receives Redis as parameter since it runs outside Fastify lifecycle
    - Per-socket rate limit via Map<string, number> cleared on disconnect
    - Prisma mocked in gateway tests — boss/fightContribution mock shapes declared in vi.mock factory

key-files:
  created:
    - packages/server/src/routes/boss.ts
  modified:
    - packages/server/src/ws/gateway.ts
    - packages/server/src/ws/gateway.test.ts
    - packages/server/src/app.ts
    - packages/server/src/server.ts
    - packages/server/src/types.d.ts
    - packages/server/src/game/bossState.ts
    - packages/server/src/game/bossState.test.ts

key-decisions:
  - "RedisClientType replaced with ReturnType<typeof createClient> across bossState.ts, gateway.ts, and types.d.ts — RedisClientType bare type is incompatible with the full generic returned by createClient()"
  - "boss:damage_dealt emitted via socket.emit() (not io.to()) to ensure only attacker receives floating damage numbers"
  - "ensureActiveBoss called in server.ts after app.ready() and redis available — not inside buildApp() to preserve test isolation"
  - "Boss defeat persistence (prisma.boss.update + fightContribution.createMany) happens synchronously inside the attack:intent handler before boss:spawn — guaranteed ordering"

requirements-completed: [BOSS-01, BOSS-03]

duration: 9min
completed: 2026-03-18
---

# Phase 2 Plan 02: Gateway Attack Handler Summary

**Server-side damage pipeline: attack:intent handler broadcasts boss HP to all sockets, sends damage numbers to attacker only, and triggers boss:death + boss:spawn lifecycle on kill, with 7-test integration suite and GET /boss/current endpoint**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-18T20:57:59Z
- **Completed:** 2026-03-18T21:07:00Z
- **Tasks:** 2 (1 standard + 1 TDD with RED/GREEN phases)
- **Files modified:** 8

## Accomplishments

- Created GET /boss/current HTTP endpoint behind fastify.authenticate, returning live boss state from Redis
- Implemented attack:intent handler: validates bossId staleness, applies atomic damage via Lua script, broadcasts boss:hp_update to global-boss-room, emits boss:damage_dealt to attacker socket only, and broadcasts player:list_update
- Boss kill path: emits boss:death with winnerId/winnerUsername, persists defeat + fight contributions to Prisma, then immediately spawns next boss and emits boss:spawn
- Wired server.ts to call ensureActiveBoss on startup and pass redis to setupGateway
- Wrote 7 integration tests covering all boss loop behaviors (TDD RED → GREEN)

## Task Commits

Each task was committed atomically:

1. **Task 1: Boss route and server.ts wiring** - `76b8d46` (feat)
2. **Task 2 RED: Add failing gateway tests** - `32072b4` (test)
3. **Task 2 GREEN: Implement attack:intent handler** - `bd17494` (feat)

_Note: TDD task has separate RED and GREEN commits_

## Files Created/Modified

- `packages/server/src/routes/boss.ts` - GET /boss/current authenticated endpoint
- `packages/server/src/ws/gateway.ts` - attack:intent handler with full damage pipeline
- `packages/server/src/ws/gateway.test.ts` - 7 integration tests for boss loop events
- `packages/server/src/app.ts` - registered bossRoutes plugin
- `packages/server/src/server.ts` - ensureActiveBoss on startup, redis passed to setupGateway
- `packages/server/src/types.d.ts` - FastifyInstance.redis type declaration
- `packages/server/src/game/bossState.ts` - RedisClientType → ReturnType<typeof createClient>
- `packages/server/src/game/bossState.test.ts` - updated Redis type to match

## Decisions Made

- `ReturnType<typeof createClient>` replaces `RedisClientType` everywhere — the bare `RedisClientType` from `redis` package is incompatible with the full generic type returned by `createClient()`, causing TypeScript errors when passing the client to functions
- `boss:damage_dealt` emitted via `socket.emit()` not `io.to()` — confirms attacker-only delivery
- Fight persistence is synchronous before `boss:spawn` emit — ensures Prisma records are written before client receives the new boss state

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Consolidated Redis type from RedisClientType to ReturnType<typeof createClient>**
- **Found during:** Task 1 (type checking after server.ts wiring)
- **Issue:** `RedisClientType` (no generics) is incompatible with `ReturnType<typeof createClient>` which includes full JSON/RESP module generics — caused TS2345 in redis.ts, boss.ts, bossState.ts
- **Fix:** Updated all Redis parameter types in bossState.ts, types.d.ts, and gateway.ts to use `ReturnType<typeof createClient>`; updated bossState.test.ts to import `vi` and use matching type
- **Files modified:** packages/server/src/game/bossState.ts, packages/server/src/types.d.ts, packages/server/src/ws/gateway.ts, packages/server/src/game/bossState.test.ts
- **Verification:** tsc --noEmit shows no new errors in modified files; all 39 tests pass
- **Committed in:** 76b8d46 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Required for TypeScript compilation. No scope creep — only type declarations changed, no behavior changes.

## Issues Encountered

- Server package has no `build` script (uses `tsx` directly) — plan's `pnpm --filter server build` acceptance criterion was replaced with `tsc --noEmit` type checking. All new code is type-safe.

## Next Phase Readiness

- Server-side damage pipeline fully wired: attack:intent → Lua kill-claim → broadcast results
- BOSS-01 (shared HP bar sync) and BOSS-03 (death + respawn) proven by integration tests
- Client game UI (Plan 02-03) can now connect sockets and subscribe to boss:hp_update, boss:death, boss:spawn, player:list_update events
- GET /boss/current provides initial page load state for the game view

---
*Phase: 02-core-boss-loop*
*Completed: 2026-03-18*
