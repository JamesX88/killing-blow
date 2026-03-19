---
phase: 04-competition-and-social
plan: 02
subsystem: server-backend
tags: [gateway, leaderboard, title-shop, kb-currency, redis, rest-api, tdd]
dependency_graph:
  requires: [04-01]
  provides: [leaderboard-endpoint, title-shop-endpoints, enriched-boss-death-payload]
  affects: [04-03-client-ui]
tech_stack:
  added: []
  patterns:
    - Redis hash boss:{bossId}:titles stores equippedTitle at attack time
    - prisma.user.update with increment for atomic killCount + kbBalance on kill
    - topContributors built from Redis at kill time (not DB) for current-fight authority
    - ownedTitles JSON string field parsed/serialized in route handlers
    - TDD red-green cycle for all new route and gateway tests
key_files:
  created:
    - packages/server/src/routes/leaderboard.ts
    - packages/server/src/routes/leaderboard.test.ts
    - packages/server/src/routes/titles.ts
    - packages/server/src/routes/titles.test.ts
  modified:
    - packages/server/src/ws/gateway.ts
    - packages/server/src/ws/gateway.test.ts
    - packages/server/src/app.ts
decisions:
  - "topContributors reads from Redis hashes at kill time — authoritative for current fight, no DB query needed"
  - "prisma.user.update with increment:1 for both killCount and kbBalance in a single atomic DB call"
  - "equippedTitle stored in boss:{bossId}:titles Redis hash at attack time via prisma.user.findUnique select"
  - "ownedTitles JSON parsed/serialized in route handlers — consistent with Plan 01 schema decision"
metrics:
  duration: 9 min
  completed_date: "2026-03-19"
  tasks_completed: 2
  files_created: 4
  files_modified: 3
---

# Phase 04 Plan 02: Server-side KB Currency, Leaderboard, and Title Shop Summary

**One-liner:** Extended gateway kill flow emits enriched boss:death with winnerTitle/winnerKillCount/topContributors; added paginated leaderboard and full title CRUD (list/purchase/equip) endpoints.

## What Was Built

### Task 1: Gateway kill flow extension + equippedTitle in Redis

Extended `packages/server/src/ws/gateway.ts`:
- During `attack:intent`: lookup player's `equippedTitle` from DB and store it in `boss:{bossId}:titles` Redis hash
- On boss kill: atomically increment winner's `killCount` and `kbBalance` via single `prisma.user.update`
- Build `topContributors` from Redis hashes (`boss:{bossId}:damage`, `boss:{bossId}:usernames`, `boss:{bossId}:titles`), sorted by `damageDealt` descending, limited to top 5
- Emit enriched `boss:death` payload: `winnerTitle`, `winnerKillCount`, `topContributors`

Added `user.findUnique` and `user.update` mocks to existing `Boss loop events` test suite.

### Task 2: Leaderboard and title shop endpoints

**`GET /leaderboard`** (authenticated):
- Returns users sorted by `killCount DESC` with pagination
- `page` and `limit` query params; `limit` capped at 100
- Response: `{ users, page, limit, total }`

**`GET /titles`** (authenticated):
- Returns full TITLE_CATALOGUE with `owned: boolean` and `equipped: boolean` per entry
- Also returns current `kbBalance`

**`POST /titles/:id/purchase`** (authenticated):
- Validates: title exists (404), title not already owned (400), sufficient `kbBalance` (400)
- On success: decrements `kbBalance`, appends titleId to `ownedTitles` JSON string

**`PATCH /titles/:id/equip`** (authenticated):
- Special case: `none` unequips (sets `equippedTitle: null`)
- Validates: title in catalogue (404), title in `ownedTitles` (403)
- On success: sets `equippedTitle` to titleId

Both routes registered in `buildApp()` via `leaderboardRoutes` and `titleRoutes` imports.

## Test Results

- `gateway.test.ts`: 17/18 passed (1 pre-existing failure — boss:spawn timeout, see Deferred Issues)
- `leaderboard.test.ts`: 4/4 passed
- `titles.test.ts`: 8/8 passed
- Full server suite: 89/91 passed (2 pre-existing failures unrelated to this plan)

## Commits

| Hash | Description |
|------|-------------|
| a7a9d89 | test(04-02): add failing Phase 4 tests for KB Currency kill flow and title Redis storage |
| 9f9475c | feat(04-02): extend gateway kill flow with KB Currency, title Redis storage, enriched boss:death |
| 66b28a8 | test(04-02): add failing tests for leaderboard and title shop routes |
| 5749351 | feat(04-02): add leaderboard and title shop REST endpoints |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added user.update and user.findUnique mocks to Boss loop events describe**
- **Found during:** Task 1 GREEN phase — gateway.ts now calls `prisma.user.findUnique` (equippedTitle lookup) and `prisma.user.update` (kill increment) which were not in the existing mock factory
- **Issue:** Pre-existing Boss loop tests for boss:death (Test 3) failed with "Cannot read properties of undefined (reading 'equippedTitle')" after the kill flow was extended
- **Fix:** Added `user.update: vi.fn()` to top-level mock factory; added `user.findUnique` and `user.update` mock values in the `Boss loop events` `beforeEach`
- **Files modified:** `packages/server/src/ws/gateway.test.ts`
- **Commit:** 9f9475c

## Deferred Issues

**Pre-existing: gateway.test.ts Test 4 — boss:spawn timeout**
- `spawnNextBoss` calls `prisma.boss.upsert` but the `Boss loop events` mock factory does not include `boss.upsert`
- The 3s delay + upsert failure means `boss:spawn` is never emitted, causing the 5000ms timeout
- Fix: Add `boss.upsert: vi.fn()` to the mock factory and mock it in `beforeEach`
- Confirmed pre-existing via `git stash` check
- Documented in `.planning/phases/04-competition-and-social/deferred-items.md`

**Pre-existing: playerStats.test.ts Test 14 — offline gold threshold**
- `computeOfflineGold` with 30 seconds offline returns non-zero gold (test expects Decimal(0) below 60s minimum)
- Unrelated to this plan's scope

## Self-Check: PASSED

| Item | Status |
|------|--------|
| packages/server/src/routes/leaderboard.ts | FOUND |
| packages/server/src/routes/leaderboard.test.ts | FOUND |
| packages/server/src/routes/titles.ts | FOUND |
| packages/server/src/routes/titles.test.ts | FOUND |
| .planning/phases/04-competition-and-social/04-02-SUMMARY.md | FOUND |
| Commit a7a9d89 (RED gateway tests) | FOUND |
| Commit 9f9475c (GREEN gateway implementation) | FOUND |
| Commit 66b28a8 (RED routes tests) | FOUND |
| Commit 5749351 (GREEN routes implementation) | FOUND |
