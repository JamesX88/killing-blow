# Phase 3: Player Progression - Research

**Researched:** 2026-03-18
**Domain:** Idle game gold economy, exponential upgrade scaling, offline progress (server clock), active-tab DPS bonus, boss HP scaling with aggregate player DPS
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BOSS-04 | Boss HP scales dynamically with aggregate player DPS so fights last a reasonable duration | Aggregate DPS tracked in Redis; boss maxHp set at spawn using `targetFightDuration × aggregateDPS`; `spawnNextBoss()` already accepts `maxHp` param — extend it |
| PROG-01 | Player earns gold for every point of damage dealt to the boss | Gold = `damage × GOLD_PER_DAMAGE` (constant, e.g. 1.0); persisted in `PlayerStats.goldBalance` (Decimal string); emitted per-attack via `player:gold_update` socket event |
| PROG-02 | Player can spend gold on flat stat upgrades (ATK, CRIT, SPD) with exponential cost scaling | Cost formula: `baseCost × 1.15^level`; stats stored in `PlayerStats`; REST endpoint `POST /upgrades/:stat`; `getPlayerDamage()` replaces `getBaseDamage()` |
| PROG-03 | Player auto-attacks at reduced rate while offline; gold calculated server-side on reconnect using server clock only | `PlayerStats.lastSeenAt` set on disconnect; on reconnect compute `offlineSeconds = now - lastSeenAt`; gold = `offlineDps × offlineSeconds × OFFLINE_RATE`; cap at 8 hours |
| PROG-04 | Player receives a DPS multiplier bonus while the browser tab is active | Client Page Visibility API sets `isTabActive` in Zustand store; server trusts no client claim — active multiplier is enforced server-side by tracking `lastActiveAt` via `player:heartbeat` socket event |
</phase_requirements>

---

## Summary

Phase 3 closes the idle game loop: players earn gold from dealing damage, spend gold on upgrades that raise their DPS, accumulate offline gold while away, and get a bonus when the tab is active. The codebase from Phase 2 already provides the exact extension points needed — `getBaseDamage()` was declared as a Phase 3 replacement interface, `FightContribution` records all damage per player per boss, and `spawnNextBoss()` accepts a `maxHp` parameter.

The core challenge is keeping progression server-authoritative. Gold balance must live in the database (not localStorage). Upgrade purchases must be validated server-side with the correct formula. Offline progress must use `lastSeenAt` from the server, not the client's clock. The active-tab bonus must be enforced by a server-side heartbeat timeout, not a client claim.

The standard approach for this domain is: break_eternity Decimal for all gold/cost math, a simple `PlayerStats` Prisma model as the single source of truth for per-player state, a `POST /upgrades/:stat` REST endpoint with optimistic Prisma update, and Socket.IO for real-time gold/stat pushes back to the client. No new library dependencies are required — everything needed is already installed.

**Primary recommendation:** Add a `PlayerStats` table to Prisma (goldBalance as String for Decimal safety, atkLevel/critLevel/spdLevel as Int, lastSeenAt as DateTime, lastActiveAt as DateTime). Drive all progression math in a `playerStats.ts` module that the gateway imports. Use the existing Socket.IO infrastructure to push `player:gold_update` and `player:stats_update` events per-socket after each attack resolves.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| break_eternity.js | 2.1.3 (already installed) | All gold/cost math to avoid float overflow | Already the canonical Decimal type per Phase 1 decision — all game numbers flow through `formatNumber` |
| Prisma | 7.5.0 (already installed) | Persist `PlayerStats` (gold, upgrade levels, timestamps) | Already the ORM; migration workflow established in Phase 1 |
| redis (node-redis) | 5.11.0 (already installed) | Track per-session `lastActiveAt` for active-tab detection | Already used for boss HP; per-player ephemeral session data fits here |
| Socket.IO | 4.8.3 (already installed) | Push gold/stat updates to individual sockets | Already the real-time transport; `socket.emit()` to individual socket established in Phase 2 |
| Vitest | 4.1.0 (already installed) | Unit + integration tests for all new game logic | Already the test framework; existing test patterns apply directly |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Page Visibility API | Browser built-in | Detect active tab for client-side heartbeat trigger | No package — just `document.addEventListener('visibilitychange', ...)` in a React `useEffect` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| String-stored gold balance in Prisma | Prisma Decimal/Float | Prisma's native Decimal maps to `number` in JS which overflows for idle game values. String + break_eternity guarantees safety. Already established pattern. |
| Per-socket Redis `lastActiveAt` | Prisma `lastActiveAt` column | Redis is ephemeral — correct for session-level data. DB is for persistent state. Heartbeat timeouts don't need persistence. |
| REST endpoint for upgrades | Socket.IO event for upgrades | REST is cleaner for request/response with HTTP status codes (400 insufficient gold, 200 success). Socket.IO is for server-push, not client-initiated transactions. |

