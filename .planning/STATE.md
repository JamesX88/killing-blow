---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 05-ui-overhaul-mobile-game-feel-01-PLAN.md
last_updated: "2026-03-19T19:05:32.471Z"
last_activity: 2026-03-19 — Plan 03-02 complete; server logic for gold/upgrades/heartbeat/offline/dynamic-boss-hp
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 18
  completed_plans: 15
  percent: 22
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-18)

**Core value:** Every player is always in the same fight — the tension of watching a boss's HP drain in real-time, knowing anyone could land the killing blow, is what makes this different from every other idle game.
**Current focus:** Phase 3 — Player Progression

## Current Position

Phase: 3 of 4 (Player Progression)
Plan: 2 of 3 in current phase
Status: In progress
Last activity: 2026-03-19 — Plan 03-02 complete; server logic for gold/upgrades/heartbeat/offline/dynamic-boss-hp

Progress: [██░░░░░░░░] 22%

## Performance Metrics

**Velocity:**
- Total plans completed: 1
- Average duration: 7 min
- Total execution time: 0.1 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| Phase 1 | 1 | 7 min | 7 min |

**Recent Trend:**
- Last 5 plans: 01-01 (7 min)
- Trend: -

*Updated after each plan completion*
| Phase 01-foundation P02 | 5 | 2 tasks | 10 files |
| Phase 01-foundation P03 | 6 | 2 tasks | 17 files |
| Phase 01-foundation P04 | 3 | 2 tasks | 6 files |
| Phase 01-foundation P05 | 12 | 2 tasks | 7 files |
| Phase 02-core-boss-loop P01 | 6 | 2 tasks | 7 files |
| Phase 02-core-boss-loop P03 | 4 | 2 tasks | 10 files |
| Phase 02-core-boss-loop P02 | 9 | 2 tasks | 8 files |
| Phase 03-player-progression P01 | 7 | 1 tasks | 7 files |
| Phase 03-player-progression P02 | 14 | 2 tasks | 7 files |
| Phase 03-player-progression P03 | 3 | 1 tasks | 5 files |
| Phase 04-competition-and-social P01 | 6 | 2 tasks | 9 files |
| Phase 04-competition-and-social P02 | 9 | 2 tasks | 7 files |
| Phase 04-competition-and-social P03 | 11 | 2 tasks | 10 files |
| Phase 04-competition-and-social P03 | 15 | 3 tasks | 1 files |
| Phase 05-ui-overhaul-mobile-game-feel P01 | 2 | 2 tasks | 4 files |

## Accumulated Context

### Roadmap Evolution

