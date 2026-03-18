# Architecture Research

**Domain:** Browser multiplayer idle-incremental game — single shared global boss
**Researched:** 2026-03-18
**Confidence:** HIGH (authoritative server patterns well-established; idle-specific details MEDIUM)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                               │
│                                                                     │
│  ┌──────────────┐  ┌─────────────────┐  ┌────────────────────┐     │
│  │  React UI    │  │  Local State    │  │  Optimistic Layer  │     │
│  │  (render)    │  │  (Zustand/Redux)│  │  (damage numbers)  │     │
│  └──────┬───────┘  └────────┬────────┘  └─────────┬──────────┘     │
│         │                  │                      │                │
│         └──────────────────┴──────────────────────┘                │
│                            │                                        │
│              WebSocket (send inputs / receive state)                │
└────────────────────────────┼────────────────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────────────┐
│                        SERVER LAYER                                 │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                   WebSocket Gateway                          │   │
│  │         (Socket.IO — connection management, routing)         │   │
│  └──────────────────────────┬───────────────────────────────────┘   │
│                             │                                       │
│  ┌──────────────────────────▼───────────────────────────────────┐   │
│  │                   Game Loop (Tick Engine)                     │   │
│  │    Fixed tick rate (10 Hz) — accumulates damage queue,       │   │
│  │    applies to boss HP, detects death, broadcasts delta       │   │
│  └────────────────┬─────────────────────────────────────────────┘   │
│                   │                                                 │
│  ┌────────────────▼──────────┐  ┌──────────────────────────────┐   │
│  │    Boss State Manager     │  │   Player Session Manager     │   │
│  │  (authoritative HP, tier, │  │  (active list, DPS tracking, │   │
│  │   kill detection, spawn)  │  │   offline timestamp store)   │   │
│  └────────────────┬──────────┘  └──────────────────────────────┘   │
│                   │                                                 │
│  ┌────────────────▼──────────────────────────────────────────────┐  │
│  │                    Persistence Layer                          │  │
│  │  Redis (hot: boss HP, active players, damage queue)           │  │
│  │  PostgreSQL (cold: accounts, upgrade state, kill log,         │  │
│  │             leaderboard, offline timestamps)                  │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| React UI | Render boss HP bar, floating damage numbers, player sidebar, cosmetics | React + Zustand for local display state |
| Optimistic Layer | Show player's own damage immediately without waiting for server tick | Client-side shadow state, reconcile on tick |
| WebSocket Gateway | Accept connections, authenticate sessions, route messages to game loop | Socket.IO on Node.js |
| Game Loop (Tick Engine) | Single authoritative loop: drain damage queue, apply to boss HP, detect death, broadcast delta | setInterval at ~100ms (10 Hz) |
| Boss State Manager | Own the boss HP number, spawn next boss on death, determine killing blow | In-process object backed by Redis |
| Player Session Manager | Track who is active, their DPS, when they last connected (for offline calc) | In-process + Redis hash |
| Redis | Hot state: current boss HP, damage queue, active player set | Redis DECRBY, sorted sets, pub/sub |
| PostgreSQL | Cold state: player accounts, upgrades, equipment, kill log, leaderboard | Standard relational DB |
| Auth Service | JWT issue/verify, session persistence across reconnects | Express middleware or NestJS guard |

---

## Recommended Project Structure

```
server/
├── game/
│   ├── GameLoop.ts          # Tick engine — setInterval, drain queue, apply damage
│   ├── BossManager.ts       # Boss HP, spawn next, killing blow detection
│   ├── PlayerManager.ts     # Session tracking, DPS accounting, offline timestamps
│   └── DamageQueue.ts       # Accumulate damage events between ticks
├── gateway/
│   ├── GameGateway.ts       # Socket.IO event handlers (attack, connect, disconnect)
│   └── AuthMiddleware.ts    # JWT validation on socket handshake
├── offline/
│   └── OfflineCalculator.ts # Reconnect catch-up: elapsed * dps * reduction factor
├── persistence/
│   ├── redis.ts             # Redis client and atomic helpers
│   └── db.ts                # PostgreSQL connection (Drizzle or Prisma)
├── auth/
│   └── AuthService.ts       # JWT sign/verify, account lookup
└── main.ts                  # Entry point

client/
├── components/
│   ├── BossView.tsx         # HP bar, animated boss sprite
│   ├── DamageNumbers.tsx    # Floating numbers (optimistic + server-confirmed)
│   ├── PlayerSidebar.tsx    # Live contributor list and DPS
│   ├── KillingBlowBanner.tsx# Full-screen announcement on boss death
│   └── UpgradePanel.tsx     # Gold spending, equipment UI
├── store/
│   ├── bossStore.ts         # Boss HP, current tier (received from server)
│   ├── playerStore.ts       # Local player state, gold, upgrades
│   └── sessionStore.ts      # Connection status, player identity
├── socket/
│   └── socketClient.ts      # Socket.IO client, event wiring
└── App.tsx
```

