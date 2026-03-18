---
phase: 02-core-boss-loop
plan: 01
subsystem: database
tags: [redis, lua, prisma, socket.io, typescript, boss-loop, kill-claim]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Prisma User model, Redis plugin, Socket.IO gateway, shared-types package
provides:
  - BossState and ActivePlayer typed interfaces in shared-types
  - 6 typed Socket.IO events (boss:hp_update, boss:damage_dealt, boss:death, boss:spawn, player:list_update, attack:intent)
  - Boss and FightContribution Prisma models with migration applied
  - killClaim.lua atomic Redis Lua script with SETNX kill-claim
  - bossState.ts engine: applyDamage, spawnNextBoss, ensureActiveBoss, getActivePlayers, getBossState, getCurrentBossId, getBaseDamage
affects:
  - 02-02-gateway-handler (consumes applyDamage, ensureActiveBoss, getBaseDamage, typed events)
  - 02-03-client-ui (consumes BossState, ActivePlayer, all 6 typed events)
  - 03-progression (consumes getBaseDamage, FightContribution model)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Redis Lua eval via redis.eval() with keys/arguments arrays
    - SETNX for atomic single-winner kill-claim across concurrent requests
    - Redis Hash for damage tracking (boss:{id}:damage) and username lookup (boss:{id}:usernames)
    - boss:{id}:meta JSON blob for name/bossNumber without DB lookup
    - TDD with real Redis connection in beforeAll/afterAll + flushDb in beforeEach

key-files:
  created:
    - packages/shared-types/src/events.ts
    - packages/server/src/game/killClaim.lua
    - packages/server/src/game/bossState.ts
    - packages/server/src/game/bossState.test.ts
    - packages/server/prisma/migrations/20260318204859_add_boss_models/migration.sql
  modified:
    - packages/shared-types/src/index.ts
    - packages/server/prisma/schema.prisma

key-decisions:
  - "BASE_DAMAGE=25 and BOSS_MAX_HP=1000 hardcoded as Phase 2 constants — Phase 3 replaces with stat lookup"
  - "last-1% threshold = floor(maxHp * 0.01) = 10 for 1000 HP bosses"
  - "Username stored in separate Redis Hash boss:{id}:usernames alongside damage hash — avoids DB lookup in getActivePlayers"
  - "boss:{id}:meta JSON blob stores name+bossNumber so getBossState needs no DB query"
  - "Lua script floors HP at 0 via SET after DECRBY returns negative — prevents integer underflow on simultaneous kill hits"

patterns-established:
  - "Pattern 1: Lua kill-claim — DECRBY then SETNX in single atomic script; only first caller with newHp==0 gets the kill"
  - "Pattern 2: TDD with real Redis — connect in beforeAll, flushDb in beforeEach, quit in afterAll"
  - "Pattern 3: RedisClientType from 'redis' passed explicitly to engine functions (not via Fastify decorator) for testability"

requirements-completed: [KB-01, KB-04]

# Metrics
duration: 6min
completed: 2026-03-18
---

# Phase 2 Plan 01: Shared Types, Prisma Schema, and Kill-Claim Engine Summary

**Redis Lua kill-claim script with SETNX atomicity, Boss/FightContribution Prisma models, and typed Socket.IO events establishing the server-authoritative damage pipeline foundation**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-18T20:48:00Z
- **Completed:** 2026-03-18T20:54:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Typed Socket.IO contracts (BossState, ActivePlayer, 6 events) with no damage values in ClientToServerEvents
- Boss and FightContribution Prisma models with migration applied to PostgreSQL
- killClaim.lua: atomic HP decrement + SETNX kill-claim + last-1% eligibility tracking in single Lua execution
- bossState.ts engine with 7 exported functions covering the full boss lifecycle
- 8 unit tests passing including concurrent kill race condition (KB-01) and last-1% eligibility (KB-04)

## Task Commits

Each task was committed atomically:

1. **Task 1: Shared types and Prisma schema** - `cfe1de2` (feat)
2. **Task 2: Failing tests (RED phase)** - `3cde46a` (test)
3. **Task 2: Kill-claim Lua + bossState engine (GREEN phase)** - `d7bac22` (feat)

_Note: TDD task has separate test and implementation commits per TDD protocol_

## Files Created/Modified

- `packages/shared-types/src/events.ts` - BossState, ActivePlayer interfaces and all 6 typed Socket.IO events
- `packages/shared-types/src/index.ts` - Re-exports BossState and ActivePlayer alongside existing exports
- `packages/server/prisma/schema.prisma` - Added Boss model (bossNumber unique), FightContribution model (@@unique bossId+userId), contributions relation on User
- `packages/server/prisma/migrations/20260318204859_add_boss_models/migration.sql` - Applied migration
- `packages/server/src/game/killClaim.lua` - Atomic Redis Lua script: HINCRBY damage, HSET last1pct when prevHp <= threshold, DECRBY hp (floor 0), SETNX kill claim
- `packages/server/src/game/bossState.ts` - Engine: applyDamage, spawnNextBoss, ensureActiveBoss, getActivePlayers, getBossState, getCurrentBossId, getBaseDamage
- `packages/server/src/game/bossState.test.ts` - 8 unit tests covering all behaviors including concurrent kill race

## Decisions Made

- BASE_DAMAGE=25 and BOSS_MAX_HP=1000 are Phase 2 hardcoded constants; `getBaseDamage()` function provides the interface point for Phase 3 stat lookup replacement
- Username stored in `boss:{id}:usernames` Redis hash (gateway handler sets it on first attack) to avoid DB queries in getActivePlayers
- `boss:{id}:meta` JSON blob stores name+bossNumber at spawn time so getBossState reads only from Redis
- Lua script uses `tonumber(redis.call('GET', KEYS[1]) or '0')` for safe prevHp read before DECRBY to handle empty key edge case

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Prisma `generate` failed on Windows with EPERM rename error (DLL file locked by running Node processes). The migration applied successfully and the client types were already generated — only the binary DLL update failed. Verified via `prisma validate` (exits 0) and direct inspection of generated `index.d.ts` confirming Boss and FightContribution types are present.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All types, Prisma models, and engine functions are ready for 02-02 (gateway handler)
- Gateway handler needs to: call `ensureActiveBoss` on connection, handle `attack:intent`, call `applyDamage(redis, bossId, userId, getBaseDamage(), BOSS_MAX_HP)`, set `boss:{id}:usernames` hash on first attack
- KB-01 atomicity verified: concurrent kill attempts with SETNX guarantee exactly one winner
- KB-04 last-1% tracking verified: threshold=10 for 1000 HP boss

---
*Phase: 02-core-boss-loop*
*Completed: 2026-03-18*

## Self-Check: PASSED

- FOUND: packages/shared-types/src/events.ts
- FOUND: packages/server/src/game/killClaim.lua
- FOUND: packages/server/src/game/bossState.ts
- FOUND: packages/server/src/game/bossState.test.ts
- FOUND: packages/server/prisma/schema.prisma
- FOUND commit d7bac22 (feat: Lua + engine)
- FOUND commit 3cde46a (test: RED phase)
- FOUND commit cfe1de2 (feat: shared types + Prisma schema)
