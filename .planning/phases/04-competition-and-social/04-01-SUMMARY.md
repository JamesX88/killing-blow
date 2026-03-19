---
phase: 04-competition-and-social
plan: "01"
subsystem: data-foundation
tags: [prisma, schema, shared-types, game-constants, tdd, lore, titles]
dependency_graph:
  requires: []
  provides: [User.kbBalance, User.ownedTitles, User.equippedTitle, BossState.lore, ActivePlayer.equippedTitle, ContributorEntry, TITLE_CATALOGUE, BOSS_LORE, getBossLore]
  affects: [boss-spawn, player-list, boss-death-event]
tech_stack:
  added: []
  patterns: [static-catalogue-constants, tdd-red-green, prisma-migration]
key_files:
  created:
    - packages/server/prisma/migrations/20260319132534_phase4_kb_currency_titles/migration.sql
    - packages/server/src/game/titles.ts
    - packages/server/src/game/bossLore.ts
  modified:
    - packages/server/prisma/schema.prisma
    - packages/shared-types/src/events.ts
    - packages/shared-types/src/index.ts
    - packages/server/src/game/bossState.ts
    - packages/server/src/game/bossState.test.ts
decisions:
  - "[04-01]: BOSS_LORE cycled with modulo — getBossLore(bossNumber % 10) gives repeating named bosses across unlimited boss count"
  - "[04-01]: ownedTitles stored as JSON string (String @default('[]')) on User — avoids Prisma scalar list limitations on PostgreSQL without array extension"
  - "[04-01]: equippedTitle stored in boss:{bossId}:titles Redis hash at attack time — no DB lookup in getActivePlayers hot path"
metrics:
  duration: 6 min
  completed_date: "2026-03-19"
  tasks_completed: 2
  files_changed: 9
---

# Phase 4 Plan 01: Data Foundation — Schema, Types, and Game Constants Summary

**One-liner:** Prisma migration adds kbBalance/ownedTitles/equippedTitle to User; shared types extended with lore, equippedTitle, ContributorEntry; 5-title and 10-lore static catalogues created; spawnNextBoss now names bosses from lore catalogue.

## What Was Built

**Task 1: Prisma schema + shared types + game constants**

Added three columns to the `User` model:
- `kbBalance Int @default(0)` — KB currency balance
- `ownedTitles String @default("[]")` — JSON-encoded title ID array
- `equippedTitle String?` — currently displayed title

Extended `packages/shared-types/src/events.ts`:
- `BossState.lore?: string` — optional boss flavour text
- `ActivePlayer.equippedTitle: string | null` — player's displayed title
- New `ContributorEntry` interface with `username`, `damageDealt`, `title`
- `boss:death` payload extended with `winnerTitle`, `winnerKillCount`, `topContributors`

Created static catalogues:
- `TITLE_CATALOGUE` — 5 titles: Slayer (1 KB), Annihilator (3 KB), Bane (5 KB), Executioner (10 KB), Destroyer (25 KB)
- `BOSS_LORE` — 10 named boss entries with flavour text; `getBossLore(bossNumber)` cycles via modulo

**Task 2: TDD — bossState lore integration + equippedTitle in getActivePlayers**

RED: Added 5 Phase 4 tests + fixed pre-existing mock bug (makeMockPrisma missing upsert method) + updated Test 7 name assertion.

GREEN implementation:
- `spawnNextBoss` imports `getBossLore`, destructures `{ name, lore }`, stores both in `boss:{id}:meta` JSON, returns `lore` in BossState
- `getBossState` parses `lore?` from meta and includes it in return value
- `getActivePlayers` reads `boss:{bossId}:titles` hash, maps `equippedTitle: titlesMap[userId] ?? null`

All 18 bossState tests pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed makeMockPrisma missing upsert method**
- **Found during:** Task 2 TDD RED (ran existing tests to check baseline)
- **Issue:** `makeMockPrisma` only had `boss.create` and `boss.update` but `spawnNextBoss` calls `prisma.boss.upsert`. This caused 4 pre-existing test failures.
- **Fix:** Added `boss.upsert` mock that returns a boss object from `args.create` data. Also updated Test 7 name assertion from `'Boss #1'` to `not.toMatch(/^Boss #/)` since the implementation now uses catalogue names.
- **Files modified:** `packages/server/src/game/bossState.test.ts`
- **Commit:** 24390c1

## Self-Check: PASSED

All 9 key files found on disk. All 3 task commits (2874fe6, 24390c1, 3b074e9) confirmed in git log. 18/18 bossState tests pass. Prisma migration applied (4 migrations, database in sync).
