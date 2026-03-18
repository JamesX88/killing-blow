# Killing Blow

## What This Is

A browser-based multiplayer idle-incremental game where all players worldwide fight the same boss simultaneously in real-time. Players deal damage, earn gold for upgrades, and compete to land the titular "killing blow" — the final hit that kills the boss — earning cosmetic prestige and a spot on the leaderboard. When a boss dies, the next one spawns immediately with greater difficulty, creating an endless escalating loop.

## Core Value

Every player is always in the same fight — the tension of watching a boss's HP drain in real-time, knowing anyone could land the killing blow, is what makes this different from every other idle game.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] All players globally fight the same boss simultaneously with real-time HP sync
- [ ] Boss HP bar drains visibly as players deal damage, with floating damage numbers
- [ ] Active player sidebar shows live contributor list and their DPS/damage
- [ ] When a boss dies, the next boss spawns immediately (endless escalating sequence)
- [ ] Player who lands the killing blow receives KB Currency and leaderboard entry
- [ ] KB Currency used for cosmetics only: titles, visual effects, kill counter display
- [ ] Gold earned from boss participation funds stat upgrades and equipment
- [ ] Equipment system with craftable/purchasable gear pieces across tiers
- [ ] Flat stat upgrades (attack, crit, speed) purchasable with gold
- [ ] Offline auto-attack: player's DPS contributes at reduced rate while away
- [ ] Active play bonus: multipliers or special moves for logged-in players
- [ ] Persistent player accounts with progression saved across sessions

### Out of Scope

- Prestige/reset mechanic — not decided; can be added as v2 feature
- Mobile app — web-first, mobile later
- PvP / player vs player combat — cooperative boss fight only
- Player-created rooms or lobbies — global shared boss is the identity of the game

## Context

- Web browser is the target platform — no install, accessible via URL, naturally keeps open in background tabs (key for idle games)
- Real-time visibility of all players attacking is a core social hook, not a nice-to-have
- The "killing blow" moment needs to feel special — announcement, visual effect, everyone sees it happen
- Global single boss creates a shared narrative: "we're all on boss 47 right now"
- WebSockets or similar real-time tech required for boss HP sync and player damage feed
- Idle games succeed on satisfying number growth — the upgrade/equipment curve needs careful tuning

## Constraints

- **Platform**: Web browser — must work without install, responsive UI
- **Real-time**: Boss HP and damage events must sync across all players with low enough latency to feel live
- **Scale**: Single global boss means all active players hit the same data — architecture must handle concurrent damage events without race conditions
- **Idle**: Offline progress tracking requires server-side tick or calculation on reconnect

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Global single boss (not rooms/shards) | Core identity — shared experience, shared leaderboard | — Pending |
| KB Currency = cosmetics only | Keeps gameplay fair, prestige through recognition not power | — Pending |
| Web browser (not mobile) | Idle games suit background tabs; widest reach without app install | — Pending |
| Endless boss sequence (not fixed list) | Always something to kill, number goes up forever | — Pending |

---
*Last updated: 2026-03-18 after initialization*
