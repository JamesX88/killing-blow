# Phase 4: Competition and Social - Research

**Researched:** 2026-03-19
**Domain:** Real-time multiplayer announcements, persistent leaderboards, cosmetic systems, boss lore
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| KB-02 | Prominent killing blow announcement broadcast to all players simultaneously | Socket.IO `io.to('global-boss-room').emit` already used for boss:death; extend payload with announcement display fields; client needs a toast/modal/overlay component driven by the existing boss:death event |
| KB-03 | Killing blow winner receives KB Currency; global leaderboard tracks total kills per player | User.killCount column already exists in Prisma schema; need kbCurrency column on User or PlayerStats; leaderboard = paginated query ordered by killCount DESC; increment killCount atomically on boss death in gateway.ts |
| KB-05 | Post-boss death screen shows top damage contributors for that fight | FightContribution records already written at boss death time in gateway.ts; need a new endpoint or extend boss:death payload to include sorted contributions; client renders as overlay until boss:spawn fires |
| UI-03 | Player can spend KB Currency on cosmetic titles displayed next to their name | New title shop: REST endpoint to list available titles, POST to purchase, PATCH to equip; equippedTitle column on User; Player sidebar and leaderboard must read equippedTitle from player list |
| UI-04 | Each boss displays a unique name and brief lore snippet during the fight | Boss name is already stored; need a lore lookup table (static JSON or DB seed); extend BossState type with lore field; BossSprite/boss card renders lore text |

</phase_requirements>

---

## Summary

Phase 4 builds all social/competitive surface area on top of the server-authoritative foundation from Phases 1-3. The core infrastructure — Socket.IO broadcast room, Redis atomic kill claim, Prisma FightContribution writes, User.killCount column — is already wired in. This phase is primarily additive: new DB columns, new REST endpoints, new Socket.IO events, and new React components.

The killing blow announcement (KB-02) requires zero new infrastructure: `boss:death` is already broadcast to `global-boss-room`. The work is a prominent client-side overlay component that fires on this event and auto-dismisses when `boss:spawn` arrives (~3 seconds later). The post-fight contributor screen (KB-05) can ride inside the existing `boss:death` payload — contributions are already persisted at kill time in `gateway.ts`.

KB Currency and the title system (KB-03, UI-03) are the most schema-impactful: two new Prisma columns (`kbBalance Int`, `equippedTitle String?` on User), a static title catalogue (JSON seed data), purchase/equip REST endpoints, and ActivePlayer type extension for the sidebar/leaderboard. The leaderboard is a simple sorted DB query — no special library needed. Boss lore (UI-04) is a static lookup by `bossNumber % loreCatalogueSize` or a seeded lookup table: no new infrastructure.

**Primary recommendation:** Extend existing patterns exactly — new Prisma columns, new Fastify routes, new socket event payload fields, new Zustand store slices, new React components. Do not introduce new libraries unless unavoidable.

---

## Standard Stack

### Core (already in project — no new installs required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Socket.IO (server) | 4.8.3 | Real-time announcement broadcast | `io.to('global-boss-room').emit` pattern already established |
| Socket.IO (client) | 4.8.3 | Listen for announcements, update stores | `subscribeToGame` / `unsubscribeFromGame` pattern already established |
| Prisma + PostgreSQL | 6.7.0 | Leaderboard queries, title ownership, kbBalance | ORM with typed queries; all existing persistence uses this |
| Fastify | 5.8.2 | REST endpoints for leaderboard, title shop, equip | All existing routes use Fastify with `fastify.authenticate` guard |
| Zustand | 5.0.12 | Client-side store slices for announcement state, title | bossStore/playerStore/progressionStore pattern already established |
| React + Vite | 19 / 8 | UI components for announcement overlay, leaderboard, lore | Entire client is React; shadcn components already available |
| break_eternity.js | 2.1.3 | KB Currency display (large numbers) | Already the canonical Decimal type throughout the project |
| motion | 12.38.0 | Announcement overlay animation | Already installed; used for game feel |