### Structure Rationale

- **game/:** All authoritative server logic lives here. Nothing in this layer should be callable by clients directly — only invoked by the tick loop or socket message handlers.
- **gateway/:** Thin layer that receives socket events and enqueues them; contains no game logic.
- **offline/:** Isolated so the reconnect calculation formula can be unit tested without standing up the full server.
- **store/:** Client state is split by concern. Boss state is server-owned and read-only on the client. Player state has a small optimistic layer for responsiveness.

---

## Architectural Patterns

### Pattern 1: Authoritative Server with Optimistic Client Display

**What:** The server is the sole source of truth for boss HP. The client predicts its own damage visually (shows floating numbers immediately) but never modifies the canonical boss HP number — only the server does.

**When to use:** Any time multiple clients act on shared mutable state (boss HP). Required here because all players are attacking the same value simultaneously.

**Trade-offs:** Adds 1 tick of latency to HP bar updates (~100ms). Players see their own damage numbers instantly but the HP bar lags by one tick. Acceptable for an idle game; would need lag compensation for a twitch FPS.

**Example:**
```typescript
// Client: show damage number immediately
function onPlayerAttack(damage: number) {
  showFloatingNumber(damage);           // optimistic — feels instant
  socket.emit('attack', { damage });    // server will validate and apply
}

// Server: apply at next tick, broadcast authoritative HP
function onTick() {
  const totalDamage = drainDamageQueue();
  bossHP = Math.max(0, bossHP - totalDamage);
  io.emit('boss:state', { hp: bossHP, maxHp: bossMaxHP });
  if (bossHP === 0) handleBossDeath();
}
```

### Pattern 2: Damage Queue — Accumulate Then Apply

**What:** Player attack messages arrive asynchronously over WebSocket. Rather than applying each to boss HP the moment it arrives (which requires locking), all damage events between ticks are collected in a queue. The tick loop drains the queue atomically once per tick.

**When to use:** Any time multiple concurrent writers target the same counter. This is the correct answer to the race condition problem for this game — it is simpler and more performant than database-level transactions or Redis WATCH/MULTI/EXEC on every hit.

**Trade-offs:** All damage within one tick window is treated as simultaneous. Killing blow is assigned to the player whose damage caused HP to cross zero within that tick — handled by iterating the queue in arrival order and tracking who caused the zero-crossing.

**Example:**
```typescript
// Damage queue (per-tick buffer)
const damageQueue: Array<{ playerId: string; damage: number }> = [];

// On WebSocket message — just enqueue, never write to boss HP directly
socket.on('attack', ({ damage }) => {
  if (validateDamage(damage, player)) {
    damageQueue.push({ playerId: socket.data.playerId, damage });
  }
});

// In tick loop — drain and apply in arrival order
function processTick() {
  const events = damageQueue.splice(0);  // drain atomically (single-threaded JS)
  let remaining = bossHP;
  let killingBlowPlayer: string | null = null;

  for (const event of events) {
    remaining -= event.damage;
    if (remaining <= 0 && killingBlowPlayer === null) {
      killingBlowPlayer = event.playerId;  // first to cross zero
    }
  }

  bossHP = Math.max(0, remaining);
  if (killingBlowPlayer) handleBossDeath(killingBlowPlayer);
}
```

**Key insight:** Node.js is single-threaded. The `splice(0)` is atomic within the event loop. No external locking is needed for the damage queue as long as the game loop runs in the same process. This is a significant architectural simplification versus a distributed system with Redis transactions.

### Pattern 3: Timestamp-Based Offline Progress

