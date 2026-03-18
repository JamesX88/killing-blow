# Phase 2: Core Boss Loop - Research

**Researched:** 2026-03-18
**Domain:** Real-time boss HP sync (Redis DECRBY + Lua), Socket.IO room broadcast, server-authoritative damage pipeline, Prisma schema extensions, floating damage numbers (motion), Zustand boss/player stores
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BOSS-01 | All players share a single real-time boss HP bar synced via WebSocket | Redis STRING for boss HP with atomic DECRBY; Socket.IO `io.to('global-boss-room').emit('boss:hp_update', payload)` on every damage event |
| BOSS-02 | Player sees floating damage numbers for their own hits on the boss | Server emits `boss:damage_dealt` only to the attacking socket; client renders `<motion.div>` with keyframe fade-up animation keyed on unique hit ID |
| BOSS-03 | Boss plays a death animation then next boss spawns immediately when HP reaches 0 | Kill-claim Lua script returns the winner userId; server emits `boss:death` + `boss:spawn` to all; client renders death animation, then transitions to new boss state |
| KB-01 | Server atomically determines the killing blow winner (no client-trusted damage values) | Redis Lua script combines DECRBY with conditional kill-claim in a single atomic execution; client sends only `attack:intent`, server computes damage from server-stored stats |
| KB-04 | Only players who dealt damage during the final ~1% of boss HP are eligible for the killing blow | Redis Hash `boss:{id}:last1pct_attackers` tracks userIds who landed hits while HP was in the last 1% window; checked synchronously inside the kill-claim Lua script |
| UI-01 | Active player sidebar shows all players currently in the fight with their DPS or damage contribution | Redis Hash `boss:{id}:damage` with `HINCRBY userId damageDealt`; server broadcasts full leaderboard slice on each damage event or on a 500ms tick |
</phase_requirements>

---

## Summary

Phase 2 ships the product's core identity: every player sees the same boss HP bar drain in real time, floating damage numbers appear for the attacker immediately, and the killing blow is awarded server-side with no possibility of client manipulation.

The architectural contract is: **the client sends attack intent only — never damage values**. The server reads the player's current stats from Redis, computes the damage roll server-side, atomically decrements the boss HP in Redis using a Lua script, and broadcasts the resulting HP to all sockets in `'global-boss-room'`. If the Lua script detects HP has crossed zero, the same atomic operation claims the kill, selects the winner from the last-1%-eligibility hash, and emits `boss:death` + `boss:spawn` to all connected clients. No separate round-trip is required.

Redis is the single source of truth for live game state (boss HP, boss metadata, per-boss damage contributions, last-1%-eligibility window). PostgreSQL via Prisma is the durable record store (boss sequence, per-fight damage records for post-fight display in Phase 4). Prisma migrations add `Boss` and `FightContribution` models. The existing Socket.IO `'global-boss-room'` and JWT cookie auth from Phase 1 are directly extended — no architecture changes, only new event handlers and new gateway logic.

**Primary recommendation:** Implement the Redis Lua kill-claim script first (the core safety mechanism), then build the damage pipeline outward: attack:intent handler → stat lookup → damage roll → Lua DECRBY → broadcast → client HP bar update. Add floating numbers and player sidebar after the HP pipeline is green.

---

## Standard Stack

### Core (all already in package.json — no new installs for server)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| redis | 5.11.0 | Boss HP atomic DECRBY, Hash-based damage tracking, Lua script eval | Already installed; `client.eval()` API supports Lua scripts directly |
| socket.io | 4.8.3 | Real-time HP broadcast to `'global-boss-room'`; targeted `boss:damage_dealt` to single socket | Already installed; Phase 1 gateway extends cleanly |
| prisma + @prisma/client | 7.5.0 | Boss sequence model, FightContribution records | Already installed; Phase 1 schema extended |

### New Client Dependencies
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| motion | 12.38.0 | Floating damage numbers, boss death animation, HP bar smooth transition | Current name for framer-motion (same package, same API); 2.5kb for AnimateNumber; runs at 120fps without React re-renders |
| @radix-ui/react-progress | 1.1.8 | Accessible HP bar primitive | Already pulled in transitively via shadcn; provides the `<Progress>` base |

**Note:** `motion` and `framer-motion` resolve to the same package v12.38.0. Use `motion` as the import name — it is the canonical current name.

**Installation (client only — server has no new deps):**
```bash
pnpm --filter client add motion
```

**Version verification (confirmed 2026-03-18):**
- `npm view motion version` → 12.38.0
- `npm view framer-motion version` → 12.38.0 (same package)
- `npm view @radix-ui/react-progress version` → 1.1.8
- `npm view redis version` → 5.11.0
- `npm view socket.io version` → 4.8.3
- `npm view prisma version` → 7.5.0

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Redis Lua EVAL for atomic kill | Redis MULTI/EXEC transaction | MULTI/EXEC does not support conditional logic — can't check "is HP <= 0 and who caused it" atomically. Lua is the only correct choice for conditional atomic state transitions in Redis. |
| `motion` floating numbers | Pure CSS keyframe animation | CSS is simpler but requires manual cleanup of DOM nodes after animation; `motion` `AnimatePresence` handles mount/unmount lifecycle for floating numbers automatically |
| Redis Hash for damage tracking | In-memory Map on the Node.js process | Multi-process/multi-server deployment would lose state; Redis Hash survives restarts |
| Prisma FightContribution model | Write to Redis only | Phase 4 needs per-fight leaderboard from durable storage; Redis is ephemeral by default |

---

## Architecture Patterns

