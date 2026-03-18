# Feature Research

**Domain:** Browser-based multiplayer idle-incremental game (shared-world boss fight)
**Researched:** 2026-03-18
**Confidence:** HIGH (progression systems, idle mechanics) / MEDIUM (shared-world boss specifics — few direct analogues)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Persistent player account | Every idle game saves progress; losing a session is unforgivable | LOW | Username + password or OAuth; server-side save, not localStorage |
| Offline auto-attack / idle income | Defining genre contract — the game must run while the player is away | MEDIUM | Server-side tick or reconnect calculation; delta-time math. Cap offline time (e.g., 8h) to preserve login motivation |
| Visible HP bar on boss | The boss is the core gameplay object; players need a live health indicator | LOW | Real-time sync via WebSocket; must render drain smoothly, not just jump |
| Flat stat upgrades (ATK, CRIT, SPD) | Every incremental game has a buy-to-increase-number mechanic | LOW | Gold-cost curve must be exponential; needs big-number formatting (K/M/B/T) |
| Gold earned per participation | Players expect direct resource flow from dealing damage | LOW | Even minimal participation must yield gold; AFK players still earn |
| Floating damage numbers | Visual feedback that "my hit landed" — absence feels broken | MEDIUM | Color-code by type (normal, crit, kill blow); animate up+fade; pool instances for perf |
| Boss death / next boss spawn | Infinite progression is a genre expectation — no dead ends | LOW | Server-side authority; transition animation; new boss name + difficulty shown |
| Escalating boss difficulty | Numbers going up is the core satisfaction loop | LOW | HP/defense scales with boss index; keeps sense of progress |
| Active player list / damage feed | In a multiplayer game, seeing others is the social contract | MEDIUM | Live sidebar with top contributors + recent damage events; scroll-to-new or virtualized list |
| Leaderboard (killing blows) | Competition is the retention hook in shared-world games | LOW | Global all-time KB count, and per-boss kill credit |
| Basic number formatting | Large numbers are meaningless without K/M/B/T or scientific notation | LOW | Library like `idle-bignum` or custom formatter; critical before big numbers appear |
| Works in browser tab without install | Genre-defining platform contract — web-idle lives in a background tab | LOW | No WebGL hard dependency; performant when tabbed out (requestIdleCallback / reduced tick rate) |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but expected only in premium experiences.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Global single shared boss | Every player in the world fights the same HP bar at the same time — creates shared narrative ("we're on boss 47") | HIGH | Requires atomic HP decrement at scale; Redis or similar for hot counter; eventual consistency fine for display, not for death event |
| Killing Blow moment (KB event) | The climactic moment — whoever lands the final hit gets permanent recognition; creates tension as HP drops to 0 | HIGH | Race condition risk: must be server-authoritative with single-winner; broadcast to all active players with special animation/announcement |
| KB Currency (cosmetics only) | Fair play signal — prestige through recognition not power; avoids pay-to-win perception | LOW | Simple currency ledger; cosmetics are server-side metadata, not gameplay affecting |
| Cosmetic titles and visual effects | Identity expression without power differential; motivates killing blow attempts | MEDIUM | Title badge on player name; kill effect skins on damage numbers or boss hit animations |
| Kill count display | "I've landed 147 killing blows" is a status symbol that drives long-term retention | LOW | Running counter per player; visible on profile/sidebar |
| Active play bonus / active multiplier | Rewards logged-in players without penalizing offline players — creates a reason to keep the tab open | MEDIUM | Multiplier on DPS when tab is focused or player performed action in last N seconds |
| Real-time damage feed (all players) | Social proof — watching hundreds of numbers fly in makes the world feel alive | HIGH | Requires rate-limiting and client-side aggregation; raw event stream will saturate at scale |
| Boss lore / naming system | Each boss having a name and flavor creates narrative investment ("I was there when we killed Zor'thak") | LOW | Static lookup table of boss names/descriptions indexed by boss number; no gameplay impact |
| Equipment / gear system | Deeper progression hook beyond flat upgrades; gives players something to craft toward | HIGH | Tiered gear slots, crafting costs, visible stat boosts; this is the medium-term retention anchor |
| Per-boss top contributor board | Who did the most damage this fight? Creates intra-boss competition beyond the KB race | MEDIUM | Damage accumulator per boss instance per player; reset on new boss |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems in this specific game's context.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| PvP / player vs player | Players often ask for competition | Contradicts cooperative identity of the game; introduces balance arms race; the KB race is the right kind of competitive tension | KB race IS the PvP equivalent — competitive goal, cooperative means |
| Player-created rooms or lobbies | Players want to play with friends | Shatters "global shared narrative" — the entire identity of the game is "we're all on the same boss"; lobby sharding removes social proof of scale | Let players form guilds/friend lists that track each other's KB counts without splitting the boss |
| Prestige/full reset mechanic | Prestige is in every major idle game; players will ask for it | Currently out of scope (PROJECT.md); prestige works when you have deep solo progression to reset, but KB is inherently social and a reset would erase kill history | Defer to v2; if implemented, only reset gold/equipment, NEVER kill count or cosmetics |
| Pay-to-win upgrades / stat purchases | Monetization pressure | Destroys trust in shared-world fairness; one whale buying 10x DPS poisons the cooperative feel for everyone | Monetization only via cosmetics; KB Currency must be earned in-game only |
| Guild-exclusive bosses | Players want exclusive content | Contradicts single shared boss identity; "only guild members can see this boss" fragments community | Global boss; guilds can have internal leaderboards tracking combined guild KB count |
| Real-time everything (all events broadcast raw) | Maximally live-feeling game | At scale (1000+ players), a raw event stream per player per tick will saturate WebSockets and cause client jank | Aggregate damage events; send batched updates every 250-500ms; threshold for "notable" floats |
| Daily login streak / login calendar | Standard idle retention trick | Creates anxiety and punishes casual play; conflicts with the "come back whenever" idle contract | Offline earnings cap is the healthier return motivator — felt opportunity cost, not streak break punishment |
| Gacha / loot box gear acquisition | High monetization potential | Generates regulatory risk in multiple jurisdictions; trust-destroying if gear is power-relevant | Fixed-cost crafting with gold (deterministic); optional cosmetic gacha only if monetizing |

