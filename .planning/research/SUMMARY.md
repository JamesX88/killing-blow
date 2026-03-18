# Project Research Summary

**Project:** Killing Blow
**Domain:** Browser-based multiplayer idle-incremental game (global shared boss fight)
**Researched:** 2026-03-18
**Confidence:** MEDIUM-HIGH

## Executive Summary

Killing Blow is a browser-based multiplayer idle-incremental game built around a single, globally shared boss that all players fight simultaneously in real time. The core product identity — a single shared HP bar that drains from collective damage, with one player claiming the climactic killing blow — has no direct analogue in the current market. Existing games (Cookie Clicker, Clicker Heroes, IdleMMO) either lack real-time multiplayer or use async/cooldown world bosses without a single-winner kill mechanic. The recommended build approach is a server-authoritative architecture with a 10 Hz game tick loop, Redis for hot boss state, PostgreSQL for persistent player data, and Socket.IO for real-time fan-out. The frontend is a Vite + React + TypeScript SPA with Zustand for state isolation between high-frequency (boss HP) and low-frequency (player stats, UI) updates.

The most important architectural decision is that the server must be the sole source of truth for both boss HP and damage calculations. The client sends attack intent only; the server computes damage from stored player stats, applies it atomically via a damage queue drained each tick, and broadcasts authoritative HP deltas. This design simultaneously prevents the three most severe exploits (client-trusted damage, boss HP race conditions, and client-clock manipulation for offline progress) and is the correct architecture for scaling beyond a single server instance. Starting with Redis for boss state is non-negotiable even in development — retrofitting it after a multi-instance deploy failure is expensive and disruptive.

The central risks are architectural (not feature-level): a boss HP race condition that double-awards kills, client-side damage exploitation, and background tab throttling breaking idle accumulation. All three must be addressed before any leaderboard or progression system is built, because they corrupt the data those systems depend on. A secondary concern is progression balance — the power gap between new and veteran players sharing the same boss HP bar can make new players feel useless, which is the primary churn risk for this game's genre. Boss HP must scale with aggregate player DPS, not be a fixed value.

---

## Key Findings

### Recommended Stack

The stack is a TypeScript-first monorepo with separate client and server packages sharing type definitions. The backend is Fastify 5 (HTTP + WebSocket on one port via `@fastify/websocket`) with Socket.IO 4.8 for real-time transport, Redis 8 for the boss state hot layer, and PostgreSQL 17 (Neon) via Prisma 7 for persistent player data. The frontend is Vite 8 + React 19 + Zustand 5, with Zustand's selective subscriptions preventing the entire component tree from re-rendering on every boss HP update tick. All versions have been verified against npm and official release sources.

**Core technologies:**
- **React 19.2.4 + Vite 8**: Frontend UI and build tooling — React's concurrent features smooth high-frequency WebSocket state updates; Vite 8 with Rolldown delivers near-instant HMR for game dev iteration cycles
- **TypeScript 5.x**: Shared types between client and server — non-negotiable when both sides must agree on boss state shape, player stat structures, and event payloads to prevent real-time desync
- **Fastify 5.8.2**: HTTP API + WebSocket gateway — 4-5x faster than Express, native TypeScript schema support, handles WebSocket via `@fastify/websocket` on one port
- **Socket.IO 4.8.3**: Real-time WebSocket transport — automatic reconnect, room broadcasting maps directly to the global single-room boss design; overhead acceptable at idle-game tick rates (1-10 Hz)
- **Redis 8 + `redis` npm 5.11.0**: Atomic boss HP via DECRBY, pub/sub fan-out for horizontal scaling, active player session cache — boss HP must live in Redis, not Postgres, for concurrent write safety
- **PostgreSQL 17 (Neon) + Prisma 7.5.0**: Persistent player progression — ACID transactions for gold/equipment; Prisma 7 removes the Rust dependency (simpler deploys) and generates TypeScript types from schema
- **Zustand 5.0.12**: Client state management — selective subscriptions ensure only the boss HP bar re-renders on each tick, not the whole tree; Redis is overkill for this scope
- **break_infinity.js / break_eternity.js**: Big number representation — must be adopted before any progression math is written; retrofitting after NaN/Infinity crashes in production is a significant rewrite