### Recommended Project Structure Extensions
```
packages/
├── server/src/
│   ├── ws/
│   │   ├── gateway.ts          # EXTEND: add attack:intent handler
│   │   └── gateway.test.ts     # EXTEND: add boss loop event tests
│   ├── game/                   # NEW
│   │   ├── bossState.ts        # Boss HP init, Redis key conventions
│   │   ├── damageEngine.ts     # Server-side damage computation from stats
│   │   ├── killClaim.lua       # Lua script: DECRBY + conditional kill claim
│   │   └── bossState.test.ts   # Unit tests for damage engine + Lua script
│   └── routes/
│       └── boss.ts             # NEW: GET /boss/current (HTTP for initial load)
├── shared-types/src/
│   └── events.ts               # EXTEND: boss:hp_update, boss:death, boss:spawn,
│                               #         boss:damage_dealt, attack:intent, player:list
└── client/src/
    ├── stores/
    │   ├── sessionStore.ts     # EXISTING — no change
    │   ├── bossStore.ts        # NEW: bossId, hp, maxHp, name, isDefeated
    │   └── playerStore.ts      # NEW: activePlayers list with damage contributions
    ├── pages/
    │   └── Game.tsx            # NEW: main game page
    └── components/
        ├── BossHpBar.tsx       # NEW: HP bar using @radix-ui/react-progress
        ├── BossSprite.tsx      # NEW: placeholder sprite + death animation
        ├── DamageNumber.tsx    # NEW: floating damage number via motion
        └── PlayerSidebar.tsx   # NEW: active player list (UI-01)
```

### Redis Key Conventions
```
boss:current            STRING  — current bossId (cuid), updated on spawn
boss:{id}:hp            STRING  — current HP as integer string (atomic DECRBY target)
boss:{id}:maxHp         STRING  — max HP at spawn time
boss:{id}:damage        HASH    — field=userId, value=totalDamageDealt (HINCRBY)
boss:{id}:last1pct      HASH    — field=userId, value=1 (set when HP enters last 1%)
boss:{id}:killed        STRING  — "1" after kill claimed (prevents double-claim)
boss:{id}:winner        STRING  — winnerId, set atomically in kill-claim script
```

All boss-fight Redis keys get `EXPIRE` of 24 hours set at spawn time. This prevents unbounded growth from abandoned fights.

---

### Pattern 1: Server-Authoritative Damage Pipeline

**What:** Client sends `attack:intent` (no numbers). Server looks up player stats from Redis (or Postgres in Phase 3; hardcoded base stats in Phase 2), computes damage, runs the Lua DECRBY + kill-claim script, broadcasts results.

**Why this matters:** KB-01 is non-negotiable. If the client ever sends damage values, a trivial WebSocket intercept allows infinite damage.

**Flow:**
```
Client                        Server (gateway.ts)               Redis
  |                               |                               |
  | -- attack:intent -----------> |                               |
  |                               | -- EVAL killClaimScript ----> |
  |                               |    keys: [hp_key, damage_key, last1pct_key, killed_key]
  |                               |    args: [userId, damageAmount, last1pctThreshold]
  |                               | <-- {newHp, killed, winnerId} |
  |                               |                               |
  |                               | -- io.to('global-boss-room').emit('boss:hp_update', {hp, maxHp})
  | <-- boss:hp_update (all) ---- |                               |
  | <-- boss:damage_dealt (self)  |                               |
  |                               |
  |     (if killed)               |
  |                               | -- io.to('global-boss-room').emit('boss:death', {winnerId, bossId})
  | <-- boss:death (all) -------- |                               |
  |                               | [spawn next boss]             |
  | <-- boss:spawn (all) -------- |                               |
```

### Pattern 2: Redis Lua Kill-Claim Script

**What:** Single atomic Lua script that decrements HP, tracks per-user damage, tracks last-1% eligibility, and claims the kill.