**No new npm installs required.** All dependencies are already present in the monorepo.

---

## Architecture Patterns

### Recommended Project Structure (additions only)

```
packages/server/src/
├── game/
│   ├── bossState.ts          # EXISTING — extend spawnNextBoss() for dynamic maxHp
│   ├── playerStats.ts        # NEW — getPlayerDamage(), computeOfflineGold(), upgrade logic
│   └── killClaim.lua         # EXISTING — unchanged
├── routes/
│   ├── boss.ts               # EXISTING — unchanged
│   └── upgrades.ts           # NEW — POST /upgrades/:stat (ATK, CRIT, SPD)
└── ws/
    └── gateway.ts            # EXISTING — extend attack handler, add disconnect/reconnect hooks

packages/client/src/
├── stores/
│   ├── bossStore.ts          # EXISTING — unchanged
│   ├── playerStore.ts        # EXISTING — unchanged
│   ├── sessionStore.ts       # EXISTING — unchanged
│   └── progressionStore.ts   # NEW — gold balance, upgrade levels, isTabActive
├── components/
│   └── UpgradePanel.tsx      # NEW — ATK/CRIT/SPD upgrade UI
└── pages/
    └── Game.tsx              # EXISTING — add UpgradePanel, wire gold display, heartbeat

packages/shared-types/src/
└── events.ts                 # EXISTING — add player:gold_update, player:stats_update events
```

### Pattern 1: PlayerStats Prisma Model

**What:** Single table per player for all persistent progression state. Gold stored as String to preserve Decimal precision. Upgrade levels as Int. Timestamps for offline/active tracking.
**When to use:** Any per-player persistent game state.

```typescript
// schema.prisma addition
model PlayerStats {
  id           String   @id @default(cuid())
  userId       String   @unique
  goldBalance  String   @default("0")   // Decimal serialized as string
  atkLevel     Int      @default(0)
  critLevel    Int      @default(0)
  spdLevel     Int      @default(0)
  lastSeenAt   DateTime @default(now())
  lastActiveAt DateTime @default(now())
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

**Migration command:**
```bash
npx prisma migrate dev --name add_player_stats
```

### Pattern 2: Player Damage Calculation (getPlayerDamage)

**What:** Replaces `getBaseDamage()` with a function that reads player upgrade levels and returns actual damage including ATK, CRIT, and SPD components.
**When to use:** Every `attack:intent` handler call.

```typescript
// packages/server/src/game/playerStats.ts

const BASE_DAMAGE = 25
const BASE_ATTACK_SPEED = 1.0  // attacks per second
const CRIT_CHANCE_BASE = 0.05  // 5% base crit chance
const CRIT_DAMAGE_MULT = 2.0   // 2x damage on crit

export interface PlayerDamageResult {
  damage: number
  isCrit: boolean
  attackDelay: number  // ms between attacks (for rate limiting)
}

export function getPlayerDamage(stats: { atkLevel: number; critLevel: number; spdLevel: number }): PlayerDamageResult {
  const attackDamage = BASE_DAMAGE + stats.atkLevel * 5       // +5 flat ATK per level
  const critChance = CRIT_CHANCE_BASE + stats.critLevel * 0.02 // +2% crit per level (cap at 0.80)
  const attackSpeed = BASE_ATTACK_SPEED + stats.spdLevel * 0.05 // +0.05 APS per level

  const isCrit = Math.random() < Math.min(critChance, 0.80)
  const damage = isCrit ? Math.floor(attackDamage * CRIT_DAMAGE_MULT) : attackDamage
  const attackDelay = Math.max(50, Math.floor(1000 / attackSpeed)) // min 50ms (20 APS cap)

  return { damage, isCrit, attackDelay }
}
```

**DPS formula for active player:**
```
activeDPS = (BASE_DAMAGE + atkLevel*5) × (1 + critLevel*0.02 * 1.0) × (BASE_SPEED + spdLevel*0.05)
```

### Pattern 3: Exponential Upgrade Cost Scaling

**What:** Standard idle game formula `cost = baseCost × growthRate^level`. Growth rate 1.15 balances early accessibility with late-game wall.
**When to use:** Every upgrade purchase validation and display.

```typescript
// packages/server/src/game/playerStats.ts