**Critical version constraint:** Fastify 5 and Vite 8 both require Node.js 20.19+. Pin to Node.js 22.x LTS.

### Expected Features

The minimum viable product is fully defined by the feature dependency graph: persistent accounts gate leaderboards and kill credit, WebSocket infrastructure gates boss HP sync, and boss HP sync gates the killing blow mechanic — which is the named identity feature of the game. The MVP is not valid without a server-authoritative killing blow determination.

**Must have (table stakes — launch blockers):**
- Persistent player account (username/password) — identity required for leaderboards and kill credit
- Real-time shared boss HP bar via WebSocket — the entire product premise; HTTP polling is not acceptable
- Flat stat upgrades (ATK, CRIT, SPD) with gold cost — buy-a-number mechanic is the genre contract
- Gold earned per damage dealt — every participation must yield reward; AFK players still earn
- Offline auto-attack at reduced rate — idle game core contract; must be server-calculated, not client-side
- Boss death detection + next boss spawn — infinite loop is required; one-boss demos do not validate the product
- Killing Blow detection + winner announcement (server-authoritative) — the named feature; must exist at launch
- KB Currency granted on killing blow — even with one cosmetic, the currency must be real at launch
- Floating damage numbers (own damage, optimistic display) — visual confirmation of participation
- Active player list with top contributors — social proof that the multiplayer layer is alive
- Global KB leaderboard — veteran retention hook
- Big number formatting (K/M/B/T) — becomes unreadable without this by boss 5-10

**Should have (competitive differentiators — add post-validation):**
- Cosmetic titles earned with KB Currency — add immediately after KB Currency exists with no spend
- Per-boss top contributor board — deepens intra-boss competition beyond the KB race
- Active play bonus multiplier — rewards tab-open sessions without penalizing idle players
- Boss lore / naming system — narrative investment ("I was there when we killed Zor'thak")
- Equipment / gear system — medium-term retention anchor; add when flat upgrade ceiling is felt (D7 drop signal)
- Kill effect cosmetics — second KB Currency spend to keep the cosmetic economy alive

**Defer (v2+):**
- Prestige/reset mechanic — explicitly deferred in PROJECT.md; only viable when the single-boss loop shows stagnation at high boss numbers; must never reset kill count or cosmetics
- Guild / friend-group leaderboards — high complexity, high value; add after individual KB competition is proven
- Mobile responsive layout — web-first; mobile after browser experience is polished
- Seasonal / limited-time bosses — requires content pipeline infrastructure not justified until PMF

**Anti-features (do not implement):**
- PvP / player vs player combat — contradicts cooperative identity; KB race is the correct competitive tension
- Player-created rooms or lobbies — shatters the "global shared narrative" that defines the product
- Pay-to-win stat purchases — destroys trust in shared-world fairness; monetization is cosmetics-only

### Architecture Approach

The architecture is a server-authoritative tick engine with an optimistic client display layer. The server runs a 10 Hz game loop that drains a per-tick damage queue, applies accumulated damage atomically to boss HP in Redis, detects boss death, and broadcasts authoritative HP deltas to all clients via Socket.IO room broadcast. The client shows the player's own floating damage numbers immediately (optimistic) but never modifies the canonical boss HP — only the server tick does. On reconnect, the server sends a full state snapshot before resuming delta events to guarantee no stale HP display.