**What:** When a player disconnects, the server records a `last_seen` timestamp and their effective DPS at that time. On reconnect, the server calculates `elapsed = serverNow - lastSeen`, computes offline damage contribution as `offlineDPS * elapsed * reductionFactor` (typically 0.5x for offline penalty), awards gold, and presents a "welcome back" modal.

**When to use:** All idle/incremental games require this. Without it, players who close the tab lose all passive progress, breaking the core idle loop.

**Trade-offs:** Offline DPS contribution goes toward boss damage dealt globally but cannot give a specific "you did X% of boss damage while offline" because boss kills happen in real-time with other players. Award gold based on time offline × reduced DPS rate, not on boss participation. This is the cleanest mental model.

**Example:**
```typescript
async function handleReconnect(playerId: string) {
  const player = await db.getPlayer(playerId);
  const elapsed = Date.now() - player.lastSeen;  // server-authoritative time
  const cappedElapsed = Math.min(elapsed, MAX_OFFLINE_MS);  // cap at 24h
  const offlineGold = Math.floor(
    player.effectiveDPS * (cappedElapsed / 1000) * OFFLINE_REDUCTION
  );
  await db.awardGold(playerId, offlineGold);
  await db.updateLastSeen(playerId, Date.now());
  return { offlineGold, elapsed: cappedElapsed };
}
```

**Critical:** Use server clock only. Client clocks are manipulable. Store `last_seen` in PostgreSQL, not in the client.

### Pattern 4: Boss Death and Spawn Sequence

**What:** Boss death is an atomic server event. The server detects HP crossing zero, records the killing blow player, broadcasts a death event (triggers client animation/banner), persists the kill log, awards KB Currency, and then spawns the next boss. All of this happens in a brief "transition window" (~3 seconds) during which attacks are queued but not applied to the new boss.

**When to use:** Required pattern for any shared boss — prevents race conditions where attacks between death detection and new boss spawn corrupt state.

**Example state machine:**
```
ALIVE → (HP <= 0) → DYING (3s transition) → ALIVE (next tier)
                         │
                         ├── broadcast: boss:death { killingBlowPlayer, bossId }
                         ├── persist: kill log, award KB Currency
                         └── spawn: next boss with scaled HP
```

---

## Data Flow

### Player Attack Flow

```
Player clicks / auto-attack fires
         │
         ▼
Client: showFloatingNumber(damage)      ← optimistic display, instant
         │
         ▼  WebSocket: emit('attack', { damage })
         │
         ▼
Server: Gateway receives → validates damage (server-computed DPS, not client)
         │
         ▼
DamageQueue.push({ playerId, damage })
         │
         (waits for next tick — up to 100ms)
         │
         ▼
GameLoop tick fires
         │
         ├── drainQueue → accumulate total damage
         ├── apply to bossHP (Math.max(0, hp - damage))
         ├── check for boss death → killing blow detection
         └── io.emit('boss:state', { hp, maxHp })
                  │
                  ▼
All clients: receive authoritative HP → update HP bar
```

### Offline Reconnect Flow

```
Player reconnects (WebSocket handshake)
         │
         ▼
Auth: verify JWT → resolve playerId
         │
         ▼
OfflineCalculator.compute(playerId)
  → fetch last_seen from PostgreSQL
  → elapsed = serverNow - last_seen (capped at 24h)
  → offlineGold = dps * elapsed * 0.5
  → award gold to account
  → update last_seen = now
         │
         ▼
Server sends: { offlineGold, elapsed } → client shows "Welcome Back" modal
         │
         ▼
Server sends: full current game state (boss HP, tier, active players)
         │
         ▼
Client renders with live state
```

### Boss Death / Spawn Flow

```
Tick loop detects bossHP === 0
         │
         ├── Set bossState = DYING
         ├── Record killingBlowPlayerId
         ├── Persist kill log → PostgreSQL
         ├── Award KB Currency → killingBlow player
         ├── Update leaderboard → Redis sorted set
         │
         ▼  Broadcast: boss:death { killingBlowPlayerId, playerName, bossId }
         │
All clients: show killing blow banner, play animation (3s)
         │
         ▼  (after 3s transition)
Server: spawn next boss (tier + 1, scaled HP)
         ├── Set bossState = ALIVE, new bossId, new HP
         │
         ▼  Broadcast: boss:spawn { bossId, tier, maxHp }
         │
All clients: reset HP bar, resume attacks
```

### State Management (Client)