---

## Feature Dependencies

```
Persistent Account
    └──requires──> Boss HP Sync (account needed to record damage, earnings)
                       └──requires──> WebSocket Infrastructure
                                          └──requires──> Server-side Boss State

Killing Blow Currency
    └──requires──> KB Event (killing blow detection — server-authoritative)
                       └──requires──> Boss Death Detection (atomic, race-condition safe)

Cosmetics (titles, effects)
    └──requires──> KB Currency system
                       └──requires──> Player Account

Equipment System
    └──requires──> Gold Economy (flat upgrades come first to establish gold value)
                       └──requires──> Offline Earnings (gold must accumulate meaningfully)

Active Play Bonus
    └──enhances──> Gold Economy (multiplier on gold/DPS while active)

Leaderboard (all-time KB)
    └──requires──> Persistent Account
    └──requires──> KB Event

Per-Boss Top Contributor Board
    └──requires──> Damage tracking per boss instance
    └──enhances──> Active Player Sidebar

Real-time Damage Feed
    └──requires──> WebSocket Infrastructure
    └──conflicts──> Raw event broadcast at scale (must be rate-limited/batched)

Boss Lore / Naming
    └──enhances──> Boss Death moment (name in announcement)

Prestige (deferred)
    └──conflicts──> Kill count / KB history (must never reset cosmetic record)
```

### Dependency Notes