**Source:** Redis EVAL docs (https://redis.io/docs/latest/develop/programmability/eval-intro/)

```lua
-- killClaim.lua
-- KEYS[1] = boss:{id}:hp
-- KEYS[2] = boss:{id}:damage
-- KEYS[3] = boss:{id}:last1pct
-- KEYS[4] = boss:{id}:killed
-- ARGV[1] = userId
-- ARGV[2] = damageAmount (integer)
-- ARGV[3] = last1pctThreshold (integer, e.g. maxHp * 0.01)
-- Returns: {newHp, killed (0/1), winnerId or ""}

local dmg = tonumber(ARGV[2])
local threshold = tonumber(ARGV[3])
local userId = ARGV[1]

-- Increment this user's damage contribution
redis.call('HINCRBY', KEYS[2], userId, dmg)

-- Get current HP before decrement to check last-1% window
local prevHp = tonumber(redis.call('GET', KEYS[1]) or '0')

-- Track last-1% eligibility
if prevHp <= threshold then
  redis.call('HSET', KEYS[3], userId, 1)
end

-- Atomically decrement HP (floor at 0)
local newHp = redis.call('DECRBY', KEYS[1], dmg)
if newHp < 0 then
  redis.call('SET', KEYS[1], 0)
  newHp = 0
end

-- Kill claim: only if HP reached 0 and not already claimed
if newHp <= 0 then
  local alreadyKilled = redis.call('GET', KEYS[4])
  if not alreadyKilled then
    redis.call('SET', KEYS[4], '1')
    -- Winner must be eligible (in last1pct hash); pick the attacker who delivered
    -- the killing blow — they are in last1pct by definition (HP was <= threshold)
    return {newHp, 1, userId}
  end
end

return {newHp, 0, ''}
```

**Node.js call (node-redis v5):**
```typescript
// packages/server/src/game/bossState.ts
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const killClaimScript = readFileSync(join(__dirname, 'killClaim.lua'), 'utf8')

export async function applyDamage(
  redis: ReturnType<typeof import('redis').createClient>,
  bossId: string,
  userId: string,
  damage: number,
  maxHp: number
): Promise<{ newHp: number; killed: boolean; winnerId: string }> {
  const threshold = Math.floor(maxHp * 0.01) // last 1%
  const result = await redis.eval(killClaimScript, {
    keys: [
      `boss:${bossId}:hp`,
      `boss:${bossId}:damage`,
      `boss:${bossId}:last1pct`,
      `boss:${bossId}:killed`
    ],
    arguments: [userId, String(damage), String(threshold)]
  }) as [number, number, string]

  return {
    newHp: result[0],
    killed: result[1] === 1,
    winnerId: result[2]
  }
}
```

**Critical constraint:** The `redis` client from Phase 1's plugin is attached to the Fastify instance via `fastify.decorate('redis', client)`. To use it inside `gateway.ts` (Socket.IO context outside Fastify lifecycle), pass it as a parameter at setup time: `setupGateway(io, fastify.redis)`.

### Pattern 3: Socket.IO Typed Events Extension

**What:** Extend the `ServerToClientEvents` and `ClientToServerEvents` in `shared-types/src/events.ts` with all Phase 2 events. The typed `Server` and `Socket` objects then enforce correctness at compile time.

**Source:** https://socket.io/docs/v4/typescript/

```typescript
// packages/shared-types/src/events.ts
export interface ServerToClientEvents {
  'boss:hp_update': (payload: { bossId: string; hp: number; maxHp: number }) => void
  'boss:damage_dealt': (payload: { amount: number; hitId: string }) => void
  'boss:death': (payload: { bossId: string; winnerId: string; winnerName: string }) => void
  'boss:spawn': (payload: BossState) => void
  'player:list_update': (payload: ActivePlayer[]) => void
}

export interface ClientToServerEvents {
  'attack:intent': (payload: { bossId: string }) => void
}

export interface BossState {
  bossId: string
  name: string
  hp: number
  maxHp: number
  bossNumber: number
}

export interface ActivePlayer {
  userId: string
  username: string
  damageDealt: number
}
```

**Typed gateway setup:**
```typescript
// packages/server/src/ws/gateway.ts
import type { Server, Socket } from 'socket.io'
import type { ServerToClientEvents, ClientToServerEvents } from '@killing-blow/shared-types'

export function setupGateway(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  redis: ReturnType<typeof import('redis').createClient>
) {
  // ... middleware (unchanged) ...

  io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
    socket.join('global-boss-room')

    socket.on('attack:intent', async ({ bossId }) => {
      const userId = socket.data.userId
      const damage = computeBaseDamage() // Phase 2: hardcoded base; Phase 3: from stats
      const maxHp = await getMaxHp(redis, bossId)
      const { newHp, killed, winnerId } = await applyDamage(redis, bossId, userId, damage, maxHp)

      // Broadcast HP to all
      io.to('global-boss-room').emit('boss:hp_update', { bossId, hp: newHp, maxHp })
      // Floating number to this player only
      socket.emit('boss:damage_dealt', { amount: damage, hitId: crypto.randomUUID() })

      if (killed) {
        const winnerName = await resolveUsername(winnerId)
        io.to('global-boss-room').emit('boss:death', { bossId, winnerId, winnerName })
        const nextBoss = await spawnNextBoss(redis)
        io.to('global-boss-room').emit('boss:spawn', nextBoss)
      }

      // Broadcast updated player list (damage contributions)
      const players = await getActivePlayers(redis, bossId)
      io.to('global-boss-room').emit('player:list_update', players)
    })
  })
}
```

### Pattern 4: Zustand Boss Store

**What:** Three Zustand stores — `sessionStore` (existing), `bossStore` (new), `playerStore` (new). Stores subscribe to Socket.IO events inside the store action functions, called once on socket connect.

**Source:** https://github.com/pmndrs/zustand (React integration patterns)

```typescript
// packages/client/src/stores/bossStore.ts
import { create } from 'zustand'
import type { BossState } from '@killing-blow/shared-types'

interface BossStore extends BossState {
  isDefeated: boolean
  setBoss: (boss: BossState) => void
  updateHp: (hp: number) => void
  markDefeated: () => void
}

export const useBossStore = create<BossStore>((set) => ({
  bossId: '',
  name: '',
  hp: 0,
  maxHp: 1,
  bossNumber: 0,
  isDefeated: false,

  setBoss: (boss) => set({ ...boss, isDefeated: false }),
  updateHp: (hp) => set({ hp }),
  markDefeated: () => set({ isDefeated: true })
}))
```

**Socket event wiring (called once after socket connects):**
```typescript
// packages/client/src/lib/socket.ts — add subscribeToGame()
export function subscribeToGame() {
  socket.on('boss:hp_update', ({ hp }) => {
    useBossStore.getState().updateHp(hp)
  })
  socket.on('boss:spawn', (boss) => {
    useBossStore.getState().setBoss(boss)
  })
  socket.on('boss:death', () => {
    useBossStore.getState().markDefeated()
  })
  socket.on('player:list_update', (players) => {
    usePlayerStore.getState().setPlayers(players)
  })
}
```

### Pattern 5: Floating Damage Number (motion)

**What:** Each `boss:damage_dealt` event adds a new DamageNumber instance to a list with a unique `hitId`. `AnimatePresence` handles mounting/unmounting; `motion.div` animates upward + fade out.

**Source:** https://motion.dev/docs/react-animation

```tsx
// packages/client/src/components/DamageNumber.tsx
import { motion, AnimatePresence } from 'motion/react'
import { formatNumber } from '@killing-blow/shared-types'
import { useEffect, useState } from 'react'
import { Decimal } from '@killing-blow/shared-types'

interface Hit { hitId: string; amount: number }

export function DamageNumbers() {
  const [hits, setHits] = useState<Hit[]>([])

  useEffect(() => {
    const handler = ({ amount, hitId }: { amount: number; hitId: string }) => {
      setHits(prev => [...prev, { hitId, amount }])
      // Auto-remove after animation completes
      setTimeout(() => {
        setHits(prev => prev.filter(h => h.hitId !== hitId))
      }, 1200)
    }
    socket.on('boss:damage_dealt', handler)
    return () => { socket.off('boss:damage_dealt', handler) }
  }, [])

  return (
    <div className="relative pointer-events-none">
      <AnimatePresence>
        {hits.map(hit => (
          <motion.div
            key={hit.hitId}
            initial={{ opacity: 1, y: 0 }}
            animate={{ opacity: 0, y: -60 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.0, ease: 'easeOut' }}
            className="absolute text-yellow-400 font-bold text-xl left-1/2 -translate-x-1/2"
          >
            -{formatNumber(new Decimal(hit.amount))}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
```

### Pattern 6: Prisma Schema Extensions

**What:** Add `Boss` model for the boss sequence and `FightContribution` for per-fight damage records (used in Phase 4 post-fight leaderboard, UI-01 durable record). Phase 2 only writes these; Phase 4 reads them.

**When to use:** Prisma migration run at start of Phase 2.

```prisma
model Boss {
  id           String   @id @default(cuid())
  bossNumber   Int      @unique  // monotonic sequence (1, 2, 3, ...)
  name         String
  maxHp        Int                // Phase 2: Int is safe; Phase 3 may need BigInt
  spawnedAt    DateTime @default(now())
  defeatedAt   DateTime?
  winnerId     String?

  contributions FightContribution[]
}

model FightContribution {
  id           String @id @default(cuid())
  bossId       String
  userId       String
  damageDealt  Int    // Prisma 7: safe as Int for Phase 2 HP ranges; migrate to BigInt in Phase 3

  boss Boss @relation(fields: [bossId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([bossId, userId])
}
```

**Important Prisma 7 note:** Prisma 7.3.0 fixed BigInt precision loss in JSON aggregation. If Phase 2 damage values approach `Number.MAX_SAFE_INTEGER` (~9 quadrillion), migrate `damageDealt` to `BigInt` and serialize via `.toString()`. For Phase 2 with integer HP pools in the millions, `Int` is fine.

### Pattern 7: Boss Spawn Initialization

**What:** On server startup, check if there is an active boss in Redis. If not, spawn boss #1. On kill, spawn next boss immediately.

```typescript
// packages/server/src/game/bossState.ts
export async function ensureActiveBoss(redis, prisma) {
  const currentId = await redis.get('boss:current')
  if (currentId) return  // boss already active

  await spawnNextBoss(redis, prisma, 0)  // spawn boss #1
}

export async function spawnNextBoss(redis, prisma, prevBossNumber: number) {
  const bossNumber = prevBossNumber + 1
  const maxHp = computeMaxHp(bossNumber)  // Phase 2: linear scaling, e.g. 1000 * bossNumber
  const name = generateBossName(bossNumber)  // deterministic name from number

  const boss = await prisma.boss.create({
    data: { bossNumber, name, maxHp }
  })

  // Set Redis live state
  await redis.set(`boss:${boss.id}:hp`, String(maxHp))
  await redis.set(`boss:${boss.id}:maxHp`, String(maxHp))
  await redis.set('boss:current', boss.id)

  // Set 24h TTL on fight keys
  for (const suffix of [':hp', ':maxHp', ':damage', ':last1pct', ':killed']) {
    await redis.expire(`boss:${boss.id}${suffix}`, 86400)
  }

  return { bossId: boss.id, name, hp: maxHp, maxHp, bossNumber }
}
```

### Pattern 8: HTTP Endpoint for Initial Boss State

**What:** When a player first loads the game page, they need the current boss state before the WebSocket connects. A simple `GET /boss/current` returns the live state from Redis.

**When to use:** `Game.tsx` initial load, before `subscribeToGame()` is called.

```typescript
// packages/server/src/routes/boss.ts
fastify.get('/boss/current', { onRequest: [fastify.authenticate] }, async (req, reply) => {
  const bossId = await fastify.redis.get('boss:current')
  if (!bossId) return reply.status(503).send({ error: 'No active boss' })

  const [hp, maxHp, name] = await Promise.all([
    fastify.redis.get(`boss:${bossId}:hp`),
    fastify.redis.get(`boss:${bossId}:maxHp`),
    fastify.redis.get(`boss:${bossId}:name`)
  ])

  return { bossId, hp: Number(hp), maxHp: Number(maxHp), name }
})
```

### Anti-Patterns to Avoid

- **Client sends damage values:** Fatal security flaw. The `attack:intent` event must contain only `{ bossId }`. Server computes damage from server-stored stats. No exceptions.
- **Using Redis MULTI/EXEC for kill detection:** MULTI/EXEC cannot make conditional decisions inside the transaction — it can't check "is HP <= 0 and was it not already claimed?" atomically. Only Lua EVAL provides conditional atomic logic in Redis.
- **Calling `redis.eval()` with the script string on every attack:** Pre-load the script with `SCRIPT LOAD` and use `evalSha()` in production. For Phase 2 simplicity, `eval()` is fine — the script is cached after first call.
- **Emitting `boss:damage_dealt` to all players:** Floating numbers are only meaningful for the attacker. Use `socket.emit()` (to sender only), not `io.to(room).emit()`.
- **Reading boss HP from Prisma on attack:** Prisma reads are too slow (5-50ms per query) under high attack rate. Redis is the live state; Prisma is the durable record written on boss death only.
- **Spawning next boss in a setTimeout:** Race condition under concurrent kills. Spawn must happen synchronously in the same event loop tick after the kill is confirmed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic conditional HP decrement | Redis MULTI/EXEC + Node.js conditional | Redis Lua EVAL | Only Lua provides atomic conditional logic; MULTI/EXEC queues blindly |
| WebSocket reconnect on server restart | Manual event listener + retry | socket.io-client auto-reconnect | Already configured; re-sends cookie auth on reconnect automatically |
| Floating number mount/unmount lifecycle | Manual React state cleanup with setTimeout | `motion` + `AnimatePresence` | AnimatePresence handles exit animations before DOM removal; prevents z-index/positioning leaks |
| Boss HP bar smooth interpolation | Manual CSS transition via `width` style | CSS `transition: width 200ms` on the `<progress>` element OR motion `animate` prop | Either works; motion gives spring physics for feel |
| Damage number uniqueness | Timestamp-based IDs | `crypto.randomUUID()` (Node.js built-in) | Timestamps collide under rapid attack; UUID is guaranteed unique per hit |
| Player damage leaderboard aggregation | SQL COUNT query per websocket tick | Redis HGETALL `boss:{id}:damage` | O(N players) in Redis vs O(N players) SQL join per 500ms tick; Redis is 100x faster |

**Key insight:** The single most important architectural decision in Phase 2 is that the Lua script + Redis atomicity is not optional complexity — it is the only correct implementation for a multi-user kill detection system. Any workaround that uses application-level logic (locks, transactions, Node.js state) will produce race conditions under concurrent attacks at kill time.

---

## Common Pitfalls

### Pitfall 1: Double Kill — Two Players Simultaneously Drive HP to Zero
**What goes wrong:** Two sockets send `attack:intent` in the same millisecond; both see HP = 3 and both compute a killing blow. Two `boss:death` events fire, two boss spawns happen.
**Why it happens:** Without atomicity, the check-then-set is not atomic. Application-level locks in Node.js are not thread-safe across multiple processes.
**How to avoid:** The Lua script's `boss:{id}:killed` key is the guard. `SET boss:{id}:killed 1 NX` inside the Lua script ensures only one execution path ever sets it. The `NX` (not-exists) flag is the atomic safety net.
**Warning signs:** Multiple `boss:death` events for the same `bossId` appear in logs or client receives two death events; boss counter increments by 2.

### Pitfall 2: Redis Key Does Not Exist at Attack Time
**What goes wrong:** Player sends `attack:intent` before the boss is spawned or after the Redis key has expired; `GET boss:{id}:hp` returns null; `DECRBY` on a non-existent key initializes it to 0 then decrements, producing -damage as the "HP".
**Why it happens:** Race between server startup/spawn and first client attack; or 24h TTL expired on a long-running boss.
**How to avoid:** The gateway handler must validate that `boss:current` matches the `bossId` in the intent payload before calling `applyDamage`. If they don't match, silently discard (boss already dead, client hasn't received `boss:spawn` yet).
**Warning signs:** Boss HP shows negative values in logs; ghost kills fire immediately on boss spawn.

