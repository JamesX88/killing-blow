---
phase: 05-ui-overhaul-mobile-game-feel
plan: 03
subsystem: ui
tags: [react, tailwind, motion, game-layout, mobile-drawer, viewport, socket, animations]

# Dependency graph
requires:
  - phase: 05-01
    provides: DungeonBackground component, KillFlashOverlay component, CSS keyframes and glow tokens in index.css
  - phase: 05-02
    provides: BossSprite SVG silhouettes with animations, BossHpBar with glow, DamageNumbers with x-jitter, dark glass panel treatment on PlayerSidebar/UpgradePanel/TitleShop/KillingBlowAnnouncement/Leaderboard
provides:
  - Full-viewport h-dvh game layout with no page scroll
  - DungeonBackground wired at z-0 behind all game content
  - KillFlashOverlay at z-40, triggered by boss:death socket event with 600ms auto-reset
  - Screen shake on contentRef (z-10 content layer, not root) with prefersReducedMotion guard
  - Mobile bottom tab bar (lg:hidden) with 60vh slide-up AnimatePresence drawer for Upgrades/Titles
  - Desktop right sidebar (hidden lg:flex) with UpgradePanel, TitleShop, PlayerSidebar stacked
  - Trophy icon leaderboard nav button at top-right (dark glass style)
  - Summoning... atmospheric loading state over DungeonBackground
  - Attack button: 64px min-height, text "Attack", font-bold, active:scale-95
  - font-semibold fully eliminated from Game.tsx and all Phase 5 components
affects: [phase-06-future, any-new-game-ui-components]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Kill flash trigger from socket event directly, NOT from zustand isDefeated — avoids stale state race condition on remount"
    - "Screen shake applied to content layer ref (z-10), not game root — prevents overflow clipping edge flash"
    - "Mobile drawer state lives in Game.tsx as drawerTab: 'upgrades' | 'titles' | null — toggled by persistent tab bar"
    - "Multiple socket.on('boss:death') listeners safe in Socket.IO — store update in subscribeToGame, visual effects in Game.tsx"
    - "h-dvh over h-screen — 100dvh handles mobile address bar collapse correctly"

key-files:
  created: []
  modified:
    - packages/client/src/pages/Game.tsx

key-decisions:
  - "Kill flash triggered from boss:death socket event, not zustand isDefeated — prevents race condition on remount"
  - "Screen shake applied to contentRef (content layer) not game root — prevents overflow clipping during transform"

patterns-established:
  - "Full-viewport game layout: relative h-dvh overflow-hidden root, DungeonBackground at z-0, content at z-10, overlays at z-20/40/50"
  - "Mobile-first layout: pb-20 on boss zone for tab bar clearance, lg:pb-4 on desktop"

requirements-completed: [UX-01, UX-06, UX-07, UX-09]

# Metrics
duration: 2min
completed: 2026-03-19
---

# Phase 05 Plan 03: Game.tsx Full-Viewport Dungeon Layout Summary

**Full rewrite of Game.tsx from flat scrollable grid to h-dvh viewport-locked layered dungeon composition with mobile drawer, kill flash, screen shake, and trophy leaderboard nav**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-19T19:10:56Z
- **Completed:** 2026-03-19T19:12:56Z
- **Tasks:** 1 of 2 (Task 2 is human-verify checkpoint — awaiting human approval)
- **Files modified:** 1

## Accomplishments
- Rewrote Game.tsx from `min-h-screen flex flex-wrap gap-8 p-8` to `relative h-dvh overflow-hidden` full-viewport architecture
- Wired DungeonBackground (z-0), KillFlashOverlay (z-40), mobile drawer (z-20), and screen shake into the layout
- Kill flash and screen shake triggered directly from `boss:death` socket event with `prefersReducedMotion` guard
- Mobile: persistent bottom tab bar with 60vh AnimatePresence slide-up drawer for Upgrades/Titles
- Desktop: right sidebar (`hidden lg:flex`) with UpgradePanel/TitleShop/PlayerSidebar stacked
- Replaced text leaderboard link with Trophy icon button (dark glass, top-right)
- Replaced `return null` loading with "Summoning..." text over DungeonBackground
- Eliminated all `font-semibold` across Game.tsx and all Phase 5 component files

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite Game.tsx to full-viewport layered layout with effects and mobile drawer** - `4ca1d65` (feat)

**Plan metadata:** pending (after human-verify checkpoint)

## Files Created/Modified
- `packages/client/src/pages/Game.tsx` - Full rewrite: h-dvh viewport lock, DungeonBackground layer, KillFlashOverlay, mobile drawer, desktop sidebar, trophy nav, Summoning... loading state

## Decisions Made
- Kill flash and screen shake triggered from `boss:death` socket event directly (not zustand `isDefeated`), per RESEARCH.md Pitfall 4 guidance — avoids stale state race condition on component remount
- Screen shake applied to `contentRef.current` (content layer at z-10), not the game root div — per RESEARCH.md Pitfall 3 guidance — prevents transform from moving overflow clipping boundary

## Deviations from Plan

None — plan executed exactly as written. The Game.tsx rewrite followed the plan's action spec verbatim.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 5 Plan 03 Task 1 complete and committed
- Awaiting human visual verification (Task 2 checkpoint) to confirm the complete Phase 5 UI overhaul looks correct
- All Phase 5 components from Plans 01, 02, 03 are wired together in Game.tsx
- Once human approves: plan is fully complete and Phase 5 is done

---
*Phase: 05-ui-overhaul-mobile-game-feel*
*Completed: 2026-03-19*