### No New Installs Required

All needed capability exists in the current dependency graph. Confirm before adding anything:

```bash
npm view [package] version  # only if a genuinely new library is considered
```

The `motion` package (Framer Motion v12 standalone) covers all animation needs for announcement overlays. Do not add `react-hot-toast` or similar — the existing `OfflineRewardToast` pattern (custom component with Zustand) is the established pattern.

---

## Architecture Patterns

### Recommended Project Structure (additions only)

```
packages/server/src/
├── game/
│   └── bossState.ts         # add getBossContributors() helper
├── routes/
│   ├── leaderboard.ts       # NEW: GET /leaderboard
│   └── titles.ts            # NEW: GET /titles, POST /titles/:id/purchase, PATCH /titles/:id/equip
packages/client/src/
├── components/
│   ├── KillingBlowAnnouncement.tsx  # NEW: overlay on boss:death
│   ├── PostFightScreen.tsx           # NEW: contributors list, auto-hides on boss:spawn
│   ├── Leaderboard.tsx               # NEW: paginated kill count table
│   └── TitleShop.tsx                 # NEW: spend KB Currency on titles
├── stores/
│   └── announcementStore.ts          # NEW: tracks active announcement + contributors
packages/shared-types/src/
└── events.ts                         # extend ServerToClientEvents with new payload fields
```

### Pattern 1: Announcement via Existing boss:death Event

**What:** The `boss:death` event already fires to `global-boss-room`. Extend its payload to include top contributors, winner's new kill count, and winner's equipped title. Client shows a full-screen or top-banner announcement component, which self-dismisses when `boss:spawn` fires (typically ~3 seconds later).

**When to use:** Any time a boss dies. The client's `subscribeToGame` handles `boss:death` already — add the announcement render logic there.

**Existing gateway pattern (gateway.ts lines 114-162):**
```typescript
// Already fires:
io.to('global-boss-room').emit('boss:death', { bossId, winnerId, winnerUsername })

// Phase 4: extend payload to:
io.to('global-boss-room').emit('boss:death', {
  bossId,
  winnerId,
  winnerUsername,
  winnerTitle: string | null,     // equippedTitle from User record
  winnerKillCount: number,         // User.killCount after increment
  topContributors: Array<{ username: string; damageDealt: number; title: string | null }>
})
```

**Client store pattern (follow bossStore.ts):**
```typescript
// announcementStore.ts
interface AnnouncementState {
  active: boolean
  winnerId: string | null
  winnerUsername: string | null
  winnerTitle: string | null
  winnerKillCount: number
  topContributors: ContributorEntry[]
  setAnnouncement: (data: ...) => void
  clearAnnouncement: () => void
}
```

### Pattern 2: KB Currency and Kill Count Increment (Atomic DB Update)

**What:** On boss death, atomically increment `User.killCount` and `User.kbBalance` for the winner in a Prisma `$transaction`. Use `update` with `{ increment: 1 }` syntax (already used in upgrades). Return new values in boss:death payload.

**Example:**
```typescript
// In gateway.ts kill branch, after finding bossRecord:
const updatedWinner = await prisma.user.update({
  where: { id: winnerId },
  data: {
    killCount: { increment: 1 },
    kbBalance: { increment: 1 },   // 1 KB Currency per kill
  },
  select: { killCount: true, kbBalance: true, equippedTitle: true }
})
```

### Pattern 3: Leaderboard Endpoint (Paginated DB Query)

**What:** `GET /leaderboard?page=1&limit=20` — query `User` ordered by `killCount DESC`, join `equippedTitle`. No caching needed at this scale.