const UPGRADE_COSTS = {
  atk:  { base: 10,  growth: 1.15 },
  crit: { base: 25,  growth: 1.15 },
  spd:  { base: 50,  growth: 1.18 },  // SPD slightly steeper — more impactful
} as const

export type StatKey = keyof typeof UPGRADE_COSTS

export function getUpgradeCost(stat: StatKey, currentLevel: number): Decimal {
  const { base, growth } = UPGRADE_COSTS[stat]
  // cost = base × growth^currentLevel
  return new Decimal(base).mul(new Decimal(growth).pow(currentLevel))
}
```

**At level 10:** ATK = 10 × 1.15^10 = ~40 gold. At level 50: ~1,083 gold. At level 100: ~117K gold.
This ensures a 1.15 growth rate provides meaningful progression walls without hitting idle game number overflow issues within Phase 3 scope.

### Pattern 4: Gold Award on Damage

**What:** After each successful `applyDamage()` call in the gateway, award gold proportional to damage dealt. Persist to `PlayerStats.goldBalance` atomically. Push `player:gold_update` to the attacker's socket.
**When to use:** Every `attack:intent` that results in damage applied.

```typescript
// In gateway.ts attack:intent handler, after applyDamage():

const GOLD_PER_DAMAGE = 1.0  // 1 gold per damage point

const goldEarned = new Decimal(damage).mul(GOLD_PER_DAMAGE)

// Upsert PlayerStats gold balance
await prisma.playerStats.upsert({
  where: { userId },
  update: {
    goldBalance: raw(
      // PostgreSQL: cast current string to numeric, add, cast back
      `CAST(CAST("goldBalance" AS NUMERIC) + ${goldEarned.toNumber()} AS TEXT)`
    )
  },
  create: { userId, goldBalance: goldEarned.toString() }
})

// Push update to this socket only
const stats = await prisma.playerStats.findUnique({ where: { userId } })
socket.emit('player:gold_update', {
  goldBalance: stats!.goldBalance,
  goldEarned: goldEarned.toString()
})
```

**CRITICAL:** The raw Prisma query approach above works but creates a read-modify-write race condition under concurrent attacks. The safer pattern is to handle gold accumulation in a Prisma transaction or accept the slight precision loss using a non-atomic increment (acceptable because gold loss from a race is minimal and self-correcting — see Pitfall 1 below for the correct pattern).

**Correct atomic gold update with Prisma:**
```typescript
await prisma.playerStats.upsert({
  where: { userId },
  update: { goldBalance: { increment: goldEarned } },  // only works if goldBalance is Float/Int
  create: { userId, goldBalance: goldEarned.toString() }
})
```

Since goldBalance is stored as String (for Decimal safety), use a read-modify-write in a Prisma transaction:
```typescript
await prisma.$transaction(async (tx) => {
  const existing = await tx.playerStats.upsert({
    where: { userId },
    update: {},
    create: { userId },
  })
  const newBalance = new Decimal(existing.goldBalance).add(goldEarned)
  await tx.playerStats.update({
    where: { userId },
    data: { goldBalance: newBalance.toString() }
  })
})
```

### Pattern 5: Offline Progress on Reconnect

**What:** On `disconnect`, server sets `lastSeenAt = now()` in `PlayerStats`. On `connection`, server computes `offlineSeconds = serverNow - lastSeenAt`, calculates gold earned at the player's offline DPS rate, credits it, and emits `player:offline_reward` to the socket.
**When to use:** Every socket connection where `lastSeenAt` is older than a threshold (e.g., 60 seconds).

```typescript
// On socket 'connection' event in gateway.ts:

const OFFLINE_RATE = 0.5        // 50% of active DPS while offline
const MAX_OFFLINE_HOURS = 8     // cap at 8 hours to prevent abuse

