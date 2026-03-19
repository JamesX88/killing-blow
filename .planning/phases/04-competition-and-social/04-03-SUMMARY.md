---
phase: 04-competition-and-social
plan: 03
subsystem: ui
tags: [react, zustand, motion, framer-motion, tailwind, socket-io, typescript]

# Dependency graph
requires:
  - phase: 04-competition-and-social-02
    provides: "Server REST endpoints for leaderboard, title shop, and KB Currency; boss:death socket event with enriched payload (winnerId, winnerTitle, winnerKillCount, topContributors)"
provides:
  - "KillingBlowAnnouncement overlay with AnimatePresence motion animation and embedded top-5 contributors"
  - "Leaderboard page at /leaderboard with pagination, current-user highlight, and rank-1 gold accent"
  - "TitleShop panel with purchase/equip/unequip flows and KB balance display"
  - "Boss lore text displayed below boss name during fight"
  - "Player title badges displayed next to usernames in PlayerSidebar"
  - "announcementStore Zustand store wired to boss:death and boss:spawn socket events"
affects: [visual-verification, deployment]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AnimatePresence overlay pattern: motion.div with scale+fade in/out, fixed inset-0 z-50, Zustand-driven visibility"
    - "Embedded post-fight screen within announcement overlay (single overlay, not two stacked)"
    - "fetch-on-mount pattern for read-once data (leaderboard, titles) — no real-time updates"
    - "Rank derived from (page-1)*limit+i+1, not stored column"

key-files:
  created:
    - packages/client/src/stores/announcementStore.ts
    - packages/client/src/components/KillingBlowAnnouncement.tsx
    - packages/client/src/components/Leaderboard.tsx
    - packages/client/src/components/TitleShop.tsx
  modified:
    - packages/client/src/lib/socket.ts
    - packages/client/src/stores/bossStore.ts
    - packages/client/src/components/PlayerSidebar.tsx
    - packages/client/src/pages/Game.tsx
    - packages/client/src/App.tsx
    - packages/client/tsconfig.json

key-decisions:
  - "PostFightScreen embedded as a section within KillingBlowAnnouncement (single overlay per UI-SPEC — not two stacked overlays)"
  - "KillingBlowAnnouncement dismisses on boss:spawn socket event — no manual close, auto-dismissed by game lifecycle"
  - "Winner name rendered in text-primary (red-600 accent) per UI-SPEC color contract"
  - "Leaderboard fetches on mount only — no real-time updates (explicit from RESEARCH.md)"
  - "tsconfig.json types: ['vite/client'] added to fix pre-existing import.meta.env TypeScript error"

patterns-established:
  - "Overlay components follow OfflineRewardToast pattern: fixed inset-0 z-50, Zustand visibility, role=dialog aria-modal"
  - "Title badges rendered as inline span with text-muted-foreground, no background — [TitleLabel] format"

requirements-completed: [KB-02, KB-03, KB-05, UI-03, UI-04]

# Metrics
duration: 11min
completed: 2026-03-19
---

# Phase 4 Plan 03: Client UI for Killing Blow Competition Summary

**Killing blow announcement overlay with motion animation, leaderboard page, title shop panel, boss lore display, and player title badges — all Phase 4 client-side features wired to socket events and REST endpoints**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-19T13:49:00Z
- **Completed:** 2026-03-19T14:00:19Z
- **Tasks:** 2 of 2 auto tasks complete (Task 3 is checkpoint:human-verify)
- **Files modified:** 10

## Accomplishments

- Killing blow announcement overlay appears full-screen on boss:death with winner name (red accent), title badge, kill count, and top-5 contributors list with damage values; dismisses automatically on boss:spawn
- Leaderboard page at /leaderboard with paginated table, current-user row highlight (bg-primary/10), rank-1 gold (text-yellow-400), and empty state
- TitleShop panel with KB balance display (28px), purchase/equip/unequip flows, and error handling wired to /titles REST endpoints
- Boss lore text displayed below boss name at 14px muted-foreground during fight
- Player title badges [TitleLabel] displayed next to usernames in PlayerSidebar

## Task Commits

Each task was committed atomically:

1. **Task 1: Announcement store, socket wiring, KillingBlowAnnouncement overlay, boss lore + sidebar titles** - `37c8ac5` (feat)
2. **Task 2: Leaderboard page, TitleShop panel, and App.tsx routing** - `81fc9e0` (feat)
3. **Task 3 fix: Add /leaderboard and /titles to Vite proxy config** - `0959303` (fix)

- `packages/client/vite.config.ts` — Added proxy entries for /leaderboard and /titles routes

## Files Created/Modified