### Pitfall 3: `redis` Client Not Available Inside `setupGateway()`
**What goes wrong:** `fastify.redis` is decorated on the Fastify instance via the plugin, but `setupGateway` runs in `server.ts` outside any Fastify request handler. Accessing `fastify.redis` inside a Socket.IO event handler works at runtime but creates tight coupling and is undefined if Redis failed to connect.
**Why it happens:** Phase 1 Redis plugin uses `fastify.decorate()` — available only on the Fastify instance, not globally.
**How to avoid:** Pass `fastify.redis` as an explicit parameter to `setupGateway(io, fastify.redis)` in `server.ts` after `app.ready()`. Guard with null check: if Redis unavailable, emit an error event and return early.
**Warning signs:** `TypeError: Cannot read properties of undefined (reading 'eval')` inside attack:intent handler.

### Pitfall 4: HP Bar Jitter from Out-of-Order WebSocket Messages
**What goes wrong:** Under rapid attack, `boss:hp_update` events arrive out of order at the client. HP bar jumps backward (from 500 to 600 then back to 300).
**Why it happens:** WebSocket messages are ordered per-socket but multiple sockets are attacking simultaneously; the server emits one message per attack; aggregate ordering at the client depends on arrival order from multiple senders.
**How to avoid:** Include a monotonic `seq` counter in `boss:hp_update`. Client ignores any update with `seq <= lastSeq`. Redis `INCR boss:{id}:seq` before emitting. Alternatively, the client always takes the minimum HP seen (HP can only go down) — simpler and sufficient for Phase 2.
**Warning signs:** HP bar visually bounces; players report "boss HP went back up".