- **Boss HP Sync requires WebSocket Infrastructure:** HTTP polling cannot deliver the sub-second HP drain feel that is the core visual hook. WebSockets or SSE mandatory.
- **Killing Blow requires server-authoritative death detection:** Client-reported last hits will be cheated immediately. The server must hold canonical HP and emit a single winner on zero-cross.
- **Equipment requires Gold Economy:** Players must understand gold's value through flat upgrades before equipment gives them a second use for it. Equipment unlocks after early gold curve is established.
- **Active Play Bonus enhances Gold Economy:** The multiplier makes active sessions feel meaningfully better without making offline useless — this is the core idle/active balance.
- **Real-time Damage Feed conflicts with raw broadcast:** A game with 500 concurrent players each doing 10 hits/sec = 5,000 events/sec. Each client receiving all events is unsustainable. Batching is mandatory at scale.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the core concept: "watching a shared boss die in real-time with other people."

- [ ] Persistent player account (username/password) — identity required for leaderboards and earning
- [ ] Real-time shared boss HP bar with WebSocket sync — the entire product premise lives or dies here
- [ ] Floating damage numbers (own damage only for v1) — immediate feedback that you're participating
- [ ] Flat stat upgrades (ATK, CRIT, SPD) with gold cost — progression hook within first session
- [ ] Gold earned per damage dealt — reward loop for participation
- [ ] Offline auto-attack at reduced rate — genre contract; must be present at launch
- [ ] Boss death detection + next boss spawn — the loop must be infinite; one-boss demos don't validate the game
- [ ] Killing Blow detection + winner announcement — this is the named feature; it must exist at launch
- [ ] KB Currency grant on killing blow — even if only one cosmetic exists, the currency must be real
- [ ] Active player list (top N contributors) — social proof that multiplayer is live
- [ ] Global KB leaderboard — gives veteran players a reason to keep coming back
- [ ] Big number formatting (K/M/B/T) — without this, numbers become unreadable by boss 5–10

### Add After Validation (v1.x)

Features to add once core loop is proven engaging.

- [ ] Equipment system — add when flat upgrades feel like ceiling; medium-term retention anchor; trigger: D7 retention dropping
- [ ] Cosmetic titles (earned with KB Currency) — add when KB Currency exists but has no spend; low-effort high-reward
- [ ] Per-boss top contributor board — add to deepen intra-boss competition after KB race is working
- [ ] Active play bonus multiplier — add when data shows active sessions too short; increases session length
- [ ] Boss lore / naming — add for narrative investment; cheap dev effort, meaningful feel improvement
- [ ] Kill effect cosmetics (visual on damage numbers) — second KB Currency spend option; keeps cosmetic economy alive

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Prestige/reset mechanic — PROJECT.md explicitly defers; only viable if single-boss loop shows stagnation at high boss numbers
- [ ] Guild / friend-group leaderboards — social layer on top of individual KB competition; high complexity, high value
- [ ] Mobile responsive layout — web-first per PROJECT.md; mobile comes after browser experience is polished
- [ ] Limited-time seasonal bosses — event design adds retention but requires content pipeline infrastructure
- [ ] Achievement system — complements leaderboard but high implementation overhead; add when core metrics are strong

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Real-time shared boss HP sync | HIGH | HIGH | P1 |
| Killing Blow detection + announcement | HIGH | HIGH | P1 |
| Flat stat upgrades + gold economy | HIGH | LOW | P1 |
| Persistent player account | HIGH | MEDIUM | P1 |
| Offline auto-attack | HIGH | MEDIUM | P1 |
| Floating damage numbers | HIGH | MEDIUM | P1 |
| Boss death + next boss spawn | HIGH | MEDIUM | P1 |
| Active player list / damage feed | HIGH | MEDIUM | P1 |
| Global KB leaderboard | HIGH | LOW | P1 |
| Big number formatting | HIGH | LOW | P1 |
| KB Currency grant | MEDIUM | LOW | P1 |
| Cosmetic titles | MEDIUM | LOW | P2 |
| Equipment / gear system | HIGH | HIGH | P2 |
| Active play bonus multiplier | MEDIUM | MEDIUM | P2 |
| Per-boss top contributor board | MEDIUM | MEDIUM | P2 |
| Boss lore / naming | MEDIUM | LOW | P2 |
| Kill effect cosmetics | MEDIUM | MEDIUM | P2 |
| Guild / friend leaderboards | HIGH | HIGH | P3 |
| Seasonal / limited-time bosses | MEDIUM | HIGH | P3 |
| Achievement system | MEDIUM | MEDIUM | P3 |
| Prestige mechanic | MEDIUM | HIGH | P3 |
| Mobile layout | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | Cookie Clicker | Clicker Heroes | IdleMMO | Killing Blow (this game) |
|---------|----------------|----------------|---------|--------------------------|
| Progression model | Flat upgrades + buildings | Heroes + relics | Skills + gear | Flat upgrades + equipment |
| Prestige | Yes (Ascension) | Yes (Ascension) | No (ongoing) | Deferred |
| Multiplayer | No | No | Yes (async guild) | Yes (real-time shared boss) |
| Shared world object | No | No | World Bosses (async, cooldown) | Yes (single live boss, all players) |
| Killing blow mechanic | No | No | No | Core identity |
| Offline earnings | Yes | Yes | Yes | Yes |
| Leaderboard | No | No | Yes | Yes (KB count) |
| Cosmetics only economy | No | No | No | Yes |
| Equipment tiers | No | Yes (relics) | Yes | Yes (planned v1.x) |
| Boss HP visible to all | N/A | No (individual) | Shared but async | Yes, real-time |