**Example:**
```typescript
// routes/leaderboard.ts
fastify.get('/leaderboard', { onRequest: [fastify.authenticate] }, async (req, reply) => {
  const { page = 1, limit = 20 } = req.query as { page?: number; limit?: number }
  const skip = (page - 1) * Math.min(limit, 100)
  const users = await prisma.user.findMany({
    orderBy: { killCount: 'desc' },
    take: Math.min(limit, 100),
    skip,
    select: { id: true, username: true, killCount: true, kbRank: true, equippedTitle: true }
  })
  return { users, page, limit }
})
```

### Pattern 4: Title System (Static Catalogue + DB Ownership)

**What:** Titles are a fixed catalogue (constant array in server code, not a DB table — simpler and adequate for v1). Ownership and equipped state live in User columns. Purchase deducts kbBalance; equip sets equippedTitle.

**Catalogue definition (game constant — not a DB table):**
```typescript
// packages/server/src/game/titles.ts
export const TITLE_CATALOGUE = [
  { id: 'slayer',       label: 'Slayer',       cost: 1 },
  { id: 'annihilator',  label: 'Annihilator',  cost: 3 },
  { id: 'bane',         label: 'Bane',         cost: 5 },
  { id: 'executioner',  label: 'Executioner',  cost: 10 },
  { id: 'destroyer',    label: 'Destroyer',    cost: 25 },
] as const
export type TitleId = typeof TITLE_CATALOGUE[number]['id']
```

**DB schema changes (additive only):**
```prisma
model User {
  // existing fields ...
  kbBalance     Int      @default(0)
  ownedTitles   String   @default("[]")   // JSON array of TitleId strings
  equippedTitle String?                   // null = no title shown
}
```

**Note on ownedTitles storage:** Using a JSON string column is the simplest approach consistent with the existing project pattern (goldBalance is also stored as a String). A separate `UserTitle` join table is cleaner relationally but is over-engineering for a catalogue of ~5-10 titles in v1.

### Pattern 5: Boss Lore (Static Lookup, No New DB Table)

**What:** Each boss gets a name and lore snippet. The existing `spawnNextBoss` already sets a name (`Boss #${bossNumber}`). Phase 4 upgrades this to use a rotating lore catalogue keyed by `bossNumber % catalogue.length`.

**Lore catalogue (static constant):**
```typescript
// packages/server/src/game/bossLore.ts
export const BOSS_LORE = [
  { name: 'Gorvax the Unbroken',   lore: 'An ancient titan whose hide has never known defeat.' },
  { name: 'Skareth the Devourer',  lore: 'Consumes entire armies to fuel its insatiable hunger.' },
  { name: 'Vex the Eternal',       lore: 'Has been slain a thousand times, yet always returns.' },
  // ... 5-10 entries minimum
] as const

export function getBossLore(bossNumber: number) {
  return BOSS_LORE[bossNumber % BOSS_LORE.length]
}
```

**Extend BossState type:**
```typescript
// shared-types/src/events.ts
export interface BossState {
  bossId: string
  name: string
  lore: string          // NEW
  hp: number
  maxHp: number
  bossNumber: number
}
```

**Update spawnNextBoss to use lore:**
```typescript
const { name, lore } = getBossLore(bossNumber)
// store lore in boss:meta Redis key alongside name
await redis.set(`boss:${bossId}:meta`, JSON.stringify({ name, lore, bossNumber }))
```

### Pattern 6: ActivePlayer Type Extension for Titles

**What:** The `ActivePlayer` type flowing through `player:list_update` must include `equippedTitle` so the sidebar can show it.

```typescript
// shared-types/src/events.ts
export interface ActivePlayer {
  userId: string
  username: string
  damageDealt: number
  equippedTitle: string | null   // NEW
}
```

The server's `getActivePlayers` already reads `boss:${bossId}:usernames`. Add a parallel `boss:${bossId}:titles` Redis hash — set at attack time from the player's `equippedTitle` (fetched via Prisma upsert that already happens in the attack handler).

### Anti-Patterns to Avoid