const stats = await prisma.playerStats.findUnique({ where: { userId } })
if (stats) {
  const now = new Date()
  const lastSeenAt = stats.lastSeenAt
  const offlineSeconds = Math.min(
    (now.getTime() - lastSeenAt.getTime()) / 1000,
    MAX_OFFLINE_HOURS * 3600
  )

  if (offlineSeconds > 60) {  // only reward if offline for >1 minute
    const { damage } = getPlayerDamage(stats)
    const offlineDps = damage * (BASE_ATTACK_SPEED + stats.spdLevel * 0.05)
    const offlineGold = new Decimal(offlineDps * offlineSeconds * OFFLINE_RATE)

    await creditGold(prisma, userId, offlineGold)

    socket.emit('player:offline_reward', {
      goldEarned: offlineGold.toString(),
      offlineSeconds: Math.floor(offlineSeconds)
    })
  }

  // Reset lastSeenAt for next session
  await prisma.playerStats.update({
    where: { userId },
    data: { lastSeenAt: now }
  })
}

// On socket 'disconnect':
await prisma.playerStats.update({
  where: { userId },
  data: { lastSeenAt: new Date() }
})
```

**Server clock ONLY.** Never use `Date.now()` from the client. The `lastSeenAt` is written server-side on disconnect; computed server-side on reconnect.

### Pattern 6: Active-Tab Bonus (Server-Side Enforcement)

**What:** Client sends a `player:heartbeat` socket event every 5 seconds while `document.visibilityState === 'visible'`. Server tracks `lastHeartbeatAt` per userId in Redis (TTL 10s). If no heartbeat arrives within the TTL, the player is treated as offline for damage calculation.
**When to use:** Every `attack:intent` where active bonus should apply.

```typescript
// Client: in Game.tsx or a useTabActive hook
useEffect(() => {
  const sendHeartbeat = () => {
    if (!document.hidden && socket.connected) {
      socket.emit('player:heartbeat')
    }
  }

  const interval = setInterval(sendHeartbeat, 5000)
  const handleVisibilityChange = () => sendHeartbeat()
  document.addEventListener('visibilitychange', handleVisibilityChange)

  return () => {
    clearInterval(interval)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
}, [])
```

```typescript
// Server: gateway.ts
const ACTIVE_BONUS_MULTIPLIER = 2.0  // 2x DPS when tab is active

socket.on('player:heartbeat', async () => {
  await redis.set(`player:${userId}:heartbeat`, '1', { EX: 10 })
})

// In attack:intent handler, before damage calculation:
const isActive = await redis.exists(`player:${userId}:heartbeat`)
const damageResult = getPlayerDamage(stats)
const finalDamage = isActive
  ? Math.floor(damageResult.damage * ACTIVE_BONUS_MULTIPLIER)
  : damageResult.damage
```

**Why server-side:** Client cannot be trusted to claim its own active bonus. The heartbeat key expires server-side; no fake heartbeat can extend it without a live connection.

### Pattern 7: Boss HP Scaling with Aggregate DPS (BOSS-04)

**What:** When `spawnNextBoss()` is called, compute the aggregate DPS of all players who contributed to the previous boss fight. Scale the new boss's maxHp so the fight lasts approximately `TARGET_FIGHT_DURATION` seconds.
**When to use:** Inside `spawnNextBoss()`.

```typescript
const TARGET_FIGHT_DURATION = 300  // 5 minutes target fight time
const MIN_BOSS_HP = 1000           // floor for solo play
const MAX_BOSS_HP = 10_000_000     // ceiling to prevent absurd values

export async function computeAggregateDps(
  redis: RedisClient,
  prisma: PrismaClient,
  bossId: string
): Promise<number> {
  // Sum total damage from this fight divided by fight duration
  const damageMap = await redis.hGetAll(`boss:${bossId}:damage`)
  const totalDamage = Object.values(damageMap).reduce((sum, v) => sum + Number(v), 0)

  // Get fight duration from boss spawnedAt
  const boss = await prisma.boss.findUnique({ where: { id: bossId } })
  if (!boss || !boss.defeatedAt) return 0

  const fightSeconds = (boss.defeatedAt.getTime() - boss.spawnedAt.getTime()) / 1000
  return fightSeconds > 0 ? totalDamage / fightSeconds : 0
}

// In spawnNextBoss(), before creating the new boss:
const aggregateDps = await computeAggregateDps(redis, prisma, prevBossId)
const rawHp = aggregateDps * TARGET_FIGHT_DURATION
const newMaxHp = Math.round(
  Math.min(MAX_BOSS_HP, Math.max(MIN_BOSS_HP, rawHp))
)
```

**Why measured DPS, not player count:** Player count is a bad proxy — one whale player with high upgrades dominates. Actual DPS from the last fight is the authoritative signal.

### Anti-Patterns to Avoid

- **Client-provided damage values:** Never accept damage amounts from the client. All damage calculation happens server-side from stored upgrade levels.
- **Client-provided gold claims:** Never trust the client's reported gold balance. All gold is computed and stored server-side.
- **localStorage for gold/upgrades:** Never persist progression in localStorage. It's trivially editable and lost on clear. Prisma is the source of truth.
- **Float for gold balance:** Prisma Float maps to JS `number` (64-bit float, precision ~15 digits). Use String storage + Decimal arithmetic.
- **Blocking boss spawn on gold persistence:** Gold credit on damage is best-effort. DB failure must not block boss spawn (same pattern as FightContribution in Phase 2).
- **Polyfilling Decimal in shared-types for cost calculations:** `break_eternity.js` is already canonical for all game numbers. Do not introduce a second numeric library.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Big number arithmetic for gold/costs | Custom BigInt math | `break_eternity.js` Decimal | Already installed; handles e308+ range; serializes to string safely |
| Tab visibility detection | `window.focus`/`blur` hacks | `visibilitychange` event on `document` (Page Visibility API) | Standard W3C API since 2015; handles minimized windows, not just focus loss |
| Offline time calculation | Client `Date.now()` delta | Server `lastSeenAt` timestamp from Prisma | Client clock is manipulable; server clock is authoritative |
| Upgrade cost display rounding | Manual float formatting | `formatNumber(new Decimal(cost))` from shared-types | Already the canonical number formatter |
| Atomic gold increment for String column | Raw SQL increment | Prisma `$transaction` with read-modify-write | Prisma transactions give row-level isolation |
| Rate-limiting attack speed per player | Map with timestamps | Existing `lastAttackTime` Map in gateway.ts + `attackDelay` from `getPlayerDamage()` | Pattern is already established; just reduce the minimum interval from 100ms to the player's computed `attackDelay` |

**Key insight:** Every complex problem in this phase already has a solution in the existing codebase or standard browser APIs. Phase 3 is primarily extension, not new infrastructure.

---

## Common Pitfalls

### Pitfall 1: Concurrent Gold Updates Cause Race Condition

**What goes wrong:** Two `attack:intent` events arrive simultaneously for the same player. Both read `goldBalance = "100"`, both add 25, both write back "125". Net gold earned: 25 instead of 50.
**Why it happens:** Prisma string fields don't support atomic numeric increment. The read-modify-write is not isolated.
**How to avoid:** Wrap every gold credit in a `prisma.$transaction()`. This is row-locked in PostgreSQL.
**Warning signs:** Gold balance grows slower than expected for high-frequency attackers.

### Pitfall 2: Offline Gold Calculation Uses Wrong Timestamp

**What goes wrong:** `lastSeenAt` is never updated on disconnect, so offline gold is calculated from session start.
**Why it happens:** Socket `disconnect` event is not wired to update the DB.
**How to avoid:** Explicitly set `lastSeenAt = new Date()` in the `socket.on('disconnect')` handler. Test by connecting, waiting, disconnecting, reconnecting and checking the reward.
**Warning signs:** Players receive unreasonably large offline rewards on every login.

### Pitfall 3: Active-Tab Bonus Applied When Tab Hidden

**What goes wrong:** Player minimizes browser. Heartbeat stops. Next attack still applies active bonus because Redis key hasn't expired yet.
**Why it happens:** Redis TTL of 10s means there's a 10s window after tab hidden where the key still exists.
**How to avoid:** This is acceptable as a design grace period. If tighter enforcement is needed, client sends an explicit `player:tab_hidden` event on `document.hidden` that deletes the Redis key immediately.
**Warning signs:** Active DPS multiplier applies to offline attacks.

### Pitfall 4: Boss HP Scaling Creates 1-Player Infinite Loop

**What goes wrong:** Solo player with low stats. First fight `aggregateDps = 5`. New boss spawns with `5 * 300 = 1500 HP`. Player gets slightly better stats. Next boss has `6 * 300 = 1800 HP`. Progress is gated on their own DPS — the loop is solvable but must not feel punishing.
**Why it happens:** Target fight duration is met mathematically but feels slow for new players.
**How to avoid:** Hard floor `MIN_BOSS_HP = 1000` (the current Phase 2 default). New players always see manageable numbers until they invest in upgrades.
**Warning signs:** Solo new player takes more than 10 minutes to kill Boss #2.

### Pitfall 5: Upgrade Level Grows Faster Than Intended Due to Missing Prisma Relation

**What goes wrong:** `PlayerStats` table is created but the `User` relation (`userId` FK) is missing or the `@unique` constraint on `userId` is dropped. Multiple `PlayerStats` rows accumulate per user from upsert logic.
**Why it happens:** Prisma `upsert` requires the where clause to match a `@unique` field. If the migration is wrong, it inserts instead of updating.
**How to avoid:** Always mark `userId String @unique` in the model. Verify with `prisma studio` after migration.
**Warning signs:** `prisma.playerStats.findUnique({ where: { userId } })` returns null even after an upgrade purchase.

### Pitfall 6: getPlayerDamage Called Without Stats Loaded

**What goes wrong:** New player has no `PlayerStats` row yet. `prisma.playerStats.findUnique()` returns null. Null is passed to `getPlayerDamage()`. Stats are `undefined`, damage is `NaN`.
**Why it happens:** Upsert in the connect handler is async and may race with the first attack.
**How to avoid:** Use `upsert` with `create: { userId, goldBalance: "0", atkLevel: 0, ... }` as the default. The first attack handler should `upsert` (not `findUnique`) to guarantee the row exists.
**Warning signs:** Floating damage numbers show "NaN" or boss HP is not decremented.

---

## Code Examples

Verified patterns from the existing codebase and standard APIs:

### Prisma $transaction for atomic gold credit

```typescript
// Source: Prisma docs - interactive transactions
export async function creditGold(
  prisma: PrismaClient,
  userId: string,
  amount: Decimal
): Promise<string> {
  const stats = await prisma.$transaction(async (tx) => {
    const existing = await tx.playerStats.upsert({
      where: { userId },
      update: {},
      create: { userId, goldBalance: '0' }
    })
    const newBalance = new Decimal(existing.goldBalance).add(amount)
    return tx.playerStats.update({
      where: { userId },
      data: { goldBalance: newBalance.toString() }
    })
  })
  return stats.goldBalance
}
```

### Upgrade purchase REST handler

```typescript
// Source: pattern from auth.ts routes in this codebase
export default async function upgradeRoutes(fastify: FastifyInstance) {
  fastify.post<{ Params: { stat: string } }>('/upgrades/:stat', {
    onRequest: [fastify.authenticate]
  }, async (req, reply) => {
    const stat = req.params.stat as StatKey
    if (!(['atk', 'crit', 'spd'] as const).includes(stat)) {
      return reply.status(400).send({ error: 'Invalid stat' })
    }

    const userId = (req.user as { userId: string }).userId

    const result = await fastify.prisma.$transaction(async (tx) => {
      const stats = await tx.playerStats.upsert({
        where: { userId },
        update: {},
        create: { userId, goldBalance: '0' }
      })

      const currentLevel = stats[`${stat}Level` as keyof typeof stats] as number
      const cost = getUpgradeCost(stat, currentLevel)
      const balance = new Decimal(stats.goldBalance)

      if (balance.lt(cost)) {
        throw new Error('INSUFFICIENT_GOLD')
      }

      const newBalance = balance.sub(cost)
      return tx.playerStats.update({
        where: { userId },
        data: {
          goldBalance: newBalance.toString(),
          [`${stat}Level`]: { increment: 1 }
        }
      })
    })

    return result
  })
}
```

### Tab heartbeat in React (Game.tsx)

```typescript
// Source: MDN Page Visibility API + existing useEffect pattern from Game.tsx
useEffect(() => {
  if (!isAuthenticated) return

  const sendHeartbeat = () => {
    if (!document.hidden && socket.connected) {
      socket.emit('player:heartbeat')
    }
  }

  // Send immediately on mount if visible
  sendHeartbeat()

  const interval = setInterval(sendHeartbeat, 5000)
  document.addEventListener('visibilitychange', sendHeartbeat)

  return () => {
    clearInterval(interval)
    document.removeEventListener('visibilitychange', sendHeartbeat)
  }
}, [isAuthenticated])
```

### UpgradePanel component pattern (Zustand + REST)

```typescript
// Source: Zustand v5 patterns from existing stores
import { create } from 'zustand'
import { Decimal, formatNumber } from '@killing-blow/shared-types'

interface ProgressionState {
  goldBalance: string        // Decimal string
  atkLevel: number
  critLevel: number
  spdLevel: number
  isTabActive: boolean
  setStats: (stats: Partial<ProgressionState>) => void
  addGold: (amount: string) => void
}

export const useProgressionStore = create<ProgressionState>((set, get) => ({
  goldBalance: '0',
  atkLevel: 0,
  critLevel: 0,
  spdLevel: 0,
  isTabActive: true,
  setStats: (stats) => set(stats),
  addGold: (amount) => {
    const newBalance = new Decimal(get().goldBalance).add(new Decimal(amount))
    set({ goldBalance: newBalance.toString() })
  }
}))
```

### Socket events to add to shared-types/events.ts

```typescript
// Source: existing events.ts pattern
export interface ServerToClientEvents {
  // ... existing events ...
  'player:gold_update': (payload: { goldBalance: string; goldEarned: string }) => void
  'player:stats_update': (payload: { atkLevel: number; critLevel: number; spdLevel: number; goldBalance: string }) => void
  'player:offline_reward': (payload: { goldEarned: string; offlineSeconds: number }) => void
}

export interface ClientToServerEvents {
  // ... existing events ...
  'attack:intent': (payload: { bossId: string }) => void
  'player:heartbeat': () => void
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `localStorage` for gold/upgrades | Server DB (Prisma) | Industry standard since ~2018 for multiplayer | Required for anti-cheat; enables offline calculation |
| `setInterval` for offline time calc | `lastSeenAt` DB timestamp on disconnect | Post-2019 idle games | Server clock is authoritative; tab throttling doesn't affect it |
| `window.focus`/`blur` for tab detection | Page Visibility API `visibilitychange` | W3C standard since 2015 | Handles minimized windows, not just focus loss |
| Client-submitted damage values | `attack:intent` → server calculates | Post-2020 server-auth games | Eliminates all client-side cheating |
| Fixed boss HP | Dynamic HP scaled to aggregate DPS | Multiplayer idle games (2020+) | Fights last the same duration regardless of player count |

**No deprecated patterns in the current stack.** Prisma 7, Socket.IO 4.8, Zustand 5, React 19 — all current stable versions.

---

## Open Questions

1. **Active bonus multiplier value (2.0x)**
   - What we know: The requirement says "measurably more DPS" for active vs offline. 2.0x is a reasonable starting value.
   - What's unclear: Exact multiplier needs balance playtesting. At 2.0x, offline DPS = 0.5 DPS (with OFFLINE_RATE=0.5). Active players deal 4x offline rate.
   - Recommendation: Start with 2.0x active, 0.5x offline. Expose as named constants for easy tuning.

2. **Gold-per-damage rate**
   - What we know: 1 gold per damage point means a new player earns 25 gold/attack. Upgrade 1 ATK costs 10 gold — achievable in one hit. May need tuning.
   - What's unclear: Early game feel. Should the first upgrade be instant or require ~10 seconds of play?
   - Recommendation: Start with `GOLD_PER_DAMAGE = 1.0`. If first upgrade costs 10 gold and base damage is 25, first upgrade is nearly immediate. Consider `GOLD_PER_DAMAGE = 0.5` or raising ATK base cost to 50.

3. **Boss HP scaling rollout**
   - What we know: Phase 2 left `maxHp = 1000` hardcoded. Phase 3 needs to pass computed HP to `spawnNextBoss`.
   - What's unclear: The very first boss after Phase 3 ships — no prior fight data exists to measure aggregate DPS. Need a bootstrap value.
   - Recommendation: If `prevBossId` is null or `aggregateDps == 0`, use `MIN_BOSS_HP = 1000` as the default. First few bosses use static HP; dynamic scaling kicks in after the first kill.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `packages/server/vitest.config.ts` (inferred from existing tests) |
| Quick run command | `pnpm --filter @killing-blow/server test --run` |
| Full suite command | `pnpm --filter @killing-blow/server test --run && pnpm --filter @killing-blow/shared-types test --run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROG-01 | Gold credited after attack:intent | unit | `vitest run packages/server/src/game/playerStats.test.ts` | ❌ Wave 0 |
| PROG-01 | gold_update socket event emitted to attacker only | integration | `vitest run packages/server/src/ws/gateway.test.ts` | ✅ (extend existing) |
| PROG-02 | Upgrade cost formula correct at levels 0/10/50 | unit | `vitest run packages/server/src/game/playerStats.test.ts` | ❌ Wave 0 |
| PROG-02 | POST /upgrades/atk deducts gold, increments atkLevel | integration | `vitest run packages/server/src/routes/upgrades.test.ts` | ❌ Wave 0 |
| PROG-02 | POST /upgrades/atk returns 400 for insufficient gold | integration | `vitest run packages/server/src/routes/upgrades.test.ts` | ❌ Wave 0 |
| PROG-03 | Offline gold = offlineDps × seconds × 0.5 (capped at 8h) | unit | `vitest run packages/server/src/game/playerStats.test.ts` | ❌ Wave 0 |
| PROG-03 | lastSeenAt updated on disconnect, offline reward emitted on reconnect | integration | `vitest run packages/server/src/ws/gateway.test.ts` | ✅ (extend existing) |
| PROG-04 | Heartbeat key set in Redis; active multiplier applied in attack | integration | `vitest run packages/server/src/ws/gateway.test.ts` | ✅ (extend existing) |
| BOSS-04 | computeAggregateDps returns correct DPS from Redis damage hash | unit | `vitest run packages/server/src/game/bossState.test.ts` | ✅ (extend existing) |
| BOSS-04 | spawnNextBoss uses dynamic maxHp when aggregateDps > 0 | unit | `vitest run packages/server/src/game/bossState.test.ts` | ✅ (extend existing) |

### Sampling Rate

- **Per task commit:** `pnpm --filter @killing-blow/server test --run`
- **Per wave merge:** `pnpm --filter @killing-blow/server test --run && pnpm --filter @killing-blow/shared-types test --run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `packages/server/src/game/playerStats.test.ts` — covers PROG-01 (gold credit), PROG-02 (cost formula), PROG-03 (offline calc)
- [ ] `packages/server/src/routes/upgrades.test.ts` — covers PROG-02 (upgrade purchase endpoint)

*(Existing test files `bossState.test.ts` and `gateway.test.ts` will be extended with new test cases — no new file required for those)*

---

## Sources

### Primary (HIGH confidence)

- Codebase direct read — `packages/server/src/game/bossState.ts`, `gateway.ts`, `shared-types/src/events.ts`, `prisma/schema.prisma` — confirmed existing extension points, established patterns, and hardcoded constants
- MDN Page Visibility API — https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API — confirmed `visibilitychange` event API and `document.hidden` property
- break_eternity.js npm — version 2.1.3 confirmed current via `npm view break_eternity.js version`
- Prisma npm — version 7.5.0 confirmed current via `npm view prisma version`

### Secondary (MEDIUM confidence)

- Kongregate Idle Game Math (GameDeveloper.com) — https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i — growth rate 1.07-1.15 range for upgrade cost formula; verified against multiple idle game analyses
- MDN Document.visibilityState — https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilityState — `"visible"` / `"hidden"` values confirmed

### Tertiary (LOW confidence)

- Boss HP scaling formula `aggregateDps × TARGET_FIGHT_DURATION` — derived from game design principles (Terraria/Monster Hunter multiplayer scaling) + STATE.md flag "needs empirical tuning." The formula is sound but the `TARGET_FIGHT_DURATION = 300` constant is a starting value requiring playtesting.
- Gold per damage rate `GOLD_PER_DAMAGE = 1.0` and upgrade base costs — estimated starting values; requires balance validation in play.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and in use; no new dependencies needed
- Architecture: HIGH — extends existing Phase 2 patterns directly; `getBaseDamage()` was explicitly designed as the Phase 3 replacement point
- Pitfalls: HIGH — race condition and offline timestamp pitfalls verified against the actual codebase structure
- Balance constants (GOLD_PER_DAMAGE, TARGET_FIGHT_DURATION): LOW — starting values only; require playtesting

**Research date:** 2026-03-18
**Valid until:** 2026-04-17 (30 days — stable stack, no fast-moving dependencies)
