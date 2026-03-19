---
phase: 03-player-progression
plan: "02"
subsystem: server-game-loop
tags: [server, websocket, rest, gold, heartbeat, offline-progress, boss-scaling]
dependency_graph:
  requires: ["03-01"]
  provides: ["upgrade-route", "gold-award", "heartbeat-active-bonus", "offline-progress", "dynamic-boss-hp"]
  affects: ["gateway", "bossState", "app"]
tech_stack:
  added: []
  patterns:
    - "Register socket event handlers synchronously before any awaits in connection handler"
    - "Mock playerStats module in gateway tests to avoid $transaction complexity"
    - "setImmediate for connection async init (player list + offline check) after handler registration"
key_files:
  created:
    - packages/server/src/routes/upgrades.ts
    - packages/server/src/routes/upgrades.test.ts
  modified:
    - packages/server/src/ws/gateway.ts
    - packages/server/src/ws/gateway.test.ts
    - packages/server/src/game/bossState.ts
    - packages/server/src/game/bossState.test.ts
    - packages/server/src/app.ts
decisions:
  - "Socket event handlers registered synchronously before any awaits in io.on('connection') — prevents Socket.io from dropping events that arrive during async init"
  - "setImmediate used for async connection init (player list send + offline progress) so handlers are registered first"
  - "creditGold mocked at module level in gateway tests to avoid $transaction complexity across test isolation boundaries"
metrics:
  duration: "14 min"
  completed_date: "2026-03-19"
  tasks_completed: 2
  files_modified: 7
---

# Phase 3 Plan 02: Server Logic — Gold, Upgrades, Heartbeat, Offline Progress, Dynamic Boss HP Summary

Full Phase 3 server logic wired: stat-based damage gateway, gold award pipeline, upgrade REST endpoint, heartbeat active bonus, offline gold calculation on reconnect, and aggregate-DPS-based dynamic boss HP scaling.

## Tasks Completed

### Task 1: Upgrade route, dynamic boss HP, and app.ts wiring

**Created `packages/server/src/routes/upgrades.ts`**
- `POST /upgrades/:stat` — validates stat (atk/crit/spd), calls `purchaseUpgrade`, returns updated stats or 400 with error
- `GET /upgrades/costs` — returns current levels + costs for all 3 stats and goldBalance
- Uses `prisma` imported directly (matching project pattern from auth.ts/profile.ts)

**Created `packages/server/src/routes/upgrades.test.ts`**
- 6 test cases: success purchase, insufficient gold 400, invalid stat 400, unauthenticated 401, GET costs 200, GET costs 401
- Mocks `$transaction` to simulate purchaseUpgrade's atomic balance deduction

**Extended `packages/server/src/game/bossState.ts`**
- Added `computeAggregateDps(redis, prisma, bossId)` — reads `boss:{id}:damage` hash, computes totalDamage/fightSeconds using boss record timestamps
- Extended `spawnNextBoss` with optional `overrideMaxHp` parameter, clamped to [1000, 10_000_000]
- Added constants: `TARGET_FIGHT_DURATION = 300`, `MIN_BOSS_HP = 1000`, `MAX_BOSS_HP = 10_000_000`
- `getBaseDamage` preserved for backward compatibility

**Extended `packages/server/src/game/bossState.test.ts`**
- Added `computeAggregateDps` tests: correct DPS calculation, returns 0 when no defeatedAt
- Added `spawnNextBoss` override tests: 5000 HP accepted, clamped below MIN, clamped above MAX

**Updated `packages/server/src/app.ts`**
- Added `import upgradeRoutes` and `await app.register(upgradeRoutes)`

### Task 2: Gateway extensions — gold award, heartbeat, offline progress, stat-based damage, dynamic boss HP on kill

**Extended `packages/server/src/ws/gateway.ts`**
- Replaced `getBaseDamage()` with `getPlayerDamage(playerStats)` — loads PlayerStats via `prisma.playerStats.upsert`
- Active bonus: checks `player:{userId}:heartbeat` Redis key, multiplies damage by `ACTIVE_BONUS_MULTIPLIER (2.0)` when present
- Rate limit updated: 50ms DoS floor + per-player `damageResult.attackDelay` check
- Gold award: `creditGold(prisma, userId, goldEarned)` after each attack, emits `player:gold_update`
- `player:heartbeat` handler: sets `player:{userId}:heartbeat` Redis key with 10s TTL
- Connection handler (via setImmediate): checks `lastSeenAt` gap, emits `player:offline_reward` if > 60s offline, updates `lastSeenAt`
- Disconnect handler: upserts `lastSeenAt: new Date()`, deletes heartbeat key
- Kill path: calls `computeAggregateDps`, passes `dynamicMaxHp = aggregateDps * 300` to `spawnNextBoss`
- **Critical fix**: all `socket.on()` handlers registered synchronously before any awaits; async init moved to `setImmediate`

**Extended `packages/server/src/ws/gateway.test.ts`**
- Added `playerStats` mock to prisma mock factory
- Added `vi.mock('../game/playerStats.js', ...)` to stub `creditGold` (avoids $transaction complexity in test isolation)
- Added Test 2b: gold_update emitted with positive goldEarned
- Added Test 8: heartbeat sets Redis TTL key
- Added Test 9: offline_reward emitted on connect with old lastSeenAt
- Added Test 10: disconnect calls playerStats.upsert with lastSeenAt
- Fixed Test 1/5: hp assertions updated to `toBeLessThan(1000)` (stat-based damage varies with crit)
- Fixed Test 3/4: HP set to 1 for deterministic kill trigger
- Fixed Test 4: timeout increased to 5000ms for 3000ms server-side spawn delay

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Socket event handlers registered after await prevented event delivery**
- **Found during:** Task 2 — player:heartbeat and attack:intent events were dropped when emitted before handler registration
- **Issue:** The original connection handler had awaits (getCurrentBossId, getActivePlayers, prisma.playerStats.findUnique) before `socket.on()` calls. Socket.io does not buffer events for unregistered handlers.
- **Fix:** Moved all `socket.on()` calls to top of connection handler (synchronous), moved async init (player list send + offline progress) into `setImmediate` callback.
- **Files modified:** `packages/server/src/ws/gateway.ts`
- **Commit:** 2ddaa90

**2. [Rule 2 - Missing Critical] Gateway tests needed creditGold mock to isolate from $transaction**
- **Found during:** Task 2 — gateway tests intermittently failed due to `$transaction` mock complexity across test isolation boundaries
- **Fix:** Added `vi.mock('../game/playerStats.js', ...)` to stub `creditGold` to always return `'25'` in gateway tests; tests become hermetic.
- **Files modified:** `packages/server/src/ws/gateway.test.ts`
- **Commit:** 2ddaa90

**3. [Rule 1 - Bug] Pre-existing gateway test failures (9 tests) from missing playerStats mock**
- **Found during:** Initial test run — gateway tests failed because attack:intent handler was being called but playerStats wasn't mocked
- **Fix:** Added `playerStats: { findUnique, upsert, update }` to the gateway test's prisma mock factory
- **Files modified:** `packages/server/src/ws/gateway.test.ts`
- **Commit:** 2ddaa90

## Self-Check: PASSED

All created files confirmed present. Both task commits confirmed in git history.
- packages/server/src/routes/upgrades.ts: FOUND
- packages/server/src/routes/upgrades.test.ts: FOUND
- packages/server/src/ws/gateway.ts: FOUND
- packages/server/src/game/bossState.ts: FOUND
- Commit 5b0eef9 (Task 1): FOUND
- Commit 2ddaa90 (Task 2): FOUND
- All 70 server tests pass