- **Separate leaderboard service / Redis sorted set:** ZRANGEBYSCORE is overkill for a game with < 10,000 players. A simple Prisma `orderBy: { killCount: 'desc' }` query is correct.
- **Separate title DB table for v1:** A JSON string column on User is adequate; a join table adds migration and query complexity for no benefit at current scale.
- **Polling the leaderboard in real-time:** The leaderboard page fetches on mount. It does not need WebSocket updates — kill events are infrequent enough that a manual refresh or navigate-back-to-page is acceptable.
- **Custom announcement toast library:** Follow the OfflineRewardToast pattern (Zustand store + custom component). Do not add react-hot-toast, react-toastify, or sonner.
- **Storing lore in the database:** Boss lore is fixed content. Static constants in source code are simpler, type-safe, and require no migrations.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Animated announcement overlay | Custom CSS keyframes from scratch | `motion` (already installed, v12) | `motion` handles spring/fade/scale; already in package.json |
| Leaderboard sort | In-memory sort of all users | Prisma `orderBy: { killCount: 'desc' }` | DB-level sort is correct; never load all users into server memory |
| Atomic kill count increment | Read-modify-write in application code | Prisma `{ increment: 1 }` in `update` | Prisma translates to `UPDATE ... SET killCount = killCount + 1` — atomic at DB level |
| KbRank computation | Real-time rank calculation on every request | Periodic batch update or derived from leaderboard position | Computing RANK() on every profile load is expensive; return position from leaderboard query instead |
| Title ownership validation | Custom middleware | Inline check in route handler: parse ownedTitles JSON, verify id present | Simple array include check; no need for separate middleware |
| Boss name generation | Random name generator library | Static lore catalogue array | Consistency matters — players should recognize boss names across sessions |

**Key insight:** Every feature in this phase has a natural extension point in the existing code. The discipline is to extend, not replace: extend boss:death payload, extend ActivePlayer type, extend spawnNextBoss, extend User model. New libraries add maintenance burden for no gain.

---

## Common Pitfalls

### Pitfall 1: boss:death Payload Race — Contributors Not Yet Persisted

**What goes wrong:** The `boss:death` event fires immediately when kill is confirmed, but `fightContribution.createMany` is inside a `try/catch` that runs after. If you read contributions from DB in the same code path to include in the event, they may not be written yet.

**Why it happens:** The gateway kill branch (gateway.ts lines 119-141) does DB writes inside a try/catch with no guarantee of ordering relative to the emit.

**How to avoid:** Read contributions from the Redis damage hash (`boss:${bossId}:damage` + `boss:${bossId}:usernames`), not from DB, when building the boss:death payload. Redis is already authoritative for the current fight's damage data.

```typescript
// Correct: read from Redis at kill time, before DB writes
const damageHash = await redis.hGetAll(`boss:${bossId}:damage`)
const usernameHash = await redis.hGetAll(`boss:${bossId}:usernames`)
const titlesHash = await redis.hGetAll(`boss:${bossId}:titles`)
const topContributors = Object.entries(damageHash)
  .map(([uid, dmg]) => ({
    username: usernameHash[uid] ?? uid,
    damageDealt: Number(dmg),
    title: titlesHash[uid] ?? null
  }))
  .sort((a, b) => b.damageDealt - a.damageDealt)
  .slice(0, 5)
```

### Pitfall 2: Stale equippedTitle in player:list_update

**What goes wrong:** If equippedTitle is fetched from DB on every attack (expensive), or if it's not fetched at all and only stored in Redis on connection, a title change won't reflect until reconnect.

**Why it happens:** The attack handler already does a Prisma upsert on `playerStats` — but `equippedTitle` is on `User`, not `PlayerStats`.

**How to avoid:** Store equippedTitle in `boss:${bossId}:titles` Redis hash at attack time, fetched from the User record during the existing Prisma upsert in the attack handler. Title changes take effect immediately on next attack (acceptable lag: < 1 attack interval).