```
WebSocket incoming events
         │
         ├── 'boss:state'  → bossStore.setHP(hp)        [read-only from server]
         ├── 'boss:death'  → bossStore.setDying(true)    [triggers banner]
         ├── 'boss:spawn'  → bossStore.setNewBoss(...)   [resets HP bar]
         └── 'players:update' → playerStore.setActive()  [sidebar list]

Local player actions
         │
         ├── attack   → optimisticDamageNumbers[] (local only, cleared each tick)
         ├── upgrade  → emit('upgrade', {...}) → server validates → emit confirm
         └── equip    → emit('equip', {...})   → server validates → emit confirm
```

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k concurrent | Single Node.js process, in-process damage queue, PostgreSQL + Redis on same machine. No changes needed. |
| 1k-10k concurrent | Redis for boss HP and damage queue (still single logical queue via Lua script); horizontal WebSocket servers behind sticky-session load balancer. |
| 10k-100k concurrent | Boss HP in Redis with Lua atomic script. WebSocket servers stateless. Pub/Sub (Redis or Kafka) to fan out boss:state broadcasts. Separate read replicas for leaderboard queries. |
| 100k+ concurrent | Shard broadcasts geographically (CDN edge WebSockets). Boss state remains single Redis primary. Significant re-architecture; not needed for MVP or v1. |

### Scaling Priorities

1. **First bottleneck: boss HP write concurrency.** A single Node.js process handles this trivially via single-threaded damage queue. Becomes an issue only when multiple server processes write to the same boss. Solution: Redis Lua script for atomic compare-and-decrement, single "boss keeper" process, or serialized queue.

2. **Second bottleneck: broadcast fan-out.** Broadcasting `boss:state` to 10k+ sockets every 100ms is the real scalability wall. Solution: reduce patch rate to 5 Hz for spectating clients, use Socket.IO rooms, or move to a CDN-edge WebSocket layer for delivery.

---

## Anti-Patterns

### Anti-Pattern 1: Client-Authoritative Damage

**What people do:** Trust the damage value the client sends. Client says "I dealt 50,000 damage." Server applies it.

**Why it's wrong:** Trivially exploited. Anyone can modify the WebSocket message to claim 999,999,999 damage. Kills the boss on every hit, ruins killing blow competition, corrupts leaderboard.

**Do this instead:** Server computes the player's effective DPS from their server-stored stats (attack, crit, speed, equipment). Client sends only an "I attacked" message or a tick count. Server calculates the actual damage value.

### Anti-Pattern 2: Applying Damage Directly on WebSocket Message Receipt

**What people do:** `socket.on('attack', () => { bossHP -= damage; io.emit('boss:state', bossHP); })` — apply every hit immediately and broadcast immediately.

**Why it's wrong:** With 1000 concurrent players, this emits 1000+ `boss:state` broadcasts per second per tick, floods clients, creates thundering herd on HP value, and produces visible desync from out-of-order message delivery.

**Do this instead:** Damage queue + tick loop. Accumulate all attacks within a tick window, apply once, broadcast once. Reduces broadcast frequency by orders of magnitude regardless of player count.

### Anti-Pattern 3: Trusting Client Clock for Offline Progress

**What people do:** Client stores `startedAt = Date.now()` in localStorage. On return, computes `elapsed = Date.now() - startedAt`. Sends earned resources to server.

**Why it's wrong:** Players change system clock, earn weeks of gold in seconds. Even without cheating, if the server doesn't record the disconnect time, a server crash loses offline progress accountability.

**Do this instead:** Server records `last_seen` on disconnect (or via heartbeat). On reconnect, server computes elapsed using server clock. Client only receives and displays the result.

### Anti-Pattern 4: Single-Broadcast State vs. Delta Updates

**What people do:** Every tick, serialize the entire game state object and broadcast it to all clients.

**Why it's wrong:** Game state includes player lists, equipment details, kill history, etc. As state grows, each broadcast grows, wasting bandwidth and increasing parse time.

**Do this instead:** Send deltas. For boss HP, only send the new HP value. Use Colyseus Schema or a manual delta scheme. The full state is sent only once on join/reconnect.

### Anti-Pattern 5: Shared Boss in a Database Row Without Serialization

**What people do:** Store `boss.hp` in PostgreSQL. Every hit does `UPDATE boss SET hp = hp - $damage WHERE id = $id`. Rely on Postgres row locking.

