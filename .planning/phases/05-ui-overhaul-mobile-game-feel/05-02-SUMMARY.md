---
phase: 05-ui-overhaul-mobile-game-feel
plan: 02
subsystem: ui
tags: [react, motion, tailwind, svg, animation, dark-glass, shadcn]

# Dependency graph
requires:
  - phase: 05-ui-overhaul-mobile-game-feel
    provides: CSS keyframes and glow tokens in index.css (from plan 01)
  - phase: 04-competition-and-social
    provides: KillingBlowAnnouncement, PlayerSidebar, Leaderboard, TitleShop components
  - phase: 02-core-boss-loop
    provides: BossHpBar, BossSprite, DamageNumbers components and boss:damage_dealt socket event
  - phase: 03-player-progression
    provides: UpgradePanel and progressionStore
provides:
  - 28px rectangular HP bar with red glow (--hp-bar-glow) and low-HP pulse animation
  - 5 SVG boss silhouettes (dragon/golem/wraith/spider/lich) with idle breathe, hit flash, death animation
  - Enhanced damage numbers with x-jitter, crit at 28px yellow, normal 20px white, pop-in animation
  - Dark glass surface treatment on all panels (bg-black/40 backdrop-blur-sm border-white/10)
  - Spring-animated KillingBlowAnnouncement with red glow card and 28px winner name
  - Zero font-semibold across all 8 touched components
affects:
  - 05-03 Game.tsx layout rewrite uses these upgraded components as-is

# Tech tracking
tech-stack:
  added: []
  patterns:
    - SVG silhouettes keyed to bossNumber%5 for boss visual variety with no asset pipeline
    - CSS class toggle (boss-hit-flash) via React useState + setTimeout for hit feedback
    - Independent socket listeners on same event (BossSprite and DamageNumbers both listen to boss:damage_dealt)
    - Dark glass panel pattern: bg-black/40 backdrop-blur-sm border border-white/10 + var(--panel-border-glow)
    - Crit detection via damage threshold (amount >= 75 = 3x BASE_DAMAGE) without server crit flag

key-files:
  created: []
  modified:
    - packages/client/src/components/BossHpBar.tsx
    - packages/client/src/components/BossSprite.tsx
    - packages/client/src/components/DamageNumbers.tsx
    - packages/client/src/components/KillingBlowAnnouncement.tsx
    - packages/client/src/components/PlayerSidebar.tsx
    - packages/client/src/components/UpgradePanel.tsx
    - packages/client/src/components/TitleShop.tsx
    - packages/client/src/components/Leaderboard.tsx

key-decisions:
  - "SVG silhouettes use filled dark paths (#1a1a1a) with red glowing eyes (#dc2626) — recognizable shapes without an image asset pipeline"
  - "BossSprite idle breathe animation is the motion.div's primary animate prop (scale: [1,1.02,1]) — not a separate nested motion element"
  - "UpgradePanel Card/CardHeader/CardContent removed — replaced with plain div + dark glass treatment to eliminate flat-white card surface"
  - "Crit detection uses amount >= 75 threshold (3x BASE_DAMAGE=25) — server does not emit isCrit flag, fallback as specified in UI-SPEC"
  - "DamageNumbers removes overflow-hidden from container to allow damage numbers to float outside the boss sprite bounds"

patterns-established:
  - "Dark glass panel: bg-black/40 backdrop-blur-sm border border-white/10 rounded-lg + style={{ boxShadow: 'var(--panel-border-glow)' }}"
  - "Hit flash: useState boolean + socket.on listener + setTimeout(80ms) + CSS class boss-hit-flash"
  - "Reduced motion: useReducedMotion() from motion/react gates all scale/breathe animations"

requirements-completed: [UX-02, UX-03, UX-04, UX-05, UX-08]

# Metrics
duration: 6min
completed: 2026-03-19
---

# Phase 5 Plan 02: Component Visual Upgrade Summary