**Major components:**
1. **WebSocket Gateway** — accepts connections, authenticates via JWT on HTTP upgrade handshake, routes `attack` events to the damage queue; contains no game logic
2. **Game Loop (Tick Engine)** — 10 Hz `setInterval`; drains damage queue, calls `BossManager.applyDamage()`, detects death, emits `boss:state` to all clients; single process, single-threaded (no locking needed for queue drain)
3. **Boss State Manager** — owns authoritative boss HP backed by Redis DECRBY; handles death state machine (ALIVE → DYING 3s → ALIVE next tier); awards KB Currency and persists kill log on death
4. **Player Session Manager** — tracks active players, per-player DPS cache in Redis hash, writes `last_seen` to PostgreSQL on disconnect
5. **Offline Calculator** — reconnect catch-up: `offlineGold = effectiveDPS * Math.min(elapsed, MAX_OFFLINE_MS) / 1000 * 0.5`; uses server clock only, never client-supplied timestamps
6. **React UI + Zustand stores** — `bossStore` (server-owned, read-only on client), `playerStore` (local with optimistic layer), `sessionStore` (connection identity)

**Build order from architecture research (each unlocks the next):**
Auth → WebSocket Gateway + Game Loop skeleton → Boss State + Damage Queue → Attack Validation + Server-Side DPS → Upgrade + Equipment → Offline Progress → Killing Blow + KB Currency + Leaderboard → Cosmetics

### Critical Pitfalls

1. **Boss HP race condition** — Use Redis `DECRBY` for atomic decrements; use a Lua script to combine decrement + kill-claim (`SETNX`) as one atomic operation. Never use GET + SET as separate operations. Address in Phase 1 (before any leaderboard is built). Recovery cost if shipped: HIGH.

2. **Client-trusted damage values** — Server must compute damage from stored player stats; client sends attack intent only (no damage value in the payload). Any message containing a damage value is a protocol violation. Address in Phase 1. Recovery cost if shipped: HIGH (requires full pipeline rewrite + leaderboard invalidation).

3. **Client clock for offline progress** — `last_seen` must only ever be written by the server to PostgreSQL. Client sends nothing about time. Cap elapsed at 24-48 hours. Address in Phase 2. Recovery cost if shipped: MEDIUM.

4. **Background tab setInterval throttling** — Chrome throttles `setInterval` to ~1-minute intervals for background tabs. Use a Web Worker for the attack tick loop (worker timers are not throttled). Server-side boss progression is unaffected; this pitfall breaks the client's idle contribution while tabbed out. Address in Phase 2. Recovery cost if shipped: LOW.

5. **JavaScript number overflow** — Native `number` overflows at 1.79e308 → `Infinity` → `NaN` contamination propagates silently through all game state. Adopt `break_infinity.js` or `break_eternity.js` before writing any progression math. Store serialized as strings in PostgreSQL. Address in Phase 1 (before any number math is written). Recovery cost if shipped: MEDIUM-HIGH.

6. **Veteran vs new player power gap** — Fixed boss HP leads to veterans killing the boss before new players contribute. Boss HP must scale with aggregate player DPS. Implement a "last hit window" (final 1% of HP) for killing blow eligibility to keep new players competitive. Address in Phase 3 (balance tuning). Recovery cost if shipped: MEDIUM (balance is tunable).

---

## Implications for Roadmap

Based on the dependency graph from FEATURES.md and the build order from ARCHITECTURE.md, a natural 5-phase structure emerges. The ordering is driven by hard technical dependencies, not feature desirability.

### Phase 1: Foundation — Auth, Infrastructure, and Number Safety

**Rationale:** Three architectural decisions must be locked in before any game logic is written: (1) big-number library adoption (retrofitting is expensive), (2) Redis as the boss state store (retrofitting after multi-instance deploy is catastrophic), and (3) server-authoritative damage pipeline (leaderboard data is permanently tainted if client-trusted damage ships). Auth must exist before any game state is personalized.