- `packages/client/src/stores/announcementStore.ts` — Zustand store with setAnnouncement/clearAnnouncement, holds winner info and topContributors
- `packages/client/src/components/KillingBlowAnnouncement.tsx` — Full-screen overlay with AnimatePresence, embedded post-fight contributors section
- `packages/client/src/components/Leaderboard.tsx` — Paginated leaderboard table, fetches /leaderboard on mount, current-user and rank-1 highlights
- `packages/client/src/components/TitleShop.tsx` — Title purchase/equip/unequip panel with KB balance display
- `packages/client/src/lib/socket.ts` — Updated boss:death to setAnnouncement with enriched payload; boss:spawn calls clearAnnouncement
- `packages/client/src/stores/bossStore.ts` — Added `lore: ''` to initial state
- `packages/client/src/components/PlayerSidebar.tsx` — Added equippedTitle badge inline next to username
- `packages/client/src/pages/Game.tsx` — Added lore display, KillingBlowAnnouncement, TitleShop, and leaderboard nav link
- `packages/client/src/App.tsx` — Added /leaderboard route wrapped in RequireAuth
- `packages/client/tsconfig.json` — Added `types: ["vite/client"]` to fix pre-existing import.meta.env TypeScript error

## Decisions Made

- PostFightScreen (KB-05) embedded as a section within KillingBlowAnnouncement per UI-SPEC — single overlay, not two stacked overlays
- Winner name color uses `text-primary` (red-600) as specified in the UI-SPEC color contract for the announcement
- Leaderboard fetches only on mount (no WebSocket updates) — explicit requirement from RESEARCH.md
- TitleShop unequip uses PATCH /titles/none/equip endpoint (special sentinel value per server API contract)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing import.meta.env TypeScript error in socket.ts**
- **Found during:** Task 1 (TypeScript verification)
- **Issue:** `tsconfig.json` was missing `types: ["vite/client"]` causing `Property 'env' does not exist on type 'ImportMeta'` — prevented TypeScript from compiling cleanly (a plan acceptance criterion)
- **Fix:** Added `"types": ["vite/client"]` to `compilerOptions` in `packages/client/tsconfig.json`
- **Files modified:** `packages/client/tsconfig.json`
- **Verification:** `npx tsc --noEmit` exits 0 after fix
- **Committed in:** `37c8ac5` (Task 1 commit)

---

**2. [Rule 3 - Blocking] Missing Vite proxy entries for /leaderboard and /titles**
- **Found during:** Task 3 checkpoint verification (user-reported bugs)
- **Issue:** `vite.config.ts` proxy only listed `/api`, `/auth`, `/boss`, `/upgrades`, and `/profile` — both Phase 4 REST endpoints were missing, causing all fetches from the client to hit Vite's own dev server (404/HTML response). Leaderboard showed error; TitleShop showed 0 KB balance and empty title list.
- **Fix:** Added `'/leaderboard': 'http://localhost:3000'` and `'/titles': 'http://localhost:3000'` to the proxy object in `vite.config.ts`
- **Files modified:** `packages/client/vite.config.ts`
- **Verification:** TypeScript compiles cleanly; proxy entries now route requests to the backend server
- **Committed in:** `0959303`

---

**Total deviations:** 2 auto-fixed (1 Rule 1 pre-existing TypeScript bug, 1 Rule 3 missing proxy blocking all Phase 4 REST calls)
**Impact on plan:** Both fixes required for correct operation. No scope creep.

## Issues Encountered

- `git stash` during pre-existing test verification caused a merge conflict in Game.tsx on `stash pop` — resolved by rewriting the correct file content. No work was lost; the committed code in the repository was already correct.

## Pre-Existing Server Test Failures (not caused by this plan)

Two server test failures were observed but are pre-existing (confirmed by verifying they exist on the commit prior to 04-03). Documented in `deferred-items.md`:

1. `playerStats.test.ts` Test 14 — `computeOfflineGold` missing 60-second minimum threshold
2. `gateway.test.ts` Test 4 — `prisma.boss.upsert` not mocked in Boss loop events describe block

## User Setup Required

None — no external service configuration required. Dev servers must be started for visual verification (Task 3 checkpoint):
- Terminal 1: `pnpm --filter @killing-blow/server dev`
- Terminal 2: `pnpm --filter @killing-blow/client dev`

## Next Phase Readiness

- All Phase 4 client UI is complete and wired to server APIs and socket events
- Vite proxy config correctly routes all REST endpoints (/leaderboard, /titles) to the backend
- TypeScript compiles cleanly across all packages
- Visual verification confirmed: announcement overlay works, leaderboard loads, title shop shows KB balance and all 5 titles
- Phase 4 is complete

## Self-Check: PASSED

- announcementStore.ts: FOUND
- KillingBlowAnnouncement.tsx: FOUND
- Leaderboard.tsx: FOUND
- TitleShop.tsx: FOUND
- vite.config.ts proxy /leaderboard entry: FOUND
- vite.config.ts proxy /titles entry: FOUND
- 04-03-SUMMARY.md: FOUND
- Commit 37c8ac5: FOUND
- Commit 81fc9e0: FOUND
- Commit 0959303: FOUND
- TypeScript (tsc --noEmit): CLEAN
- All Task 1 acceptance criteria: PASS
- All Task 2 acceptance criteria: PASS
- Leaderboard proxy fix: APPLIED
- TitleShop proxy fix: APPLIED

---
*Phase: 04-competition-and-social*
*Completed: 2026-03-19*
