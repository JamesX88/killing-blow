# Roadmap: Killing Blow

## Overview

Four phases deliver the complete v1 experience. Phase 1 establishes the identity and number-safe infrastructure before any game logic runs. Phase 2 ships the product's reason to exist: a real-time shared boss HP bar with atomic killing blow detection. Phase 3 closes the incremental loop with gold, upgrades, and offline progress. Phase 4 layers on the social and prestige hooks that turn the loop into retention.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Auth, infrastructure, and big-number safety before any game logic is written (completed 2026-03-18)
- [ ] **Phase 2: Core Boss Loop** - Real-time shared HP bar, damage queue, and server-authoritative killing blow
- [x] **Phase 3: Player Progression** - Gold economy, stat upgrades, offline auto-attack, and active play bonus (completed 2026-03-19)
- [x] **Phase 4: Competition and Social** - Killing blow announcements, KB leaderboard, cosmetic titles, and boss lore (completed 2026-03-19)

## Phase Details

### Phase 1: Foundation
**Goal**: Players can create accounts, sign in, and the server infrastructure is wired up with number-safe primitives before a single line of game logic is written
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, UI-02
**Success Criteria** (what must be TRUE):
  1. Player can register a new account with a username and password and see their profile (username, kill count, leaderboard rank)
  2. Player can sign in via Google or Discord OAuth as an alternative to username/password
  3. Player session survives a browser refresh and returning to the URL after closing the tab
  4. All game numbers displayed anywhere in the app render with K/M/B/T suffixes and never show raw integers or Infinity/NaN
  5. Server is running with Redis + PostgreSQL reachable and WebSocket gateway accepting authenticated connections
**Plans:** 5/5 plans complete

Plans:
- [x] 01-01-PLAN.md — Monorepo scaffold, Docker Compose, shared-types with formatNumber
- [ ] 01-02-PLAN.md — Prisma schema, Fastify app factory, JWT auth, register/login routes
- [ ] 01-03-PLAN.md — Frontend scaffold with shadcn/ui, Register and Login pages
- [ ] 01-04-PLAN.md — OAuth2 Google/Discord flows, profile API endpoint
- [ ] 01-05-PLAN.md — WebSocket gateway, Profile page, route guards, end-to-end verification

### Phase 2: Core Boss Loop
**Goal**: All players worldwide share one live boss HP bar that drains from collective attacks, and the server atomically determines and broadcasts the killing blow winner
**Depends on**: Phase 1
**Requirements**: BOSS-01, BOSS-02, BOSS-03, KB-01, KB-04, UI-01
**Success Criteria** (what must be TRUE):
  1. Player opens the game in two separate browser tabs and both tabs show the same boss HP bar draining in real time as attacks land
  2. Player sees floating damage numbers for their own hits appear immediately on screen
  3. When a boss's HP reaches zero, a death animation plays and the next boss spawns without requiring a page reload
  4. Active player sidebar shows all players currently in the fight with their live damage contribution
  5. Killing blow winner is determined server-side and the award cannot be manipulated by a client sending fabricated damage values
**Plans:** 3/4 plans executed

Plans:
- [ ] 02-01-PLAN.md — Shared types, Prisma Boss/FightContribution models, kill-claim Lua script and bossState engine
- [ ] 02-02-PLAN.md — Gateway attack:intent handler, boss route, server.ts wiring with integration tests
- [ ] 02-03-PLAN.md — Client stores, game components (HP bar, sprite, damage numbers, sidebar), Game.tsx page
- [ ] 02-04-PLAN.md — Full test suite run and browser verification checkpoint

### Phase 3: Player Progression
**Goal**: Players earn gold from dealing damage, spend gold on stat upgrades that increase their DPS, accumulate offline progress when the tab is closed, and receive a bonus for active play
**Depends on**: Phase 2
**Requirements**: BOSS-04, PROG-01, PROG-02, PROG-03, PROG-04
**Success Criteria** (what must be TRUE):
  1. Player earns gold for every point of damage dealt and the gold balance updates visibly during each fight
  2. Player can spend gold on ATK, CRIT, and SPD upgrades and immediately sees their DPS increase; upgrade costs scale exponentially
  3. Player closes the tab for several hours, reopens it, and receives gold calculated from offline time using server-recorded last-seen timestamp (not client clock)
  4. Player with the browser tab focused deals measurably more DPS than the same player's offline rate
  5. Boss HP scales with the aggregate DPS of current active players so fights consistently last a reasonable duration regardless of player count
**Plans:** 3/3 plans complete

Plans:
- [ ] 03-01-PLAN.md — PlayerStats Prisma model, shared event types, playerStats.ts game math with TDD
- [ ] 03-02-PLAN.md — Upgrade REST route, gateway gold/heartbeat/offline extensions, dynamic boss HP scaling
- [ ] 03-03-PLAN.md — Client progression store, UpgradePanel, OfflineRewardToast, Game.tsx integration

### Phase 4: Competition and Social
**Goal**: The killing blow moment feels like an event, veteran players have a persistent leaderboard identity, and players can spend KB Currency on cosmetic titles and see boss lore during each fight
**Depends on**: Phase 3
**Requirements**: KB-02, KB-03, KB-05, UI-03, UI-04
**Success Criteria** (what must be TRUE):
  1. When a killing blow lands, a prominent announcement is visible to every connected player simultaneously showing the winner's name
  2. Global leaderboard tracks total killing blows per player and the winning player's kill count increments immediately after the announcement
  3. Post-boss death screen displays the top damage contributors for that fight
  4. Player can spend KB Currency to equip a cosmetic title that appears next to their name in the player sidebar and on the leaderboard
  5. Each boss displays a unique name and a brief lore snippet visible during the fight
**Plans:** 3/3 plans complete

Plans:
- [ ] 04-01-PLAN.md — Prisma migration, shared type extensions, title/lore catalogues, bossState lore integration
- [ ] 04-02-PLAN.md — Gateway kill flow extension, leaderboard and title shop REST endpoints
- [ ] 04-03-PLAN.md — Client UI: announcement overlay, leaderboard page, title shop, boss lore, sidebar titles

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 5/5 | Complete   | 2026-03-18 |
| 2. Core Boss Loop | 3/4 | In Progress|  |
| 3. Player Progression | 3/3 | Complete   | 2026-03-19 |
| 4. Competition and Social | 3/3 | Complete   | 2026-03-19 |
