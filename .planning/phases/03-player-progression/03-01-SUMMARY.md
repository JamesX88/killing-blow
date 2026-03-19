---
phase: 03-player-progression
plan: "01"
subsystem: server/game-math
tags: [prisma, tdd, game-math, socket-events, break-eternity, player-stats]
dependency_graph:
  requires: []
  provides:
    - PlayerStats Prisma model (DB table)
    - getPlayerDamage / getUpgradeCost / computeOfflineGold / creditGold / purchaseUpgrade
    - player:gold_update / player:stats_update / player:offline_reward / player:heartbeat socket events
  affects:
    - packages/server/src/game/playerStats.ts (new)
    - packages/server/prisma/schema.prisma (PlayerStats model added)
    - packages/shared-types/src/events.ts (4 new events)
tech_stack:
  added:
    - break_eternity.js in @killing-blow/server (was only in shared-types)
  patterns:
    - TDD (RED then GREEN) for all pure functions
    - Prisma $transaction for atomic gold credit and upgrade purchase
    - Default import pattern for Decimal from break_eternity.js
key_files:
  created:
    - packages/server/src/game/playerStats.ts
    - packages/server/src/game/playerStats.test.ts
    - packages/server/prisma/migrations/20260319093506_add_player_stats/migration.sql
  modified:
    - packages/server/prisma/schema.prisma
    - packages/shared-types/src/events.ts
    - packages/server/package.json
    - pnpm-lock.yaml
decisions:
  - "break_eternity.js uses default export for Decimal — import Decimal from 'break_eternity.js' not named import"
  - "break_eternity.js added as direct dependency to server package (not just transitive via shared-types)"
  - "Decimal(1000/1.5) floors to 666 not 667 — plan description was rounded but test uses correct floored value"
metrics:
  duration: 7 min
  completed: "2026-03-19"
  tasks_completed: 1
  files_created: 3
  files_modified: 4
requirements: [PROG-01, PROG-02, PROG-03]
---

# Phase 3 Plan 1: PlayerStats Model, Socket Events, and Game Math Summary

**One-liner:** TDD-driven PlayerStats Prisma model with atomic gold transactions and exponential upgrade cost math using break_eternity.js

## Tasks Completed

| Task | Description | Commit | Status |
|------|-------------|--------|--------|
| 1 (RED) | Failing tests for getPlayerDamage, getUpgradeCost, computeOfflineGold | 5aaacbb | Done |
| 1 (GREEN) | PlayerStats model + socket events + playerStats.ts implementation | ff0bc17 | Done |

## What Was Built

### PlayerStats Prisma Model
Added `model PlayerStats` to `packages/server/prisma/schema.prisma` with:
- `userId String @unique` — one-to-one with User
- `goldBalance String @default("0")` — stored as string for arbitrary precision
- `atkLevel / critLevel / spdLevel Int @default(0)` — three upgrade tracks
- `lastSeenAt / lastActiveAt DateTime` — for offline progress calculation
- `user User @relation(... onDelete: Cascade)` — foreign key with cascade delete
- Added `stats PlayerStats?` back-relation on User model
- Migration applied: `20260319093506_add_player_stats`

### Socket Event Types (shared-types)
Added to `ServerToClientEvents`:
- `player:gold_update` — sends goldBalance and goldEarned strings
- `player:stats_update` — sends all three stat levels + current gold balance
- `player:offline_reward` — goldEarned and offlineSeconds for the reward toast

Added to `ClientToServerEvents`:
- `player:heartbeat` — client ping to keep lastActiveAt fresh

### Game Math Module (playerStats.ts)
Pure functions with deterministic test coverage:

| Function | Formula |
|----------|---------|
| `getPlayerDamage` | damage = BASE_DAMAGE(25) + atkLevel*5; critChance = min(0.05 + critLevel*0.02, 0.80); attackDelay = max(50, floor(1000 / (1.0 + spdLevel*0.05))) |
| `getUpgradeCost` | base * growth^level; ATK: 10*1.15^n, CRIT: 25*1.15^n, SPD: 50*1.18^n |
| `computeOfflineGold` | offlineDps * cappedSeconds * 0.5; min 60s threshold, 8h cap |
| `creditGold` | Prisma $transaction with upsert+update for atomicity |
| `purchaseUpgrade` | $transaction; checks balance; increments stat level |

### Unit Tests (16 cases)
- `getPlayerDamage`: base stats, ATK scaling (+5/level), crit roll via vi.spyOn, SPD attack delay, crit cap at 0.80, minimum attackDelay of 50ms
- `getUpgradeCost`: base costs for all 3 stats, exponential scaling verification
- `computeOfflineGold`: formula correctness, 8h cap, 60s minimum, scaling with atkLevel

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed named import for Decimal to default import**
- **Found during:** Task 1 GREEN — tests failed with "Decimal is not a constructor"
- **Issue:** Plan specified `import { Decimal } from 'break_eternity.js'` but the package uses `module.exports = Decimal` (CJS default), so in ESM it is the default export. The shared-types package already uses `import Decimal from 'break_eternity.js'`
- **Fix:** Changed to `import Decimal from 'break_eternity.js'` in both playerStats.ts and playerStats.test.ts
- **Files modified:** packages/server/src/game/playerStats.ts, packages/server/src/game/playerStats.test.ts
- **Commit:** ff0bc17

**2. [Rule 3 - Blocking] Added break_eternity.js to server package.json**
- **Found during:** Task 1 GREEN — tests failed with "Cannot find package 'break_eternity.js'"
- **Issue:** break_eternity.js was only a dependency of shared-types, not server. Vitest resolves packages from the test file's workspace package, not transitively
- **Fix:** Added `"break_eternity.js": "^2.1.3"` to packages/server/package.json dependencies; ran pnpm install
- **Files modified:** packages/server/package.json, pnpm-lock.yaml
- **Commit:** ff0bc17

**3. [Rule 1 - Bug] Fixed test expectation for spdLevel:10 attackDelay (666 not 667)**
- **Found during:** Task 1 writing tests
- **Issue:** Plan description said attackDelay=667 for spdLevel:10, but `Math.floor(1000/1.5) = 666`
- **Fix:** Test written with correct value 666
- **Files modified:** packages/server/src/game/playerStats.test.ts
- **Commit:** 5aaacbb

### Pre-existing Issues (Out of Scope)
`gateway.test.ts` has 3-4 tests failing with Redis timeout errors. These were failing before this plan (no Redis server available in the test environment). Not caused by our changes. Deferred for Phase 3 integration work.

## Verification Results

- `pnpm --filter @killing-blow/server test --run -- playerStats.test.ts`: 16/16 playerStats tests pass
- `pnpm --filter @killing-blow/shared-types test --run`: 13/13 tests pass (no regressions)
- `grep "model PlayerStats" packages/server/prisma/schema.prisma`: match found
- `grep "player:gold_update" packages/shared-types/src/events.ts`: match found
- Migration `20260319093506_add_player_stats` applied to database

## Self-Check: PASSED

Files exist:
- packages/server/src/game/playerStats.ts: EXISTS
- packages/server/src/game/playerStats.test.ts: EXISTS
- packages/server/prisma/migrations/20260319093506_add_player_stats/migration.sql: EXISTS

Commits exist:
- 5aaacbb: test(03-01) — EXISTS
- ff0bc17: feat(03-01) — EXISTS
