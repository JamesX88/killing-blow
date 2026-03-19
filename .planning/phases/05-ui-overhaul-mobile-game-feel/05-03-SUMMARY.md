---
phase: 05-ui-overhaul-mobile-game-feel
plan: "03"
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
  - Mobile drawer panels w-full (post-checkpoint fix — UpgradePanel and TitleShop)
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
    - packages/client/src/components/UpgradePanel.tsx
    - packages/client/src/components/TitleShop.tsx

key-decisions:
  - "Kill flash triggered from boss:death socket event, not zustand isDefeated — prevents race condition on remount"
  - "Screen shake applied to contentRef (content layer) not game root — prevents overflow clipping during transform"
  - "Mobile drawer panels changed from hardcoded w-64/w-72 to w-full — fills drawer correctly at all widths"

patterns-established:
  - "Full-viewport game layout: relative h-dvh overflow-hidden root, DungeonBackground at z-0, content at z-10, overlays at z-20/40/50"
  - "Mobile-first layout: pb-20 on boss zone for tab bar clearance, lg:pb-4 on desktop"

requirements-completed: [UX-01, UX-06, UX-07, UX-09]

# Metrics
duration: 65min
completed: 2026-03-19
---

# Phase 05 Plan 03: Game.tsx Full-Viewport Dungeon Layout Summary

**Full rewrite of Game.tsx from flat scrollable grid to h-dvh viewport-locked layered dungeon composition with mobile drawer, kill flash, screen shake, and trophy leaderboard nav — human-verified across desktop and mobile**

## Performance

- **Duration:** ~65 min (including human-verify checkpoint and post-checkpoint fix)
- **Started:** 2026-03-19T15:13:11Z
- **Completed:** 2026-03-19T16:14:09Z
- **Tasks:** 2 (1 auto + 1 human-verify checkpoint — approved)
- **Files modified:** 3

## Accomplishments
- Rewrote Game.tsx from `min-h-screen flex flex-wrap gap-8 p-8` to `relative h-dvh overflow-hidden` full-viewport architecture
- Wired DungeonBackground (z-0), KillFlashOverlay (z-40), mobile drawer (z-20), and screen shake into the layout
- Kill flash and screen shake triggered directly from `boss:death` socket event with `prefersReducedMotion` guard
- Mobile: persistent bottom tab bar with 60vh AnimatePresence slide-up drawer for Upgrades/Titles
- Desktop: right sidebar (`hidden lg:flex`) with UpgradePanel/TitleShop/PlayerSidebar stacked
- Replaced text leaderboard link with Trophy icon button (dark glass, top-right)
- Replaced `return null` loading with "Summoning..." text over DungeonBackground
- Eliminated all `font-semibold` across Game.tsx and all Phase 5 component files
- Post-checkpoint fix: mobile drawer panels (UpgradePanel, TitleShop) corrected from hardcoded widths to w-full
- Human approved visual appearance of complete Phase 5 UI overhaul across desktop and mobile viewports

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite Game.tsx to full-viewport layered layout with effects and mobile drawer** - `4ca1d65` (feat)
2. **Task 2: Visual verification of complete Phase 5 UI** - Human approved (checkpoint resolved)

**Post-checkpoint fix:** `bca43e7` (fix) — Mobile drawer panels w-full correction (UpgradePanel.tsx, TitleShop.tsx)

**Plan metadata:** _(this commit)_

## Files Created/Modified
- `packages/client/src/pages/Game.tsx` - Full rewrite: h-dvh viewport lock, DungeonBackground layer, KillFlashOverlay, mobile drawer, desktop sidebar, trophy nav, Summoning... loading state
- `packages/client/src/components/UpgradePanel.tsx` - Removed hardcoded w-64, now w-full for drawer compatibility
- `packages/client/src/components/TitleShop.tsx` - Removed hardcoded w-72, now w-full for drawer compatibility

## Decisions Made
- Kill flash and screen shake triggered from `boss:death` socket event directly (not zustand `isDefeated`), per RESEARCH.md Pitfall 4 guidance — avoids stale state race condition on component remount
- Screen shake applied to `contentRef.current` (content layer at z-10), not the game root div — per RESEARCH.md Pitfall 3 guidance — prevents transform from moving overflow clipping boundary
- Mobile drawer panels changed from hardcoded widths to `w-full` after human verification revealed narrow columns inside the full-width drawer

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Mobile drawer panels had hardcoded widths preventing full-width fill inside drawer**
- **Found during:** Task 2 (human-verify checkpoint) — identified during visual inspection
- **Issue:** UpgradePanel had `w-64` and TitleShop had `w-72` from their original desktop card styles; inside the 60vh slide-up mobile drawer these caused narrow centered columns instead of filling the available width
- **Fix:** Removed hardcoded width classes from both components; they now inherit width from parent container (w-full by default)
- **Files modified:** `packages/client/src/components/UpgradePanel.tsx`, `packages/client/src/components/TitleShop.tsx`
- **Verification:** Human visual verification confirmed panels fill drawer correctly after fix
- **Committed in:** `bca43e7`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Fix was necessary for correct mobile drawer layout. No scope creep.

## Issues Encountered

None beyond the drawer width deviation documented above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 5 fully complete — all 3 plans executed and human-verified
- Complete Phase 5 UI stack is live: h-dvh dungeon layout, dark glass surfaces, SVG boss silhouettes with animations, dramatic HP bar with glow, damage numbers with x-jitter, kill flash + screen shake on boss death, spring-animated KBA, mobile bottom drawer, trophy icon leaderboard nav
- All requirements completed: UX-01, UX-06, UX-07, UX-09
- Ready for any Phase 6+ feature work on top of this Phase 5 UI foundation
- No blockers

---
*Phase: 05-ui-overhaul-mobile-game-feel*
*Completed: 2026-03-19*

## Self-Check: PASSED

- FOUND: packages/client/src/pages/Game.tsx
- FOUND: packages/client/src/components/UpgradePanel.tsx
- FOUND: packages/client/src/components/TitleShop.tsx
- FOUND: .planning/phases/05-ui-overhaul-mobile-game-feel/05-03-SUMMARY.md
- FOUND commit: 4ca1d65 (feat: Game.tsx rewrite)
- FOUND commit: bca43e7 (fix: mobile drawer panels w-full)
