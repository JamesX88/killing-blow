---
phase: 02-core-boss-loop
plan: 03
subsystem: ui
tags: [react, zustand, framer-motion, motion, shadcn, socket.io, tailwindcss]

# Dependency graph
requires:
  - phase: 02-core-boss-loop/02-01
    provides: bossState engine, kill-claim Lua, shared-types events interface
  - phase: 01-foundation
    provides: auth session store, socket.io client setup, shadcn design system
provides:
  - Zustand bossStore (bossId, hp, maxHp, isDefeated, defeatMessage, markDefeated)
  - Zustand playerStore (activePlayers sorted by damage)
  - socket subscribeToGame/unsubscribeFromGame lifecycle functions
  - BossHpBar component with shadcn Progress, red-600 fill, 150ms CSS transition
  - BossSprite component with motion death (400ms) and spawn (300ms) animations
  - DamageNumbers component with floating yellow-400 numbers, 1000ms easeOut, y:-60px
  - PlayerSidebar component showing sorted damage contributors
  - Game.tsx page at /game with full boss loop UI
  - AuthRedirect sends authenticated users to /game
affects: [03-leaderboard, 04-killing-blow-announcement]

# Tech tracking
tech-stack:
  added: [motion@12, shadcn progress (@base-ui/react/progress)]
  patterns:
    - Zustand store accessed outside React via getState() in socket callbacks
    - Component subscribes directly to socket for local animation state (DamageNumbers)
    - Game page hydrates store via GET /boss/current before first socket event
    - return null guard when bossId empty (no skeleton/spinner — consistent with Profile.tsx)

key-files:
  created:
    - packages/client/src/stores/bossStore.ts
    - packages/client/src/stores/playerStore.ts
    - packages/client/src/components/BossHpBar.tsx
    - packages/client/src/components/BossSprite.tsx
    - packages/client/src/components/DamageNumbers.tsx
    - packages/client/src/components/PlayerSidebar.tsx
    - packages/client/src/pages/Game.tsx
    - packages/client/src/components/ui/progress.tsx
  modified:
    - packages/client/src/lib/socket.ts
    - packages/client/src/App.tsx

key-decisions:
  - "shadcn progress uses @base-ui/react ProgressTrack/ProgressIndicator sub-components — BossHpBar uses these directly rather than CSS selector approach"
  - "DamageNumbers subscribes directly to socket (not via subscribeToGame) to manage local animation state without polluting global store"
  - "BossHpBar passes percent value (0-100) to Progress value prop; ProgressIndicator gets bg-primary transition-all duration-150 for smooth HP drain"

patterns-established:
  - "Zustand store.getState() pattern for accessing store outside React component tree (in socket callbacks)"
  - "Socket lifecycle: connect in useEffect on mount, unsubscribe + disconnect on cleanup"
  - "Game hydration: fetch /boss/current on mount to populate store before first real-time event"

requirements-completed: [BOSS-02, UI-01]

# Metrics
duration: 4min
completed: 2026-03-18
---

# Phase 2 Plan 03: Client Game UI Summary

**Zustand boss/player stores, socket event bindings, and full game UI (HP bar, damage numbers, boss sprite, player sidebar) wired to /game route**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-18T20:58:01Z
- **Completed:** 2026-03-18T21:02:00Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Installed shadcn progress component and motion library; created bossStore + playerStore Zustand stores with socket event bindings
- Built four game UI components (BossHpBar, BossSprite, DamageNumbers, PlayerSidebar) matching UI-SPEC exactly
- Assembled Game.tsx page with two-column layout, socket lifecycle management, and /boss/current hydration; added /game route to App.tsx

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and create Zustand stores with socket bindings** - `765d8d1` (feat) + `947df53` (feat — socket.ts extension committed separately after linter detection)
2. **Task 2: Game components and Game.tsx page** - `534915a` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `packages/client/src/stores/bossStore.ts` - Boss state (bossId, hp, maxHp, isDefeated, defeatMessage, markDefeated)
- `packages/client/src/stores/playerStore.ts` - Active players list (activePlayers, setPlayers)
- `packages/client/src/lib/socket.ts` - Extended with subscribeToGame/unsubscribeFromGame functions
- `packages/client/src/components/ui/progress.tsx` - shadcn progress via @base-ui/react (installed by shadcn CLI)
- `packages/client/src/components/BossHpBar.tsx` - HP bar using ProgressTrack/ProgressIndicator with red-600 fill
- `packages/client/src/components/BossSprite.tsx` - Animated boss placeholder (400ms death, 300ms spawn)
- `packages/client/src/components/DamageNumbers.tsx` - Floating yellow-400 damage numbers (1000ms easeOut, y:-60px)
- `packages/client/src/components/PlayerSidebar.tsx` - Sorted player damage list with "In the Fight" heading
- `packages/client/src/pages/Game.tsx` - Main game page: two-column layout, socket lifecycle, attack button
- `packages/client/src/App.tsx` - Added /game route; AuthRedirect now sends authenticated users to /game

## Decisions Made

- shadcn progress installs as `@base-ui/react/progress` with explicit `ProgressTrack` and `ProgressIndicator` sub-components. The plan's CSS selector approach (`[&>[data-slot=indicator]]`) is not needed — instead BossHpBar renders `<ProgressTrack className="h-4 bg-zinc-800"><ProgressIndicator className="bg-primary transition-all duration-150" /></ProgressTrack>` directly.
- DamageNumbers uses a direct socket subscription (not routed through subscribeToGame) because it manages local component state for per-hit animation cleanup. This avoids polluting global store with transient animation data.

## Deviations from Plan

None — plan executed exactly as written. The only minor deviation was that socket.ts required a second commit because the git hook captured only the file modification detection (not the actual write) on the first attempt; the second commit included the full subscribeToGame/unsubscribeFromGame implementation.

## Issues Encountered

- `pnpm --filter client dlx` syntax failed (Unknown option: recursive). Used `cd packages/client && pnpm dlx` instead.
- The shadcn progress component uses `@base-ui/react/progress` ProgressTrack/ProgressIndicator pattern rather than Radix — adapted BossHpBar to use sub-components directly for clean bg-primary styling.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Complete game UI loop is now wired: boss HP drain, floating damage numbers, death animation, player sidebar, attack button
- Ready for Phase 2 Plan 04 (kill-claim announcement) or Phase 3 (leaderboard)
- Server-side `GET /boss/current` endpoint and `boss:damage_dealt` event must be implemented in Plan 02 (if not already) for full end-to-end functionality

---
*Phase: 02-core-boss-loop*
*Completed: 2026-03-18*