**Delivers:** Player registration/login, authenticated WebSocket sessions, running game loop skeleton, boss HP in Redis, `break_infinity.js` integrated, attack intent protocol (no client damage values), Docker Compose dev environment (Redis + Postgres).

**Addresses:** Persistent player account (table stakes), WebSocket Infrastructure, big number support.

**Avoids:** Client-trusted damage (Pitfall 2), boss HP in memory (Pitfall 4), JS number overflow (Pitfall 6), unauthenticated WebSocket connections.

**Research flag:** Standard patterns — JWT + Fastify session, Redis DECRBY, Socket.IO setup are all well-documented.

---

### Phase 2: Core Boss Loop — The Product's Reason to Exist

**Rationale:** The boss HP sync, damage queue, boss death detection, and killing blow mechanic are the entire product identity. Everything else is built on top of them. The killing blow must be server-authoritative with atomic kill-claim from day one. This phase validates whether the core experience (watching a shared HP bar drain in real time with other players and competing for the final hit) is fun.

**Delivers:** Real-time shared boss HP bar with smooth drain, damage queue + 10 Hz tick loop, boss death state machine (ALIVE → DYING 3s → ALIVE next tier), killing blow detection with Redis Lua script atomic kill-claim, winner broadcast, KB Currency grant, active player list sidebar, floating damage numbers (optimistic display).

**Addresses:** Real-time shared boss HP (P1), boss death + next boss spawn (P1), killing blow detection + announcement (P1), KB Currency grant (P1), active player list (P1), floating damage numbers (P1).

**Avoids:** Boss HP race condition (Pitfall 1) — Lua script is mandatory here, not optional. Reconnect without state catch-up (Pitfall 8) — full snapshot on reconnect must be built in this phase.

**Research flag:** Lua atomic kill-claim pattern is well-documented in Redis docs. Boss death state machine is a standard pattern. No additional research needed.

---

### Phase 3: Player Progression — Gold Economy and Upgrades

**Rationale:** Without a gold economy and stat upgrades, players have no reason to return. This phase establishes the core incremental loop and the server-side DPS calculation that attack validation depends on. Server-side DPS must exist before any damage validation is meaningful — the attack intent (Phase 1) protocol is correct but the validation against "is this rate plausible?" requires player stats.

**Delivers:** Flat stat upgrades (ATK, CRIT, SPD) with exponential gold costs, server-side DPS calculation from stored stats, gold earned per damage contribution, attack rate limiting (rate limiter uses server-computed attack speed), offline progress calculator with server-side `last_seen` (PostgreSQL), welcome-back modal on reconnect.

**Addresses:** Flat stat upgrades + gold economy (P1), gold earned per participation (P1), offline auto-attack (P1).

**Avoids:** Client clock for offline progress (Pitfall 3) — `last_seen` written server-side only. Background tab setInterval (Pitfall 5) — Web Worker for attack tick. Veteran vs new player gap (Pitfall 7) — boss HP scaling formula implemented here.

**Research flag:** Offline progress calculation is well-documented. Boss HP scaling formula (adaptive to aggregate DPS) is a niche topic — this phase likely needs `/gsd:research-phase` to find the right scaling function for this multiplayer context.

---

### Phase 4: Competition and Social Layer — Leaderboard and Polish

**Rationale:** With the core loop validated and gold economy working, the retention hooks (leaderboard, kill count display, per-boss contributors) can be layered on top of verified data. Leaderboard data is only trustworthy after Phase 1-3's server-authoritative pipeline is in place. This phase also polishes the killing blow moment with the Framer Motion announcement animation.

**Delivers:** Global KB leaderboard (Redis sorted set + PostgreSQL backup), per-player kill count display, KB leaderboard on profile/sidebar, killing blow announcement animation (Framer Motion), boss lore / naming system (static lookup), per-boss top contributor board, cosmetic titles (first KB Currency spend).

**Addresses:** Global KB leaderboard (P1), cosmetic titles (P2), per-boss top contributor board (P2), boss lore / naming (P2).