```typescript
// In attack handler, alongside existing playerStats upsert:
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: { equippedTitle: true }
})
if (user?.equippedTitle) {
  await redis.hSet(`boss:${bossId}:titles`, userId, user.equippedTitle)
}
```

### Pitfall 3: kbRank Column Staleness

**What goes wrong:** `User.kbRank` is a stored column that requires periodic recomputation. If updated only on kill events, it becomes stale for players who aren't currently killing (rank can fall without notification).

**Why it happens:** Rank is a relative value — it changes whenever anyone else's killCount changes.

**How to avoid:** Do not rely on the stored `kbRank` column for leaderboard display. Compute rank from leaderboard position (query returns ordered list; client derives rank from index + pagination offset). The `kbRank` column exists on the User model from Phase 1 — leave it nullable; it can be updated by a background batch job in a future phase.

### Pitfall 4: Socket Event Handler Registration Order

**What goes wrong:** Phase 3 discovered that event handlers must be registered synchronously before `await` calls in `io.on('connection')`. New `boss:death`-driven announcement must not require new client-to-server events that are registered after an await.

**Why it happens:** Node.js event loop; any event fired during an async pause after `connection` fires can be dropped if handlers aren't registered.

**How to avoid:** Follow the existing pattern: register all handlers synchronously at the top of `io.on('connection')`. Server-to-client events (like the extended boss:death) are fine — they're emitted by the server, not received.

### Pitfall 5: ownedTitles JSON Parsing Failures

**What goes wrong:** `User.ownedTitles` stored as a JSON string; if not initialized to `"[]"`, `JSON.parse` throws on empty/null values.

**How to avoid:** Prisma schema default is `@default("[]")`. Always use `JSON.parse(user.ownedTitles || '[]')` defensively in purchase/equip logic. Never pass raw string to array operations.

### Pitfall 6: BossState lore Field Breaking Existing Clients

**What goes wrong:** Adding `lore: string` to the `BossState` interface makes TypeScript complain in existing code that doesn't include lore (e.g., test mocks in bossState.test.ts that construct BossState objects).

**How to avoid:** Make lore optional in the interface (`lore?: string`) with a fallback in rendering (`boss.lore ?? ''`). This allows existing test mocks to compile without changes. Lore becomes required once all call sites are updated.

---

## Code Examples

Verified patterns from the existing codebase:

### Prisma Atomic Increment (already used in upgrades)
```typescript
// Source: packages/server/src/routes/upgrades.ts pattern via playerStats.ts
await prisma.playerStats.update({
  where: { userId },
  data: { atkLevel: { increment: 1 } }
})

// Phase 4 equivalent for killCount:
await prisma.user.update({
  where: { id: winnerId },
  data: { killCount: { increment: 1 }, kbBalance: { increment: 1 } },
  select: { killCount: true, kbBalance: true, equippedTitle: true }
})
```

### Socket.IO Broadcast to All (already used in gateway.ts)
```typescript
// Source: packages/server/src/ws/gateway.ts line 117
io.to('global-boss-room').emit('boss:death', { bossId, winnerId, winnerUsername })

// Phase 4: extend payload inline — no new rooms needed
io.to('global-boss-room').emit('boss:death', {
  bossId, winnerId, winnerUsername,
  winnerTitle: updatedWinner.equippedTitle,
  winnerKillCount: updatedWinner.killCount,
  topContributors  // derived from Redis, see Pitfall 1
})
```

### Fastify Route with Authentication (established pattern)
```typescript
// Source: packages/server/src/routes/upgrades.ts
fastify.get('/leaderboard', { onRequest: [fastify.authenticate] }, async (req, reply) => {
  // ...
})
```

