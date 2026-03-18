# Phase 2: Core Boss Loop - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

All players worldwide fight one shared boss simultaneously. The boss has a single HP bar that drains from collective player attacks in real-time. The server atomically determines which player lands the killing blow. When a boss dies, it respawns immediately with a new boss. Active players who dealt damage are shown in a sidebar.

Progression (gold, upgrades, offline auto-attack) is Phase 3. Kill announcements, KB Currency awards, and leaderboard are Phase 4. This phase establishes the real-time damage pipeline and server-authoritative kill detection that everything else builds on.

</domain>

<decisions>
## Implementation Decisions

### Attack Mechanic
- Manual click-per-attack: each button press fires one `attack:intent` WebSocket event
- No client-side rate limiting or cooldown — server receives and processes each intent
- No auto-attack in Phase 2; that system (offline auto-attack + active play multiplier) is Phase 3
- The attack button is the sole interaction in Phase 2

### Phase 2 Boss Combat Values (hardcoded — Phase 3 adds scaling)
- Boss #1 HP: **1,000** (solo testable; 40 clicks at base damage to kill)
- Base player damage per attack: **25** (hardcoded from server-stored stats, never from client)
- Last 1% eligibility threshold: **10 HP** (floor(1000 * 0.01))
- Boss number increments by 1 on each respawn; HP stays at 1,000 for all Phase 2 bosses (BOSS-04 scaling is Phase 3)

### Kill Claim Phase 2 Experience
- KB-01 in scope: server atomically determines winner via Lua kill-claim script
- KB-02 (prominent broadcast announcement) is Phase 4 — do not implement here
- `boss:death` event payload includes `{ bossId, winnerId, winnerUsername }`
- Client defeat overlay shows: **"Defeated by [username] — new boss spawning..."** instead of the generic copy
- No toast, no full-screen modal, no sound — minimal but verifiable that KB-01 works
- If no eligible winner exists (edge case: no attacker in last 1%), fallback copy: "Defeated — new boss spawning..."

### Active Player Sidebar — Who Qualifies
- "In the fight" = has dealt at least 1 point of damage to the **current** boss
- Tracked via `boss:{id}:damage` Redis hash (entry exists = in the fight)
- Players stay on the sidebar for the duration of the current boss fight, even if they disconnect mid-fight
- On boss respawn (new bossId), sidebar resets to empty — fresh list per boss
- Sorted by damage contribution descending (highest contributor at top)
- `player:list` event emitted by server after each attack to push updated list to all clients in `global-boss-room`

### Claude's Discretion
- Exact boss name strings (e.g., "Boss #1", "Boss #2" — planner may use server-generated names)
- Any server-side request throttle on `attack:intent` (e.g., drop events faster than 100ms from same socket)
- Redis key TTL values (24h from RESEARCH.md is fine)
- Error handling details beyond what UI-SPEC specifies

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Technical Architecture
- `.planning/phases/02-core-boss-loop/02-RESEARCH.md` — Full technical architecture: Lua kill-claim script, Redis key conventions, Socket.IO typed events, damage pipeline flow, recommended project structure extensions, Pattern 1–6

### UI Contract
- `.planning/phases/02-core-boss-loop/02-UI-SPEC.md` — Visual contract: component inventory (BossHpBar, BossSprite, DamageNumbers, PlayerSidebar, Game.tsx), animation specs, color/typography/spacing, copy, interaction states, accessibility

### Requirements
- `.planning/REQUIREMENTS.md` §Boss Loop (BOSS-01–03), §Killing Blow (KB-01, KB-04), §Social & UI (UI-01) — Requirement definitions and acceptance criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/client/src/stores/sessionStore.ts` — Zustand store pattern with `create<State & Actions>()`: use for `bossStore.ts` and `playerStore.ts`
- `packages/client/src/pages/Profile.tsx` — Card layout, `null` loading pattern (no spinner), `useSessionStore` auth guard: replicate in `Game.tsx`
- `packages/client/src/components/ui/` — button, card, input, label, separator already installed; add `progress` via shadcn CLI before implementation
- `packages/server/src/ws/gateway.ts` — JWT auth middleware already wired, sockets already in `global-boss-room`; extend with `attack:intent` handler
- `packages/server/src/plugins/redis.ts` — Redis client decorated on Fastify as `fastify.redis`; pass to `setupGateway(io, fastify.redis)` since gateway runs outside Fastify lifecycle

### Established Patterns
- Zustand stores own all client state; React components subscribe via selectors
- `formatNumber()` from shared-types on every game number before render
- Socket.IO typed events in `shared-types/src/events.ts` — extend `ServerToClientEvents` and `ClientToServerEvents` for all Phase 2 events
- Fastify plugins use `fastify-plugin fp()` wrapper for decorator sharing across scope
- Tests use `buildApp()` with mock Redis/Prisma; gateway tests use Socket.IO client + in-process server

### Integration Points
- `packages/server/src/server.ts` — register new `boss.ts` route plugin + pass `fastify.redis` to `setupGateway`
- `packages/client/src/App.tsx` — add `/game` route (authenticated, redirect to login if not)
- `packages/shared-types/src/events.ts` — add `boss:hp_update`, `boss:death`, `boss:spawn`, `boss:damage_dealt`, `attack:intent`, `player:list` event types

</code_context>

<specifics>
## Specific Ideas

- Boss #1 named "Boss #1", Boss #2 named "Boss #2" etc. — lore names come in Phase 4 (UI-04)
- The 1,000 HP / 25 damage / 10 HP threshold numbers are chosen for solo testability; they should appear verbatim in plan acceptance criteria so tests can verify the correct values are seeded
- `boss:death` payload must include `winnerUsername` (not just `winnerId`) so client can render the defeat overlay without a second lookup

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-core-boss-loop*
*Context gathered: 2026-03-18 (Claude's discretion — all four gray areas decided by Claude)*