**8 components upgraded to Phase 5 gothic dungeon aesthetic: dramatic HP bar with red glow, 5 SVG boss silhouettes with motion animations, enhanced damage numbers with x-jitter and crit differentiation, spring-animated KBA, and dark glass surface (bg-black/40 backdrop-blur-sm) across all panels**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-03-19T16:41:51Z
- **Completed:** 2026-03-19T16:46:59Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- BossHpBar: 28px rectangular bar with `--hp-bar-glow` box-shadow, HP numbers above bar, `hp-bar-low` pulse animation when HP < 20%
- BossSprite: full rewrite with 5 distinct SVG silhouettes (dragon, golem, wraith, spider, lich), idle breathe via motion scale cycle, hit flash via CSS class toggle on `boss:damage_dealt`, death animation at scale 1.4 with red glow
- DamageNumbers: x-jitter (±20px), crit detection (amount >= 75), crit = 28px yellow with amber glow, normal = 20px white, pop-in scale animation, removed overflow-hidden
- All 5 panel components (KBA, PlayerSidebar, UpgradePanel, TitleShop, Leaderboard) now use dark glass surface
- Zero font-semibold remaining across all 8 touched files — weight reclassification complete

## Task Commits

Each task was committed atomically:

1. **Task 1: BossHpBar, BossSprite, DamageNumbers** - `b45d8e6` (feat)
2. **Task 2: KBA, PlayerSidebar, UpgradePanel, TitleShop, Leaderboard** - `6ac3bd1` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `packages/client/src/components/BossHpBar.tsx` - Rewritten: 28px bar, glow, HP numbers above, low-HP pulse
- `packages/client/src/components/BossSprite.tsx` - Full rewrite: 5 SVG silhouettes with breathe/hit/death animations
- `packages/client/src/components/DamageNumbers.tsx` - Enhanced: x-jitter, crit detection, pop-in animation
- `packages/client/src/components/KillingBlowAnnouncement.tsx` - Spring animation, bg-black/80, red glow card, 28px winner name
- `packages/client/src/components/PlayerSidebar.tsx` - Dark glass surface, panel-border-glow, overflow-y-auto scroll
- `packages/client/src/components/UpgradePanel.tsx` - Removed Card components, dark glass surface
- `packages/client/src/components/TitleShop.tsx` - Dark glass surface, panel-border-glow
- `packages/client/src/components/Leaderboard.tsx` - Dark glass panel wrapping table, border-white/10 rows

## Decisions Made
- SVG silhouettes use filled dark paths with red eyes (#dc2626) — recognizable shapes without asset pipeline
- BossSprite uses the main motion.div `animate` prop for idle breathe — no nested motion elements needed
- UpgradePanel Card/CardHeader/CardContent removed — plain div with dark glass is the Phase 5 pattern
- Crit uses amount >= 75 threshold (3x BASE_DAMAGE=25) since server has no isCrit flag
- DamageNumbers removes `overflow-hidden` to allow floats to escape the boss sprite container

## Deviations from Plan

None — plan executed exactly as written. CSS additions (keyframes, dungeon bg utilities) were pre-applied by plan 01 before this plan ran.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 8 components are Phase 5 compliant and ready for Plan 03 (Game.tsx layout rewrite)
- Plan 03 will wire these components into the full-viewport dungeon layout
- Components still render in old Game.tsx layout until Plan 03 — no functional regression

---
*Phase: 05-ui-overhaul-mobile-game-feel*
*Completed: 2026-03-19*

## Self-Check: PASSED

- FOUND: packages/client/src/components/BossHpBar.tsx
- FOUND: packages/client/src/components/BossSprite.tsx
- FOUND: packages/client/src/components/DamageNumbers.tsx
- FOUND: packages/client/src/components/KillingBlowAnnouncement.tsx
- FOUND: packages/client/src/components/PlayerSidebar.tsx
- FOUND: packages/client/src/components/UpgradePanel.tsx
- FOUND: packages/client/src/components/TitleShop.tsx
- FOUND: packages/client/src/components/Leaderboard.tsx
- FOUND: .planning/phases/05-ui-overhaul-mobile-game-feel/05-02-SUMMARY.md
- FOUND: b45d8e6 (Task 1 commit)
- FOUND: 6ac3bd1 (Task 2 commit)