**Avoids:** Leaderboard entries written by client (security mistake from PITFALLS.md) — leaderboard written exclusively by server kill-claim logic.

**Research flag:** Standard patterns for Redis sorted-set leaderboards. Framer Motion AnimatePresence is well-documented. No additional research needed.

---

### Phase 5: Depth and Retention — Equipment System and Active Play Bonus

**Rationale:** Equipment is the medium-term retention anchor; it should only be introduced after the flat upgrade ceiling is felt (D7 retention signal). The active play bonus multiplier extends session length by rewarding tab-open play without penalizing offline play. These features depend on a proven gold economy (Phase 3) and validated progression curve.

**Delivers:** Equipment / gear system (tiered gear slots, crafting costs, stat boosts), active play bonus multiplier (DPS × multiplier when tab focused or recent action), kill effect cosmetics (second KB Currency spend), equipment catalog UI (React Query for HTTP fetch, Zustand for equipped state).

**Addresses:** Equipment / gear system (P2), active play bonus multiplier (P2), kill effect cosmetics (P2).

**Avoids:** Introducing equipment before gold value is established (FEATURES.md dependency note: "Equipment unlocks after early gold curve is established").

**Research flag:** Equipment system with tiered crafting is a moderately complex design space — this phase likely benefits from `/gsd:research-phase` for equipment tier math and crafting curve tuning specific to idle games.

---

### Phase Ordering Rationale

- **Phases 1-2 before everything else** because without server-authoritative damage and atomic kill-claim, all subsequent data (leaderboards, kill counts, progression) is compromised. These are not features — they are the correctness foundation.
- **Phase 3 after Phase 2** because server-side DPS calculation requires the game loop to exist (Phase 2), and offline progress requires the player account + `last_seen` from Phase 1. Attack validation (rate limiting) requires server-computed DPS from this phase.
- **Phase 4 after Phase 3** because leaderboard trustworthiness depends on the full server-authoritative pipeline being in place. Showing a leaderboard on corrupted data would require a reset.
- **Phase 5 after Phase 4** because equipment introduces a second gold sink; introducing it before the first gold sink (flat upgrades) is well-understood by players creates confusion and balance issues.
- The FEATURES.md dependency graph and the ARCHITECTURE.md build order both independently produce this same sequencing — high confidence in the ordering.

### Research Flags

Phases likely needing `/gsd:research-phase` during planning:
- **Phase 3:** Boss HP scaling formula adaptive to aggregate player DPS — niche topic with limited direct documentation for real-time multiplayer idle games; wrong formula causes the veteran/new player power gap (Pitfall 7)
- **Phase 5:** Equipment tier math and crafting curve — idle game equipment progression is moderately complex; wrong curves cause either trivial progression (equipment feels useless) or ceiling-breaking (equipment overshadows the KB race)

Phases with well-documented patterns (skip research-phase):
- **Phase 1:** Auth + Redis setup + Fastify + Socket.IO — all standard, well-documented
- **Phase 2:** Game loop, damage queue, Redis Lua kill-claim — all patterns are documented in the sources already gathered
- **Phase 4:** Redis sorted-set leaderboards, Framer Motion animations — standard patterns

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified against official npm/release sources. Compatibility matrix confirmed (Node 22 required for Fastify 5 + Vite 8). The `redis` npm vs `ioredis` recommendation is well-sourced. |
| Features | MEDIUM-HIGH | Table stakes and anti-features are well-grounded in genre analysis and competitor research. The killing blow mechanic has no exact analogue — confidence on exact feature feel is MEDIUM but the feature set itself is HIGH. |
| Architecture | HIGH | Server-authoritative tick engine, damage queue, Redis atomic ops, and timestamp-based offline progress are established multiplayer game patterns with multiple authoritative sources (Heroic Labs, Gambetta, Redis docs). |
| Pitfalls | HIGH | Security pitfalls (client-trusted damage, race conditions) are well-documented with real post-mortems. Browser setInterval throttling is a confirmed Chrome behavior. Number overflow is documented in shipped idle games. |