**Key gap this game fills:** No existing browser idle game combines real-time shared HP, instant respawn, and a single-winner killing blow mechanic with cosmetic-only prestige. IdleMMO world bosses are the closest analogue but operate on cooldown (hours between spawns) and have no "killing blow" winner.

---

## Sources

- [Idle Clicker Games: Best Practices for Idle Game Design and Monetization](https://games.themindstudios.com/post/idle-clicker-game-design-and-monetization/) — MEDIUM confidence
- [Idle Games Best Practices: Design and Strategy - GridInc](https://gridinc.co.za/blog/idle-games-best-practices) — MEDIUM confidence
- [Crafting Compelling Idle Games - DesignTheGame](https://www.designthegame.com/learning/tutorial/crafting-compelling-idle-games) — MEDIUM confidence
- [World Bosses | IdleMMO Wiki](https://wiki.idle-mmo.com/combat/world-bosses) — HIGH confidence (primary source)
- [Multiplayer toxic last hit kill and how to heal it - Enki Software](https://www.enkisoftware.com/devlogpost-20171020-1-Multiplayers-toxic-last-hit-kill-and-how-to-heal-it) — MEDIUM confidence
- [Juicy damage feedback in games - Acagamic](https://acagamic.medium.com/juicy-damage-feedback-in-games-7c1758d69a42) — MEDIUM confidence
- [Names of Large Numbers for Idle Games - Game Developer](https://www.gamedeveloper.com/design/names-of-large-numbers-for-idle-games) — HIGH confidence
- [Dealing with huge numbers in idle games - InnoGames](https://blog.innogames.com/dealing-with-huge-numbers-in-idle-games/) — HIGH confidence
- [Clicker Cadences: Limited-Time Event Design in Idle Games - Kongregate Blog](https://blog.kongregate.com/clicker-cadences-limited-time-event-design-in-idle-games/) — MEDIUM confidence
- [Incremental game - Wikipedia](https://en.wikipedia.org/wiki/Incremental_game) — MEDIUM confidence (survey level)
- [IdleMMO Guilds v0.12.0 release notes](https://blog.galahadcreative.com/idlemmo-v0-12-0-guilds-raids-challenges-shrines-more/) — MEDIUM confidence

---
*Feature research for: Killing Blow — browser multiplayer idle-incremental game*
*Researched: 2026-03-18*