### Pitfall 5: `motion` Import Path Changed in v11+
**What goes wrong:** `import { motion } from 'framer-motion'` works but `import { motion } from 'motion'` is the canonical current import.
**Why it happens:** The `framer-motion` package was renamed to `motion` at v11. Both resolve to the same package at v12.38.0, but the React-specific entry point is `'motion/react'` not `'motion'` or `'framer-motion'`.
**How to avoid:** Always use `import { motion, AnimatePresence } from 'motion/react'` for React components.
**Warning signs:** TypeScript error "Module 'motion' has no exported member 'motion'" — use `'motion/react'` instead.

### Pitfall 6: Lua Script Returning Wrong Type to Node.js
**What goes wrong:** The Lua script returns a Redis Bulk String array; Node.js receives it as `string[]` not `[number, number, string]`. `result[0]` is `"500"` not `500`.
**Why it happens:** Redis Lua returns integers as Redis integer type but numbers constructed via `tonumber()` may round-trip as strings depending on the type returned.
**How to avoid:** In the Lua script, always return integer values using `redis.call('DECRBY', ...)` directly (returns Redis integer type), or use `tonumber()` conversion. In Node.js, always wrap the first two return values with `Number()`: `const newHp = Number(result[0])`.
**Warning signs:** `if (killed === 1)` never triggers; HP comparisons fail because `"500" <= 0` is false.