- Phase 5 added: UI Overhaul — Mobile Game Feel

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Pre-Phase 1]: Server-authoritative damage pipeline is mandatory before any leaderboard data is written — client sends attack intent only, never damage values
- [Pre-Phase 1]: Redis required from day one for atomic boss HP (DECRBY + Lua kill-claim); retrofitting after deploy is high-cost
- [Pre-Phase 1]: break_infinity.js or break_eternity.js must be adopted before any progression math is written
- [01-01]: Prisma 7 requires prisma.config.ts for datasource URL — url property removed from schema.prisma datasource block
- [01-01]: pnpm onlyBuiltDependencies in root package.json to allow argon2, esbuild, @prisma/engines native build scripts
- [01-01]: break_eternity.js adopted as canonical Decimal type — all game numbers must flow through formatNumber
- [Phase 01-02]: argon2.verify() wrapped in try-catch to treat malformed hash errors as invalid credentials (not 500)
- [Phase 01-02]: Register-then-login test pattern: capture real argon2id hash via mockImplementation for full round-trip test
- [Phase 01-02]: fastify-plugin fp() required for cookie+JWT plugins to share authenticate decorator across route scope
- [Phase 01-foundation]: shadcn v4 uses base-nova style with @base-ui/react primitives and oklch colors — HSL red-600 accent applied on top via --primary: 0 72% 51% in .dark block
- [Phase 01-foundation]: Tailwind v4 configured via @import 'tailwindcss' in index.css + @tailwindcss/vite plugin — no tailwind.config.ts file
- [Phase 01-04]: Conditional OAuth registration: wrap each provider in if(CLIENT_ID && CLIENT_SECRET) so buildApp() works in tests without real OAuth credentials
- [Phase 01-04]: OAuth callback uses find-then-update-or-create over prisma.upsert to allow including user relation in findUnique query
- [Phase 01-05]: Gateway uses manual jwt.verify() + cookie.parse() instead of fastify.authenticate — Socket.IO middleware runs outside Fastify request lifecycle
- [Phase 01-05]: Redis plugin registered in server.ts (not buildApp) to preserve test isolation — buildApp() stays database-agnostic for inject() tests
- [Phase 02-core-boss-loop]: BASE_DAMAGE=25 and BOSS_MAX_HP=1000 hardcoded as Phase 2 constants; getBaseDamage() function provides Phase 3 replacement interface
- [Phase 02-core-boss-loop]: killClaim.lua uses SETNX for atomic single-winner kill claim; exactly one caller gets the kill when concurrent attacks reduce HP to 0
- [Phase 02-core-boss-loop]: Username stored in boss:{id}:usernames Redis hash at attack time to avoid DB lookup in getActivePlayers
- [Phase 02-core-boss-loop]: shadcn progress uses @base-ui/react ProgressTrack/ProgressIndicator sub-components — BossHpBar uses these directly rather than CSS selector approach
- [Phase 02-core-boss-loop]: DamageNumbers subscribes directly to socket (not via subscribeToGame) to manage local animation state without polluting global store
- [Phase Phase 02-02]: ReturnType<typeof createClient> replaces RedisClientType everywhere — bare RedisClientType incompatible with full generic returned by createClient()
- [Phase Phase 02-02]: boss:damage_dealt emitted via socket.emit() not io.to() — attacker-only delivery confirmed by integration test
- [Phase 03-player-progression]: break_eternity.js uses default export for Decimal — import Decimal from 'break_eternity.js' not named import
- [Phase 03-player-progression]: break_eternity.js added as direct dependency to server package (was only in shared-types)
- [Phase 03-02]: Socket event handlers must be registered synchronously before any awaits in io.on('connection') — Socket.io drops events for unregistered handlers
- [Phase 03-02]: creditGold mocked at module level in gateway tests — avoids $transaction mock complexity that caused cross-test isolation failures
- [Phase 03-player-progression]: Import Decimal via @killing-blow/shared-types in client packages — break_eternity.js is not a direct client dependency and Rolldown cannot resolve it
- [Phase 03-03]: UpgradePanel fetches GET /upgrades/costs on mount and after each purchase to stay in sync with server-authoritative state
- [Phase 04-competition-and-social]: BOSS_LORE cycled with modulo — getBossLore(bossNumber % 10) gives repeating named bosses across unlimited boss count
- [Phase 04-competition-and-social]: ownedTitles stored as JSON string (String @default('[]')) on User — avoids Prisma scalar list limitations on PostgreSQL without array extension
- [Phase 04-competition-and-social]: equippedTitle stored in boss:{bossId}:titles Redis hash at attack time — no DB lookup in getActivePlayers hot path
- [Phase 04-competition-and-social]: topContributors reads from Redis hashes at kill time — authoritative for current fight, no DB query needed
- [Phase 04-competition-and-social]: prisma.user.update with increment:1 for both killCount and kbBalance in single atomic DB call on boss kill
- [Phase 04-competition-and-social]: equippedTitle stored in boss:{bossId}:titles Redis hash at attack time via prisma.user.findUnique select
- [Phase 04-competition-and-social]: PostFightScreen embedded as a section within KillingBlowAnnouncement — single overlay, not two stacked overlays
- [Phase 04-competition-and-social]: tsconfig.json types: ['vite/client'] added to fix pre-existing import.meta.env TypeScript error in client package
- [Phase 04-competition-and-social]: Vite proxy config must include all REST API paths (/leaderboard, /titles) — omissions cause silent fetch failures that return HTML instead of JSON
- [Phase 05-ui-overhaul-mobile-game-feel]: All Phase 5 keyframe animations wrapped in prefers-reduced-motion: no-preference guard — motion-sensitive users see no animations from screen-shake, kill-flash, hp-pulse, or boss-flash
- [Phase 05-ui-overhaul-mobile-game-feel]: App.tsx root wrapper bg-zinc-950 removed — game route controls its own background via DungeonBackground component; non-game routes inherit bg-background from body CSS in index.css

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 3 flag]: Boss HP scaling formula for aggregate player DPS has no direct source — needs empirical tuning or /gsd:research-phase before Phase 3 planning
- [Phase 3 flag]: Killing blow last-hit window percentage (currently "final 1%") requires balance playtesting to confirm

## Session Continuity

Last session: 2026-03-19T19:05:32.469Z
Stopped at: Completed 05-ui-overhaul-mobile-game-feel-01-PLAN.md
Resume file: None
