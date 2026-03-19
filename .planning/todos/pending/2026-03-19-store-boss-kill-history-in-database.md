---
created: 2026-03-19T20:24:04.786Z
title: Store boss kill history in database
area: database
files:
  - packages/server/src/db/schema.ts
  - packages/server/src/game/bossManager.ts
---

## Problem

When a boss dies, the killing blow event fires and the KBA shows the winner — but this data is never persisted. There's no historical record of which bosses were defeated, who landed the killing blow, what element the boss was, or when it happened.

## Solution

Create a `boss_kills` table (or equivalent) in the database schema:

- `id`
- `boss_number` (the sequential boss counter)
- `boss_name` (generated name once element system is added)
- `boss_element` (once element system is added)
- `killer_username` (who landed the killing blow)
- `killed_at` (timestamp)
- `total_damage_dealt` (optional — sum of all player damage to that boss)
- `participant_count` (how many players hit it)

On boss death, server writes a record. This data can power:
- A "Hall of Fame" / kill log page
- Per-player stats ("You've landed X killing blows")
- Leaderboard enrichment (show recent kills)