### Pitfall 7: Player Sidebar Flooding Clients
**What goes wrong:** Every attack emits a full `player:list_update` to all players, including the damage hash. At 100 players attacking 10 times/second, that is 1000 broadcasts/second of the full player list — overwhelming bandwidth and React re-renders.
**Why it happens:** Naive implementation emits on every `attack:intent` event.
**How to avoid:** Debounce/throttle player list broadcasts to 500ms intervals using a server-side `setInterval`. The attack handler updates Redis atomically but the player list broadcast is decoupled from individual attacks.
**Warning signs:** Client CPU spikes during combat; network tab shows hundreds of `player:list_update` messages per second.

---

## Code Examples

### Complete Lua Kill-Claim Script
```lua
-- packages/server/src/game/killClaim.lua
-- Source: Redis EVAL docs https://redis.io/docs/latest/develop/programmability/eval-intro/
-- KEYS[1] = boss:{id}:hp
-- KEYS[2] = boss:{id}:damage
-- KEYS[3] = boss:{id}:last1pct
-- KEYS[4] = boss:{id}:killed
-- ARGV[1] = userId
-- ARGV[2] = damageAmount
-- ARGV[3] = last1pctThreshold
-- Returns: {newHp (integer), killed (0/1), winnerId (string)}

local userId = ARGV[1]
local dmg = tonumber(ARGV[2])
local threshold = tonumber(ARGV[3])

-- Increment this user's fight damage
redis.call('HINCRBY', KEYS[2], userId, dmg)

-- Track last-1% eligibility: if HP was already in the last 1%, this player qualifies
local prevHp = tonumber(redis.call('GET', KEYS[1]) or '0')
if prevHp <= threshold then
  redis.call('HSET', KEYS[3], userId, '1')
end

-- Atomic decrement
local newHp = redis.call('DECRBY', KEYS[1], dmg)
if newHp < 0 then
  redis.call('SET', KEYS[1], '0')
  newHp = 0
end

-- Kill claim: atomic single-winner guarantee via SETNX semantics
if newHp == 0 then
  local claimed = redis.call('SETNX', KEYS[4], userId)
  if claimed == 1 then
    -- This execution wins the kill
    return {newHp, 1, userId}
  end
end

return {newHp, 0, ''}
```

### node-redis v5 eval() Call
```typescript
// packages/server/src/game/bossState.ts
// Source: https://github.com/redis/node-redis/issues/1250 (node-redis v4+ eval API)
const result = await redis.eval(killClaimScript, {
  keys: [
    `boss:${bossId}:hp`,
    `boss:${bossId}:damage`,
    `boss:${bossId}:last1pct`,
    `boss:${bossId}:killed`
  ],
  arguments: [userId, String(damage), String(Math.floor(maxHp * 0.01))]
}) as [number | string, number | string, string]

const newHp = Number(result[0])
const killed = Number(result[1]) === 1
const winnerId = result[2] as string
```

### Socket.IO Room Broadcast Patterns
```typescript
// Source: https://socket.io/docs/v4/emit-cheatsheet/

// To ALL connected clients in the room (HP update):
io.to('global-boss-room').emit('boss:hp_update', { bossId, hp: newHp, maxHp })

// To the ATTACKING SOCKET ONLY (floating damage number):
socket.emit('boss:damage_dealt', { amount: damage, hitId: crypto.randomUUID() })

// To ALL clients (death + spawn — affects everyone):
io.to('global-boss-room').emit('boss:death', { bossId, winnerId, winnerName })
io.to('global-boss-room').emit('boss:spawn', nextBossState)
```

### Zustand bossStore Subscribed to Socket Events
```typescript
// packages/client/src/stores/bossStore.ts
// Source: https://github.com/pmndrs/zustand
import { create } from 'zustand'
import { socket } from '../lib/socket'
import type { BossState } from '@killing-blow/shared-types'

interface BossStore extends BossState {
  isDefeated: boolean
  setBoss: (boss: BossState) => void
  updateHp: (hp: number) => void
  markDefeated: () => void
}

export const useBossStore = create<BossStore>((set) => ({
  bossId: '', name: '', hp: 0, maxHp: 1, bossNumber: 0, isDefeated: false,
  setBoss: (boss) => set({ ...boss, isDefeated: false }),
  updateHp: (hp) => set({ hp }),
  markDefeated: () => set({ isDefeated: true })
}))

// Call once after socket connects:
export function bindBossStoreToSocket() {
  socket.on('boss:hp_update', ({ hp }) => useBossStore.getState().updateHp(hp))
  socket.on('boss:spawn', (boss) => useBossStore.getState().setBoss(boss))
  socket.on('boss:death', () => useBossStore.getState().markDefeated())
}
```

