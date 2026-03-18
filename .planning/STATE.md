---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 02-core-boss-loop 02-01-PLAN.md
last_updated: "2026-03-18T20:55:38.113Z"
last_activity: 2026-03-18 — Plan 01-01 complete; monorepo scaffold + formatNumber utility
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 9
  completed_plans: 6
  percent: 20
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-18)

**Core value:** Every player is always in the same fight — the tension of watching a boss's HP drain in real-time, knowing anyone could land the killing blow, is what makes this different from every other idle game.
**Current focus:** Phase 1 — Foundation

## Current Position

Phase: 1 of 4 (Foundation)
Plan: 1 of 5 in current phase
Status: In progress
Last activity: 2026-03-18 — Plan 01-01 complete; monorepo scaffold + formatNumber utility

Progress: [██░░░░░░░░] 20%

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

## Accumulated Context

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

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 3 flag]: Boss HP scaling formula for aggregate player DPS has no direct source — needs empirical tuning or /gsd:research-phase before Phase 3 planning
- [Phase 3 flag]: Killing blow last-hit window percentage (currently "final 1%") requires balance playtesting to confirm

## Session Continuity

Last session: 2026-03-18T20:55:38.112Z
Stopped at: Completed 02-core-boss-loop 02-01-PLAN.md
Resume file: None