**Why it's wrong:** Under high concurrency, row-level locks create significant contention. Postgres is not optimized for thousands of writes per second to the same row. Latency spikes under load, and reads block during writes.

**Do this instead:** Boss HP lives in Redis (DECRBY is atomic, single-threaded Redis processes it in microseconds). PostgreSQL persists boss metadata (max HP, tier, kill history) but never takes concurrent HP decrement hits.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Redis | Node.js `ioredis` client; DECRBY for HP; sorted set for leaderboard; hash for player sessions | Hot path — keep connection pooled |
| PostgreSQL | Drizzle ORM or Prisma; used for cold writes on disconnect, boss death events, account upgrades | Not on the attack hot path |
| WebSocket (Socket.IO) | Server-side rooms: one global room "boss" for state broadcasts, one per-player room for private messages | Use `io.to('boss').emit()` for boss updates |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Gateway ↔ Game Loop | In-process event queue (damageQueue array) | Gateway pushes; Game Loop drains. Single-process assumption for MVP. |
| Game Loop ↔ Boss Manager | Direct method calls | BossManager owns HP; GameLoop calls `applyDamage(events)` |
| Boss Manager ↔ Redis | Direct ioredis calls for HP persistence | Boss HP written to Redis after every tick for crash recovery |
| Boss Manager ↔ PostgreSQL | Async write on boss death only | Kill log, KB Currency award, leaderboard update |
| Player Manager ↔ PostgreSQL | Write on disconnect (last_seen); read on connect (offline calc) | Not in the hot path |
| Auth Service ↔ Gateway | JWT middleware on socket handshake | Reject unauthenticated connections before they reach game loop |

---

## Build Order (Phase Dependencies)

The following order reflects technical dependencies — each phase unlocks the next:

1. **Auth + Player Accounts** — JWT, register/login, basic PostgreSQL schema. Required before any game state is personalized.

2. **WebSocket Gateway + Game Loop skeleton** — Establish the tick loop, connection handling, and the GameLoop → Boss Manager architecture. No real game logic yet.

3. **Boss State + Damage Queue** — Boss HP, damage accumulation, boss death/spawn. This is the core loop. Can test with stub players before upgrades exist.

4. **Attack Validation + Player Stats** — Server-side DPS calculation from player stats. Prerequisite for kill authority (otherwise any damage value is accepted).

5. **Upgrade + Equipment System** — Gold economy, stat upgrades, equipment tiers. Depends on #4 (stats must exist to be upgraded).

6. **Offline Progress** — Reconnect calculator depends on player stats (#4) and persistent `last_seen` from #1.

7. **Killing Blow + KB Currency + Leaderboard** — Requires boss death (#3), player accounts (#1), and leaderboard persistence (Redis sorted set + PostgreSQL backup).

8. **Cosmetics** — KB Currency spender. Depends on #7 for currency source.

---

## Sources

- Heroic Labs / Nakama Authoritative Multiplayer Docs: https://heroiclabs.com/docs/nakama/concepts/multiplayer/authoritative/
- Gabriel Gambetta — Client-Server Game Architecture: https://www.gabrielgambetta.com/client-server-game-architecture.html
- Gabriel Gambetta — Client-Side Prediction and Server Reconciliation: https://www.gabrielgambetta.com/client-side-prediction-server-reconciliation.html
- Colyseus — State Synchronization: https://docs.colyseus.io/state
- Redis — Multiplayer Strategy Game Case Study: https://redis.io/blog/how-to-create-a-real-time-online-multi-player-strategy-game-using-redis/
- Edvins Antonovs — Offline Progress in Idle Games: https://edvins.io/rebuilding-the-welcome-back-mechanic-from-idle-games-in-react
- Offline Progression in Clicker Heroes: https://blog.clickerheroes.com/offline-progression-in-clicker-heroes/
- timetocode — Accurate Node.js Game Loop: https://timetocode.tumblr.com/post/71512510386/an-accurate-nodejs-game-loop-inbetween-setTimeout
- Ably — WebSocket Architecture Best Practices: https://ably.com/topic/websocket-architecture-best-practices
- Game Programming Patterns — Event Queue: https://gameprogrammingpatterns.com/event-queue.html

---
*Architecture research for: Browser multiplayer idle-incremental game (Killing Blow)*
*Researched: 2026-03-18*
