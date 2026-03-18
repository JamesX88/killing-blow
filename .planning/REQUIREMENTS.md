# Requirements: Killing Blow

**Defined:** 2026-03-18
**Core Value:** Every player is always in the same fight — the tension of watching a boss's HP drain in real-time, knowing anyone could land the killing blow, is what makes this different from every other idle game.

## v1 Requirements

### Authentication

- [x] **AUTH-01**: User can register with username and password
- [x] **AUTH-02**: User session persists across browser refresh and revisit
- [x] **AUTH-03**: User has a public profile showing username, kill count, and KB leaderboard rank
- [x] **AUTH-04**: User can sign in via OAuth (Google or Discord)

### Boss Loop

- [ ] **BOSS-01**: All players share a single real-time boss HP bar synced via WebSocket
- [ ] **BOSS-02**: Player sees floating damage numbers for their own hits on the boss
- [ ] **BOSS-03**: Boss plays a death animation then next boss spawns immediately when HP reaches 0
- [ ] **BOSS-04**: Boss HP scales dynamically with aggregate player DPS so fights last a reasonable duration

### Killing Blow

- [ ] **KB-01**: Server atomically determines the killing blow winner (no client-trusted damage values)
- [ ] **KB-02**: Prominent killing blow announcement is broadcast to all players when a winner is determined
- [ ] **KB-03**: Killing blow winner receives KB Currency; global leaderboard tracks total kills per player
- [ ] **KB-04**: Only players who dealt damage during the final ~1% of boss HP are eligible for the killing blow
- [ ] **KB-05**: Post-boss death screen shows top damage contributors for that fight

### Progression

- [ ] **PROG-01**: Player earns gold for every point of damage dealt to the boss
- [ ] **PROG-02**: Player can spend gold on flat stat upgrades (ATK, CRIT, SPD) with exponential cost scaling
- [ ] **PROG-03**: Player auto-attacks at reduced rate while offline; gold calculated server-side on reconnect using server clock only
- [ ] **PROG-04**: Player receives a DPS multiplier bonus while the browser tab is active

### Social & UI

- [ ] **UI-01**: Active player sidebar shows all players currently in the fight with their DPS or damage contribution
- [x] **UI-02**: All game numbers are formatted with K/M/B/T suffixes (big number library from day one)
- [ ] **UI-03**: Player can spend KB Currency on cosmetic titles displayed next to their name
- [ ] **UI-04**: Each boss displays a unique name and brief lore snippet during the fight

## v2 Requirements

### Equipment

- **EQUIP-01**: Player can acquire tiered equipment pieces (weapon, armor, accessory)
- **EQUIP-02**: Equipment is crafted or purchased with gold and provides stat bonuses
- **EQUIP-03**: Equipment tiers escalate in cost and power, providing a second progression axis after flat upgrades feel capped

### Prestige

- **PRES-01**: Player can optionally reset progression for a permanent global multiplier (prestige loop)
- **PRES-02**: Kill count and KB Currency cosmetics are never reset by prestige

### Extended Cosmetics

- **COS-01**: Kill effect skins: cosmetic visual changes to the player's attack animation
- **COS-02**: Additional title tiers unlocked at KB milestone counts (10, 50, 100 kills etc.)

## Out of Scope

| Feature | Reason |
|---------|--------|
| PvP / player-vs-player combat | Contradicts cooperative identity; KB race is the correct competitive tension |
| Player-created rooms or lobbies | Shatters the global shared narrative that defines the product |
| Pay-to-win stat purchases | Destroys fairness in the shared-world fight; monetization is cosmetics-only |
| Mobile app | Web-first; mobile responsive layout after browser experience is polished |
| Seasonal / limited-time bosses | Requires content pipeline infrastructure not justified until product-market fit |
| Guild / friend-group leaderboards | High complexity; add after individual KB competition is proven |

## Traceability

Which phases cover which requirements. Confirmed during roadmap creation 2026-03-18.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Complete |
| BOSS-01 | Phase 2 | Pending |
| BOSS-02 | Phase 2 | Pending |
| BOSS-03 | Phase 2 | Pending |
| BOSS-04 | Phase 3 | Pending |
| KB-01 | Phase 2 | Pending |
| KB-02 | Phase 4 | Pending |
| KB-03 | Phase 4 | Pending |
| KB-04 | Phase 2 | Pending |
| KB-05 | Phase 4 | Pending |
| PROG-01 | Phase 3 | Pending |
| PROG-02 | Phase 3 | Pending |
| PROG-03 | Phase 3 | Pending |
| PROG-04 | Phase 3 | Pending |
| UI-01 | Phase 2 | Pending |
| UI-02 | Phase 1 | Complete (01-01) |
| UI-03 | Phase 4 | Pending |
| UI-04 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0 (coverage 100%) ✓

---
*Requirements defined: 2026-03-18*
*Traceability confirmed by roadmapper: 2026-03-18*