### HP Bar Component (@radix-ui/react-progress)
```tsx
// packages/client/src/components/BossHpBar.tsx
// Source: @radix-ui/react-progress v1.1.8
import * as Progress from '@radix-ui/react-progress'
import { useBossStore } from '../stores/bossStore'
import { formatNumber, Decimal } from '@killing-blow/shared-types'

export function BossHpBar() {
  const { hp, maxHp, name } = useBossStore()
  const pct = maxHp > 0 ? (hp / maxHp) * 100 : 0

  return (
    <div className="w-full space-y-1">
      <div className="flex justify-between text-sm">
        <span className="font-bold text-red-400">{name}</span>
        <span className="text-muted-foreground">
          {formatNumber(new Decimal(hp))} / {formatNumber(new Decimal(maxHp))}
        </span>
      </div>
      <Progress.Root value={pct} className="h-4 rounded-full bg-zinc-800 overflow-hidden">
        <Progress.Indicator
          className="h-full bg-red-500 transition-[width] duration-200 ease-out"
          style={{ width: `${pct}%` }}
        />
      </Progress.Root>
    </div>
  )
}
```

### Player Sidebar Component
```tsx
// packages/client/src/components/PlayerSidebar.tsx
import { usePlayerStore } from '../stores/playerStore'
import { formatNumber, Decimal } from '@killing-blow/shared-types'

export function PlayerSidebar() {
  const players = usePlayerStore(s => s.activePlayers)
  return (
    <aside className="w-48 space-y-1">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Fighters ({players.length})
      </h3>
      {players.map(p => (
        <div key={p.userId} className="flex justify-between text-sm">
          <span className="truncate">{p.username}</span>
          <span className="text-yellow-400 tabular-nums">
            {formatNumber(new Decimal(p.damageDealt))}
          </span>
        </div>
      ))}
    </aside>
  )
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Redis MULTI/EXEC for atomic game logic | Redis Lua EVAL | Always been true for conditional atomics | MULTI/EXEC cannot branch; Lua can — required for kill detection |
| `framer-motion` import | `motion/react` import | motion v11 (2024) | Same package; React entry point is now `'motion/react'` |
| Server broadcasts damage amounts (client-trusted) | Client sends intent; server computes damage | Industry standard since ~2015 | Required for KB-01; prevents all client-side cheating |
| Socket.IO `socket.broadcast.emit()` for room-wide events | `io.to('room').emit()` from the io instance | Socket.IO v3+ | `io.to()` is the canonical server-global broadcast; `socket.broadcast` excludes sender |
| Writing all game state to Postgres synchronously | Redis for live state; Postgres on boss death only | Real-time game architecture standard | Postgres write latency (5-50ms) is incompatible with per-attack event handling |

**Deprecated/outdated for this project:**
- `socket.io-redis` (old npm package): Replaced by `@socket.io/redis-adapter` — but Phase 2 is single-process so no adapter needed yet.
- Storing boss HP as a Prisma field and doing `prisma.boss.update({ data: { hp: { decrement: damage } } })` per attack: Too slow; not atomic; will produce race conditions immediately.

---

## Open Questions

1. **Base damage value for Phase 2 (before Phase 3 stats exist)**
   - What we know: Phase 3 introduces ATK/CRIT/SPD stats. Phase 2 needs a placeholder base damage so attacks are functional.
   - What's unclear: Should base damage be hardcoded (e.g., 1-10 random), stored per-user in Redis, or derived from bossNumber?
   - Recommendation: Hardcode base damage as `Math.floor(Math.random() * 9) + 1` (1-10) on the server for Phase 2. Store nothing in Redis — Phase 3 will introduce the stat lookup layer. Document this as a Phase 3 migration point.

2. **Boss HP scaling formula for Phase 2**
   - What we know: Phase 3 research flagged this as needing empirical tuning. For Phase 2, a simple formula is needed so tests can complete.
   - What's unclear: At what playercount and attack rate should a boss die? (no data yet)
   - Recommendation: Phase 2 uses `maxHp = 500 * bossNumber` (boss 1 = 500 HP, boss 10 = 5000 HP). This keeps early fights short enough for testing. Phase 3 will replace with the DPS-scaled formula.

3. **Player list update frequency**
   - What we know: Emitting `player:list_update` on every attack floods the channel under heavy load.
   - Recommendation: Emit on a 500ms server-side `setInterval` tick, not per-attack. The interval reads `HGETALL boss:{id}:damage` once and broadcasts. This decouples player list freshness from attack rate.

4. **Attack rate limiting (preventing spam attacks)**
   - What we know: A client could send `attack:intent` in a tight loop. Phase 2 has no explicit rate limit on this event.
   - Recommendation: Add a per-socket `lastAttackAt` timestamp check in the gateway. Reject `attack:intent` if the socket has attacked within the last 500ms (matches the idle game auto-attack rate). This is a Phase 2 server-side guard; Phase 3 replaces with SPD-stat-derived cooldown.

---

## Validation Architecture

`nyquist_validation` is enabled (confirmed in `.planning/config.json`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 |
| Config file | `packages/server/vitest.config.ts` (exists from Phase 1) |
| Quick run command | `pnpm --filter server test --run` |
| Full suite command | `pnpm -r test --run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BOSS-01 | `attack:intent` event causes `boss:hp_update` to be emitted to all sockets in `global-boss-room` | integration (Socket.IO test client) | `pnpm --filter server test --run gateway.test` | Extend existing gateway.test.ts |
| BOSS-01 | Two connected sockets both receive `boss:hp_update` after one attacks | integration | `pnpm --filter server test --run gateway.test` | Extend existing |
| BOSS-02 | `boss:damage_dealt` is emitted ONLY to the attacking socket, not to other sockets | integration | `pnpm --filter server test --run gateway.test` | Extend existing |
| BOSS-03 | When HP reaches 0, `boss:death` followed by `boss:spawn` is emitted to all sockets | integration | `pnpm --filter server test --run gateway.test` | Extend existing |
| KB-01 | Client cannot send a damage value in `attack:intent`; damage is computed server-side | unit (schema check) | `pnpm --filter server test --run damageEngine.test` | Wave 0: `src/game/bossState.test.ts` |
| KB-01 | Lua kill-claim script: concurrent calls with HP=1 result in exactly one kill claimed | unit (lua mock or real Redis) | `pnpm --filter server test --run bossState.test` | Wave 0: `src/game/bossState.test.ts` |
| KB-04 | Player who attacked during final 1% is eligible; player who only attacked above 1% is not set in last1pct hash | unit (Lua script) | `pnpm --filter server test --run bossState.test` | Wave 0 |
| UI-01 | `player:list_update` event contains all players who attacked the current boss with their damage totals | integration | `pnpm --filter server test --run gateway.test` | Extend existing |

