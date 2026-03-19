---
phase: 03-player-progression
plan: "03"
subsystem: ui
tags: [react, zustand, socket.io, tailwind, shadcn, progression, upgrades]

# Dependency graph
requires:
  - phase: 03-player-progression/03-01
    provides: shared-types events (player:gold_update, player:stats_update, player:offline_reward, player:heartbeat), upgrade cost/purchase API routes
  - phase: 03-player-progression/03-02
    provides: server gold/upgrade/heartbeat/offline-reward/dynamic-boss-hp logic, POST /upgrades/:stat, GET /upgrades/costs endpoints
provides:
  - Zustand progressionStore with goldBalance, upgrade levels, isTabActive, offlineReward state
  - UpgradePanel component with yellow-400 28px gold display and ATK/CRIT/SPD upgrade rows
  - OfflineRewardToast component with 8s auto-dismiss and aria-live accessibility
  - Game.tsx heartbeat useEffect (player:heartbeat every 5s via visibilitychange + setInterval)
  - Socket.ts wired for player:gold_update, player:stats_update, player:offline_reward events
  - Responsive 3-column layout: Boss | UpgradePanel | PlayerSidebar with flex-wrap lg:flex-nowrap
affects:
  - phase-04 (any future UI phase — progression store established as client state layer)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Import Decimal via @killing-blow/shared-types — never directly from break_eternity.js in client package
    - Zustand getState() pattern for socket callback updates (no hook subscription needed in non-component context)
    - Optimistic UI: fetch costs on mount + after each upgrade, sync state from server response
    - useCallback for fetchCosts to stabilize useEffect dependency array

key-files:
  created:
    - packages/client/src/stores/progressionStore.ts
    - packages/client/src/components/UpgradePanel.tsx
    - packages/client/src/components/OfflineRewardToast.tsx
  modified:
    - packages/client/src/lib/socket.ts
    - packages/client/src/pages/Game.tsx

key-decisions:
  - "Import Decimal via @killing-blow/shared-types in client packages — break_eternity.js is not a direct client dependency and Rolldown cannot resolve it as an external module"
  - "UpgradePanel fetches GET /upgrades/costs on mount and after each purchase to sync server-authoritative state — avoids stale cost display"
  - "hasNoProgress guard shows empty-state copy until player has earned gold or purchased upgrades — prevents confusing empty upgrade rows on first visit"
  - "Heartbeat useEffect separated from socket lifecycle useEffect for clean separation of concerns"

patterns-established:
  - "Pattern 1: progressionStore.getState().setStats() used inside socket callbacks for non-reactive state updates"
  - "Pattern 2: Wrap outer Game.tsx return in Fragment to allow sibling fixed-position toast outside flex layout"

requirements-completed: [PROG-01, PROG-02, PROG-03, PROG-04]

# Metrics
duration: 3min
completed: 2026-03-19
---

# Phase 3 Plan 03: Client Progression UI Summary

**Zustand progressionStore + UpgradePanel (28px yellow-400 gold, ATK/CRIT/SPD rows) + OfflineRewardToast + Game.tsx heartbeat wired to socket events for real-time gold and upgrade progression**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-19T10:05:25Z
- **Completed:** 2026-03-19T10:08:18Z
- **Tasks:** 1 of 2 (paused at checkpoint:human-verify)
- **Files modified:** 5

## Accomplishments
- Created `progressionStore.ts` — Zustand store managing goldBalance, atkLevel, critLevel, spdLevel, isTabActive, and offlineReward with setStats/addGold/setGoldBalance/dismissOfflineReward actions
- Extended `socket.ts` — Added player:gold_update, player:stats_update, player:offline_reward listeners in subscribeToGame/unsubscribeFromGame
- Created `UpgradePanel.tsx` — Full shadcn Card with 28px semibold yellow-400 gold display, active-bonus badge, ATK/CRIT/SPD upgrade rows with affordability logic, error auto-dismiss
- Created `OfflineRewardToast.tsx` — Fixed-position toast with role=status, aria-live=polite, 8s auto-dismiss, early-dismiss on click
- Extended `Game.tsx` — Added UpgradePanel and OfflineRewardToast, heartbeat useEffect (5s interval + visibilitychange), isTabActive store tracking, flex-wrap lg:flex-nowrap responsive layout

## Task Commits

Each task was committed atomically:

1. **Task 1: Progression store, socket wiring, UpgradePanel, OfflineRewardToast, and Game.tsx integration** - `cb26c7c` (feat)

## Files Created/Modified
- `packages/client/src/stores/progressionStore.ts` - Zustand store for all client progression state
- `packages/client/src/components/UpgradePanel.tsx` - Gold display + upgrade rows card component
- `packages/client/src/components/OfflineRewardToast.tsx` - Auto-dismissing offline reward notification
- `packages/client/src/lib/socket.ts` - Extended with progression socket event handlers
- `packages/client/src/pages/Game.tsx` - Integrated UpgradePanel, toast, heartbeat, responsive layout

## Decisions Made
- Import Decimal via `@killing-blow/shared-types` in the client — `break_eternity.js` is not listed in `packages/client/package.json` dependencies and Rolldown cannot resolve it as an external; shared-types already re-exports the Decimal class
- UpgradePanel fetches `GET /upgrades/costs` on mount and after each purchase to stay in sync with server-authoritative levels and costs
- Heartbeat useEffect separated from socket lifecycle useEffect for cleaner responsibility separation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed Decimal import to use @killing-blow/shared-types**
- **Found during:** Task 1 (progressionStore.ts creation)
- **Issue:** Plan's code sample used `import Decimal from 'break_eternity.js'` directly, but `break_eternity.js` is not in the client package's `package.json` dependencies — Rolldown/Vite reported it as unresolvable and failed the build
- **Fix:** Changed import to `import { Decimal } from '@killing-blow/shared-types'` which re-exports the same Decimal class and is already a client dependency
- **Files modified:** `packages/client/src/stores/progressionStore.ts`
- **Verification:** `pnpm --filter @killing-blow/client build` exits 0 after fix
- **Committed in:** `cb26c7c` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking import)
**Impact on plan:** Required for build to succeed; no behavior change, same Decimal class through shared-types re-export.

## Issues Encountered
- Build failed initially because `break_eternity.js` cannot be imported directly in client — resolved automatically per Rule 3

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Task 2 (checkpoint:human-verify) awaits visual/functional verification by user
- Once approved: Phase 3 is complete and Phase 4 can begin
- Server tests should still pass (no server changes in this plan)

---
*Phase: 03-player-progression*
*Completed: 2026-03-19*