### Zustand Store Slice (established pattern)
```typescript
// Source: packages/client/src/stores/bossStore.ts
import { create } from 'zustand'

interface AnnouncementState {
  active: boolean
  // ...fields
  setAnnouncement: (data: AnnouncementPayload) => void
  clearAnnouncement: () => void
}

export const useAnnouncementStore = create<AnnouncementState>((set) => ({
  active: false,
  setAnnouncement: (data) => set({ active: true, ...data }),
  clearAnnouncement: () => set({ active: false }),
}))
```

### socket.ts Event Subscription (established pattern)
```typescript
// Source: packages/client/src/lib/socket.ts
// In subscribeToGame():
socket.on('boss:death', ({ winnerId, winnerUsername, winnerTitle, winnerKillCount, topContributors }) => {
  useBossStore.getState().markDefeated(winnerUsername)
  useAnnouncementStore.getState().setAnnouncement({
    winnerId, winnerUsername, winnerTitle, winnerKillCount, topContributors
  })
})
socket.on('boss:spawn', (boss) => {
  useBossStore.getState().setBoss(boss)
  useAnnouncementStore.getState().clearAnnouncement()  // dismiss overlay
})
```

### Motion Animation (already available)
```typescript
// Source: packages/client/package.json — motion ^12.38.0
import { motion, AnimatePresence } from 'motion/react'

// KillingBlowAnnouncement.tsx
<AnimatePresence>
  {active && (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
    >
      {/* announcement content */}
    </motion.div>
  )}
</AnimatePresence>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate leaderboard microservice | Single DB query with orderBy | Established from Phase 1 | No new infra |
| Redis ZADD sorted sets for leaderboard | Prisma query (adequate at this scale) | Design decision | Simpler; Redis sorted set only needed at 100k+ players |
| Separate notification library | Custom Zustand store + component | Phase 3 OfflineRewardToast | Consistent with existing pattern |
| Title NFT / blockchain ownership | Simple DB column `ownedTitles: String` | Never applicable | Out of scope |

**Deprecated/outdated:**
- Boss name `Boss #${bossNumber}`: Replaced by lore catalogue lookup in Phase 4
- `boss:death` payload `{ bossId, winnerId, winnerUsername }`: Extended in Phase 4 to include title, kill count, contributors

---

## Open Questions

1. **KB Currency award amount per kill**
   - What we know: requirement says "receives KB Currency" — amount not specified
   - What's unclear: 1 per kill? Scaled by damage? Scaled by boss HP?
   - Recommendation: Default to 1 KB Currency per killing blow. Simple, predictable. The title catalogue should be priced to make the first title accessible within 1-5 kills.

2. **Number of title options in v1**
   - What we know: UI-03 says "cosmetic titles" — count not specified
   - What's unclear: How many titles to ship in v1? What prices?
   - Recommendation: 5 titles at costs 1, 3, 5, 10, 25 KB Currency. Cheap entry, meaningful progression.

3. **Number of lore entries**
   - What we know: UI-04 says "unique name and brief lore snippet"
   - What's unclear: How many unique bosses before rotation? 5? 10? 20?
   - Recommendation: 10 entries minimum. Rotation is acceptable — players will cycle through bosses rapidly.

4. **Leaderboard visibility (auth required or public?)**
   - What we know: profile page already requires auth (fastify.authenticate)
   - What's unclear: should leaderboard be public (no auth) or auth-only?
   - Recommendation: Auth-required for v1, consistent with all other endpoints. Remove restriction later if marketing needs a public link.

5. **kbRank column — update strategy**
   - What we know: `kbRank` column exists on User from Phase 1, currently unused
   - What's unclear: update on every kill (expensive), on page load (derived), or batch job?
   - Recommendation: Derive rank from leaderboard query position (client-side: `index + skip + 1`). Leave `kbRank` column nullable and unused in v1. Document as a future background job concern.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | vitest config in package.json (`"test": "vitest"`) |