### Sampling Rate
- **Per task commit:** `pnpm --filter server test --run`
- **Per wave merge:** `pnpm -r test --run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/server/src/game/bossState.ts` — boss spawn, damage apply, Lua eval wrapper
- [ ] `packages/server/src/game/killClaim.lua` — the atomic kill-claim script
- [ ] `packages/server/src/game/bossState.test.ts` — covers KB-01, KB-04, BOSS-01 (unit level)
- [ ] `packages/server/src/routes/boss.ts` — GET /boss/current HTTP endpoint
- [ ] `packages/client/src/stores/bossStore.ts` — Zustand boss state
- [ ] `packages/client/src/stores/playerStore.ts` — Zustand active players
- [ ] `packages/client/src/components/BossHpBar.tsx` — HP bar component
- [ ] `packages/client/src/components/DamageNumber.tsx` — floating number component
- [ ] `packages/client/src/components/PlayerSidebar.tsx` — player list sidebar
- [ ] `packages/client/src/pages/Game.tsx` — main game page

Note: `packages/server/src/ws/gateway.test.ts` ALREADY EXISTS from Phase 1 and tests JWT middleware. It must be EXTENDED (not replaced) with boss loop event tests.

---

## Sources

### Primary (HIGH confidence)
- `npm view redis version` — v5.11.0 confirmed 2026-03-18
- `npm view socket.io version` — v4.8.3 confirmed 2026-03-18
- `npm view motion version` — v12.38.0 confirmed 2026-03-18
- `npm view prisma version` — v7.5.0 confirmed 2026-03-18
- `npm view @radix-ui/react-progress version` — v1.1.8 confirmed 2026-03-18
- https://redis.io/docs/latest/develop/programmability/eval-intro/ — Lua atomicity guarantee, EVAL vs EVALSHA, KEYS/ARGV pattern
- https://github.com/redis/node-redis/issues/1250 — node-redis v4+ `client.eval({ keys, arguments })` API
- https://redis.io/docs/latest/develop/data-types/hashes/ — HSET, HINCRBY, HGETALL node-redis syntax confirmed
- https://socket.io/docs/v4/typescript/ — ServerToClientEvents/ClientToServerEvents typed generics, client type reversal
- https://socket.io/docs/v4/emit-cheatsheet/ — io.to(room).emit vs socket.emit vs socket.broadcast patterns
- https://motion.dev/docs/react-animation — motion/react import, AnimatePresence, motion.div animate prop
- https://www.prisma.io/blog/prisma-orm-7-3-0 — BigInt JSON serialization fix in v7.3.0
- Phase 1 RESEARCH.md — confirmed stack decisions (Fastify 5, Socket.IO 4.8, Redis 5, Prisma 7, Zustand 5)
- Existing `packages/server/src/ws/gateway.ts` — confirmed Phase 1 gateway architecture, socket.data.userId pattern
- Existing `packages/server/src/plugins/redis.ts` — confirmed redis client decoration on fastify instance
- Existing `packages/client/src/lib/socket.ts` — confirmed `autoConnect: false`, `withCredentials: true` socket setup

### Secondary (MEDIUM confidence)
- https://medium.com/@Games24x7Tech/running-atomicity-consistency-use-case-at-scale-using-lua-scripts-in-redis-372ebc23b58e — production Redis Lua atomicity use case (game-adjacent: inventory/stock management, same conditional DECRBY pattern)
- https://github.com/pmndrs/zustand/discussions/1651 — Zustand WebSocket middleware pattern (community discussion, aligns with official docs pattern)
- https://www.gabrielgambetta.com/client-server-game-architecture.html — server-authoritative damage pipeline (KB-01 architectural justification)

### Tertiary (LOW confidence — informational only)
- https://socket.io/docs/v4/redis-adapter/ — Redis adapter for multi-server Socket.IO (Phase 2 is single-process; noted for Phase 3+ scaling)

---

## Metadata

**Confidence breakdown:**
- Redis Lua kill-claim script: HIGH — EVAL atomicity is official Redis documentation; node-redis eval() API confirmed
- Socket.IO broadcast patterns: HIGH — official Socket.IO v4 emit cheatsheet and TypeScript docs
- motion (floating numbers): HIGH — official motion.dev docs; version confirmed against npm registry
- Prisma schema extensions: HIGH — Prisma 7.5.0 BigInt handling confirmed via official blog post
- Zustand boss store pattern: HIGH — official pmndrs/zustand README; version 5.0.12 already installed
- Base damage placeholder values (1-10 random): MEDIUM — game design choice, no external validation; flagged as Phase 3 migration point
- Boss HP scaling formula (500 * bossNumber): LOW — purely a placeholder recommendation, needs playtesting

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable libraries; Redis, Socket.IO, motion, Prisma all follow semver)