**Overall confidence:** HIGH for the core technical architecture; MEDIUM for balance tuning (boss HP scaling formula, equipment curves) which requires playtest data.

### Gaps to Address

- **Boss HP scaling formula:** No source directly addresses how to scale a shared boss HP bar for a real-time game with simultaneous players of wildly varying power. The closest analogue (IdleMMO world bosses) uses cooldown-based async design. This will need empirical tuning in Phase 3 — start with a formula based on average DPS of the current active player population and adjust from playtesting.
- **Killing blow "last hit window" specifics:** The research recommends a "final 1% HP window" for KB eligibility to protect new players, but the exact percentage requires tuning. Flag for balance playtesting in Phase 2/3.
- **Cosmetic economy depth:** KB Currency has one initial spend (cosmetic titles). The long-term cosmetic roadmap (kill effect skins, additional titles, future cosmetics) is not scoped. This is intentionally deferred but should be revisited when Phase 4 is planned.
- **Monorepo vs. separate repos:** STACK.md recommends pnpm workspaces with `packages/shared-types` for type sharing between client and server. This architectural choice should be made at project init (Phase 1) as it affects all subsequent development tooling.

---

## Sources

### Primary (HIGH confidence)
- Socket.IO npm registry — v4.8.3 confirmed current
- Fastify npm registry / fastify.dev — v5.8.2 confirmed current
- React release blog (react.dev) — v19.2.4 confirmed current
- Vite release blog (vite.dev) — v8.0.0 confirmed current (Rolldown)
- Prisma ORM blog — v7.5.0 confirmed current; Rust-free
- Redis `redis` npm package — v5.11.0 confirmed current; officially recommended
- Zustand npm registry — v5.0.12 confirmed current
- Gabriel Gambetta — Client-Server Game Architecture (gabrielgambetta.com)
- Redis — Multiplayer Strategy Game Case Study (redis.io/blog)
- Redis Transactions Documentation — WATCH/MULTI/EXEC and Lua atomicity
- Game Programming Patterns — Event Queue (gameprogrammingpatterns.com)
- Heroic Labs / Nakama — Authoritative Multiplayer Docs
- break_eternity.js GitHub (Patashu) — number representation for incremental games
- Inactive Tab Throttling in Browsers (javascript.plainenglish.io) — confirmed Chrome 88+ behavior
- Never Trust the Client — Game Developer (gamedeveloper.com)
- Top Security Risks in HTML5 Multiplayer Games (genieee.com)
- IdleMMO Wiki — World Bosses (primary source for closest analogue)
- Names of Large Numbers for Idle Games — Game Developer
- Dealing with Huge Numbers in Idle Games — InnoGames

### Secondary (MEDIUM confidence)
- Multiple 2025 framework comparison articles (DEV Community, Better Stack) — React vs Svelte, Fastify vs Express, Zustand vs Redux
- Ably: "Scaling Pub/Sub with WebSockets and Redis" — Redis pub/sub pattern for WebSocket fan-out
- Game database architecture guide (generalistprogrammer.com, 2025) — PostgreSQL vs MongoDB for game backends
- Idle Games Best Practices (gridinc.co.za, designthegame.com, themindstudios.com) — genre design patterns
- The Math of Idle Games Part III — Game Developer — progression curve pitfalls
- Balancing Tips: Idle Idol — Game Developer — real-world balance pitfalls from shipped game
- Offline Progression in Clicker Heroes — blog.clickerheroes.com
- Edvins Antonovs — Offline Progress in Idle Games (edvins.io)
- Neon vs Supabase comparison sources — free tier and PostgreSQL 17 support

---
*Research completed: 2026-03-18*
*Ready for roadmap: yes*
