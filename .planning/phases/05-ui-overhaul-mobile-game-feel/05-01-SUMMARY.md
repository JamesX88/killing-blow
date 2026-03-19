---
phase: 05-ui-overhaul-mobile-game-feel
plan: "01"
subsystem: client-css-and-components
tags: [css, animation, components, tailwind, motion]
dependency_graph:
  requires: []
  provides:
    - packages/client/src/index.css (glow tokens + keyframes)
    - packages/client/src/components/DungeonBackground.tsx
    - packages/client/src/components/KillFlashOverlay.tsx
  affects:
    - packages/client/src/App.tsx
tech_stack:
  added: []
  patterns:
    - CSS custom properties for Phase 5 atmospheric glow tokens
    - prefers-reduced-motion media query wrapping all keyframe animations
    - motion/react AnimatePresence for kill flash overlay entry/exit
key_files:
  created:
    - packages/client/src/components/DungeonBackground.tsx
    - packages/client/src/components/KillFlashOverlay.tsx
  modified:
    - packages/client/src/index.css
    - packages/client/src/App.tsx
decisions:
  - "All keyframe animations (hp-pulse, screen-shake, kill-flash, boss-flash) wrapped in prefers-reduced-motion: no-preference — motion-sensitive users see no animations"
  - "DungeonBackground uses zero JS logic — pure CSS .dungeon-bg and .dungeon-vignette-layer classes from index.css"
  - "KillFlashOverlay uses motion/react AnimatePresence for smooth entry/exit with duration 0.6s"
  - "App.tsx root wrapper keeps only text-zinc-50 and font-sans — body CSS already provides bg-background for non-game routes"
metrics:
  duration: "2 min"
  completed_date: "2026-03-19"
  tasks_completed: 2
  files_modified: 4
---

# Phase 5 Plan 01: CSS Foundation and New Components Summary

CSS glow tokens, keyframe animations guarded by prefers-reduced-motion, DungeonBackground and KillFlashOverlay components created as pure additive work — nothing visual changes yet since new components are not rendered anywhere.

## What Was Built

### Task 1: CSS custom properties, keyframes, and dungeon background utilities
Added to `packages/client/src/index.css`:
- 4 CSS custom properties in `:root`: `--hp-bar-glow`, `--kill-flash-color`, `--dungeon-vignette`, `--panel-border-glow`
- `@media (prefers-reduced-motion: no-preference)` block containing 4 keyframes (`hp-pulse`, `screen-shake`, `kill-flash`, `boss-flash`) and 3 animation utility classes (`.screen-shake`, `.boss-hit-flash`, `.hp-bar-low`)
- `.dungeon-bg` class: fixed full-viewport dark gothic gradient with stone texture via repeating-linear-gradient
- `.dungeon-vignette-layer` class: fixed vignette overlay with radial-gradient, pointer-events: none

### Task 2: DungeonBackground component, KillFlashOverlay component, App.tsx update
- `DungeonBackground.tsx`: Pure CSS component, renders two `aria-hidden` divs with `.dungeon-bg` and `.dungeon-vignette-layer` classes
- `KillFlashOverlay.tsx`: motion/react animated overlay, uses `AnimatePresence` for exit animations, accepts `active: boolean` prop, fixed z-40 full-screen red tint via `var(--kill-flash-color)`, `pointer-events-none`, `aria-hidden`
- `App.tsx`: Root div className changed from `"min-h-screen bg-zinc-950 text-zinc-50 font-sans"` to `"text-zinc-50 font-sans"` — game route can now control its own background

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `0108462` | feat(05-01): add CSS custom properties, keyframes, and dungeon bg utilities to index.css |
| Task 2 | `b45d8e6` | feat(05-01): create DungeonBackground and KillFlashOverlay components, update App.tsx |

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

1. `grep -c "hp-bar-glow" packages/client/src/index.css` → 1 (PASS)
2. `grep -c "dungeon-bg" packages/client/src/components/DungeonBackground.tsx` → 1 (PASS)
3. `grep -c "KillFlashOverlay" packages/client/src/components/KillFlashOverlay.tsx` → 2 (PASS)
4. `grep "bg-zinc-950" packages/client/src/App.tsx` → empty (PASS)
5. `pnpm --filter @killing-blow/client test --run` → passes with no tests (PASS)

## Self-Check: PASSED

Files created/modified:
- `packages/client/src/index.css` — FOUND
- `packages/client/src/components/DungeonBackground.tsx` — FOUND
- `packages/client/src/components/KillFlashOverlay.tsx` — FOUND
- `packages/client/src/App.tsx` — FOUND

Commits:
- `0108462` — FOUND
- `b45d8e6` — FOUND