| Quick run command | `pnpm --filter @killing-blow/server test --run` |
| Full suite command | `pnpm --filter @killing-blow/server test --run && pnpm --filter @killing-blow/client test --run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| KB-02 | boss:death payload includes winnerTitle and topContributors | unit | `pnpm --filter @killing-blow/server test --run gateway` | ❌ Wave 0 |
| KB-03 | killCount and kbBalance increment atomically on boss death | unit | `pnpm --filter @killing-blow/server test --run gateway` | ❌ Wave 0 |
| KB-03 | GET /leaderboard returns users sorted by killCount DESC | unit | `pnpm --filter @killing-blow/server test --run leaderboard` | ❌ Wave 0 |
| KB-05 | topContributors in boss:death payload contains top 5 by damage | unit | `pnpm --filter @killing-blow/server test --run gateway` | ❌ Wave 0 |
| UI-03 | POST /titles/:id/purchase deducts kbBalance and adds to ownedTitles | unit | `pnpm --filter @killing-blow/server test --run titles` | ❌ Wave 0 |
| UI-03 | PATCH /titles/:id/equip rejects title not in ownedTitles (403) | unit | `pnpm --filter @killing-blow/server test --run titles` | ❌ Wave 0 |
| UI-03 | GET /titles returns catalogue with purchased state for authenticated user | unit | `pnpm --filter @killing-blow/server test --run titles` | ❌ Wave 0 |
| UI-04 | spawnNextBoss sets lore in boss:meta Redis key | unit | `pnpm --filter @killing-blow/server test --run bossState` | ❌ (bossState.test.ts exists — add test case) |

### Sampling Rate

- **Per task commit:** `pnpm --filter @killing-blow/server test --run`
- **Per wave merge:** Full suite (server + client)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `packages/server/src/ws/gateway.test.ts` — extended boss:death payload tests (KB-02, KB-03, KB-05) — note: gateway.test.ts exists from Phase 2, add Phase 4 test cases
- [ ] `packages/server/src/routes/leaderboard.test.ts` — covers KB-03 leaderboard query
- [ ] `packages/server/src/routes/titles.test.ts` — covers UI-03 purchase, equip, list
- [ ] `packages/server/src/game/bossState.test.ts` — add test case for lore in boss:meta (UI-04) — file exists, add test

Prisma schema migration must run before any tests:
```bash
prisma migrate dev --name phase4-kb-currency-titles-lore
```

---

## Sources

### Primary (HIGH confidence)

- Existing codebase — `packages/server/src/ws/gateway.ts` — complete kill flow already implemented; Phase 4 extends payload and adds DB writes
- Existing codebase — `packages/server/prisma/schema.prisma` — User model has `killCount` and `kbRank` columns; needs `kbBalance` and `equippedTitle` additions
- Existing codebase — `packages/shared-types/src/events.ts` — `ServerToClientEvents`, `BossState`, `ActivePlayer` types — Phase 4 extends all three
- Existing codebase — `packages/client/src/lib/socket.ts` — `subscribeToGame` pattern is the canonical extension point
- Existing codebase — `packages/client/package.json` — `motion ^12.38.0` already installed; Zustand 5.0.12 already installed

### Secondary (MEDIUM confidence)

- Prisma docs — `update` with `{ increment: N }` maps to atomic SQL `SET col = col + N` — standard Prisma pattern for counters
- Socket.IO docs — `io.to(room).emit()` is the established room broadcast API; no changes needed for Phase 4

### Tertiary (LOW confidence — verify at implementation time)

- motion v12 API: `AnimatePresence` + `motion.div` pattern for mount/unmount animations — verify import path is `motion/react` not `framer-motion` (package is `motion` not `framer-motion`)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; entire stack already in package.json
- Architecture: HIGH — all patterns are direct extensions of existing code; no speculation
- Pitfalls: HIGH — all pitfalls are derived from Phase 2/3 documented decisions in STATE.md and from direct code inspection
- Validation: HIGH — test patterns are direct copies of existing test file structure

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable stack; no fast-moving dependencies)
