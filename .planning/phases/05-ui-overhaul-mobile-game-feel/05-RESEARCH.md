# Phase 5: UI Overhaul — Mobile Game Feel — Research

**Researched:** 2026-03-19
**Domain:** React frontend visual overhaul — CSS animation, full-viewport layout, motion library, Tailwind v4 utilities
**Confidence:** HIGH

---

## Summary

Phase 5 is a pure frontend refactor. No new routes, no server changes, no data fetching changes. The entire scope is: replace the current "blocks on a page" layout with an immersive full-viewport dungeon game, add atmospheric visual effects, upgrade component visuals to match a dark gothic idle RPG aesthetic (Tap Titans / Clicker Heroes reference), and add motion polish to key moments (boss death, damage numbers, killing blow announcement).

The tech stack is already fully in place: `motion/react` v12 is installed, Tailwind v4 is configured, `lucide-react` is available, and shadcn v4 components are present. No new dependencies are needed. This is a file-editing phase, not an installation phase.

The primary architectural change is `Game.tsx`: replace `min-h-screen flex-wrap gap-8 p-8` with a `relative h-[100dvh] overflow-hidden` layered composition where the dungeon background is a fixed layer behind all content. On mobile the upgrade/title panels collapse into a bottom drawer; on desktop they remain as right sidebar columns. All panels adopt `bg-black/40 backdrop-blur-sm` dark glass treatment.

**Primary recommendation:** Follow the UI-SPEC exactly. Every visual decision has already been made and verified in 05-UI-SPEC.md. The planner's job is to sequence the file changes into logical waves. No design decisions need to be re-litigated during planning.

---

## Standard Stack

### Core (all already installed — no new installs required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| motion | ^12.38.0 | Animation library — `motion/react` import | Already used in BossSprite, DamageNumbers, KillingBlowAnnouncement |
| tailwindcss | ^4.2.1 | Utility CSS — `h-dvh`, `overflow-hidden`, `backdrop-blur-sm`, etc. | v4 configured via `@import 'tailwindcss'` + vite plugin |
| lucide-react | ^0.577.0 | Icon library — trophy icon for leaderboard nav | Already installed per components.json |
| react | ^19.2.4 | Component framework | Base platform |
| @base-ui/react | ^1.3.0 | shadcn v4 primitives | Already used for shadcn Progress component |

### Tailwind v4 Viewport Utilities

| Class | CSS Output | Use in Phase 5 |
|-------|-----------|----------------|
| `h-dvh` | `height: 100dvh` | Game root container — fills visible viewport on mobile including address bar reflow |
| `overflow-hidden` | `overflow: hidden` | Game root — prevents scroll on game route |
| `backdrop-blur-sm` | `backdrop-filter: blur(4px)` | All dark glass panels |
| `bg-black/40` | `background: rgba(0,0,0,0.4)` | Semi-transparent panel surfaces |
| `border-white/10` | `border: rgba(255,255,255,0.1)` | Subtle panel edge borders |

**Key:** `100dvh` not `100vh` — on mobile, `100vh` does not account for the browser address bar collapsing/expanding. `100dvh` (dynamic viewport height) adjusts in real-time. Tailwind v4 exposes this as `h-dvh`. Browser support: all modern browsers since 2023.

### motion v12 API Patterns

| API | Import | Use in Phase 5 |
|-----|--------|----------------|
| `<motion.div>` | `motion/react` | Animated wrapper — already used throughout |
| `<AnimatePresence>` | `motion/react` | Exit animations — already used |
| `useReducedMotion()` | `motion/react` | Returns `true` if user has prefers-reduced-motion OS setting enabled |
| Spring transition | `type: "spring", stiffness: 400, damping: 20` | KillingBlowAnnouncement entry animation |

`useReducedMotion` is confirmed in motion v12 official docs. When it returns `true`, skip or simplify animations on motion-sensitive components.

### No New Dependencies

```bash
# Nothing to install — all libraries already present
# Verify current state:
pnpm ls motion tailwindcss lucide-react --filter @killing-blow/client
```

---

## Architecture Patterns

### Game.tsx — Full Viewport Layered Layout

The current architecture:
```tsx
// CURRENT (flat, scrollable)
<div className="min-h-screen flex flex-wrap lg:flex-nowrap gap-8 p-8">
  {/* all children in one scrollable row */}
</div>
```

Phase 5 target architecture:
```tsx
// TARGET (viewport-locked, layered)
<div ref={gameRootRef} className="relative h-dvh overflow-hidden">
  {/* Layer 0: Fixed dungeon background (z-0) */}
  <DungeonBackground />

  {/* Layer 1: Fixed vignette overlay (z-1, pointer-events-none) */}
  <div className="fixed inset-0 z-[1] pointer-events-none" style={{background: 'var(--dungeon-vignette)'}} aria-hidden="true" />

  {/* Layer 10: Game content (z-10) */}
  <div className="relative z-10 h-full flex flex-col lg:flex-row">
    {/* Mobile: single column — boss zone, HP, attack, then drawer handle */}
    {/* Desktop: boss zone (flex-1), right sidebar (upgrade + title + player) */}
  </div>

  {/* Layer 20: Mobile drawer (z-20) */}
  {/* ... upgrade/title drawer */}

  {/* Layer 40: KillFlashOverlay (z-40) */}
  <KillFlashOverlay active={killFlashActive} />

  {/* Layer 50: KillingBlowAnnouncement (z-50) */}
  <KillingBlowAnnouncement />
</div>
```

### App.tsx — Game Route Escape from Root Background

Current App.tsx wraps all routes in `bg-zinc-950`. Game route must escape this because the game sets its own atmospheric background:

```tsx
// App.tsx root div currently:
<div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans">

// Must become (game route handles its own bg):
<div className="text-zinc-50 font-sans">
  {/* or keep bg-zinc-950 but game route fills 100dvh above it */}
</div>
```

The cleanest approach: remove `bg-zinc-950` from App.tsx root. The game route renders its own `DungeonBackground`. Non-game routes (login, register, profile, leaderboard) inherit `bg-background` from the CSS `body` rule in `index.css` which already sets `bg-background`.

### Panel Dark Glass Pattern

Every panel in Phase 5 uses the same dark glass treatment:

```tsx
// Before (flat opaque card):
<div className="bg-card border border-border rounded-lg p-4">

// After (dark glass):
<div
  className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-lg p-4"
  style={{ boxShadow: 'var(--panel-border-glow)' }}
>
```

Applied to: PlayerSidebar, UpgradePanel, TitleShop, and the inner panel of KillingBlowAnnouncement.

### Mobile Upgrade/Title Drawer Pattern

```tsx
// Persistent tab bar — always visible at bottom on mobile (hidden lg:hidden)
<div className="fixed bottom-0 left-0 right-0 z-20 h-12 flex lg:hidden border-t border-white/10 bg-black/60 backdrop-blur-sm">
  <button onClick={() => setDrawer('upgrades')}>Upgrades</button>
  <button onClick={() => setDrawer('titles')}>Titles</button>
</div>

// Drawer — slides up when active
<AnimatePresence>
  {drawerOpen && (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="fixed bottom-0 left-0 right-0 z-20 h-[60vh] lg:hidden bg-black/90 backdrop-blur-sm border-t border-white/10"
    >
      {/* tab-switched content: drawer === 'upgrades' ? <UpgradePanel> : <TitleShop> */}
    </motion.div>
  )}
</AnimatePresence>
```

Drawer state lives in `Game.tsx` — one piece of state `drawerTab: 'upgrades' | 'titles' | null`. Null = collapsed.

### KillFlashOverlay Component Pattern

```tsx
// KillFlashOverlay.tsx — new component
interface KillFlashOverlayProps { active: boolean }

export function KillFlashOverlay({ active }: KillFlashOverlayProps) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="fixed inset-0 z-40 pointer-events-none"
          style={{ backgroundColor: 'var(--kill-flash-color)' }}
          aria-hidden="true"
        />
      )}
    </AnimatePresence>
  )
}
```

Kill flash state lives in `Game.tsx`. The `boss:death` socket event is already received in `socket.ts` and calls `useBossStore.markDefeated()`. Game.tsx subscribes to `useBossStore.isDefeated` — when it flips to `true`, trigger the kill flash and screen shake.

**Screen shake implementation:** apply/remove a CSS class on the `gameRootRef` element:
```tsx
const gameRootRef = useRef<HTMLDivElement>(null)

// On boss defeat:
if (gameRootRef.current && !prefersReducedMotion) {
  gameRootRef.current.classList.add('screen-shake')
  setTimeout(() => gameRootRef.current?.classList.remove('screen-shake'), 400)
}
```

### BossSprite — SVG Silhouette Pattern

Five silhouettes keyed to `bossNumber % 5`. Each is a large inline SVG element (no image asset pipeline). The 5 shapes from the spec: dragon, golem, wraith, spider, lich.

```tsx
const SILHOUETTES = [/* 5 SVG path definitions */]

const silhouette = SILHOUETTES[bossNumber % 5]

return (
  <motion.div
    animate={isDefeated
      ? { scale: 1.4, opacity: 0, filter: 'drop-shadow(0 0 24px rgba(220,38,38,0.9))' }
      : { scale: 1, opacity: 1 }
    }
    // Idle breathe — layered on top:
    // use a separate motion.div for the continuous breathe animation
    // so death animation can override cleanly
  >
    <svg viewBox="0 0 200 200" style={{ filter: 'drop-shadow(0 0 16px rgba(220,38,38,0.5))' }}>
      {silhouette}
    </svg>
  </motion.div>
)
```

Idle breathe: use `motion/react` `animate` with `repeat: Infinity, repeatType: "reverse"`:
```tsx
animate={{ scale: [1, 1.02, 1] }}
transition={{ duration: 3, ease: 'easeInOut', repeat: Infinity }}
```

When `isDefeated` flips, the death animation overrides via a conditional `animate` prop.

### DamageNumbers — x-Jitter and Crit Differentiation

Current DamageNumbers uses fixed `left-1/2 -translate-x-1/2`. Phase 5 adds per-hit random x offset and crit size:

```tsx
interface Hit {
  hitId: string
  amount: number
  xOffset: number  // random -20 to +20, assigned on creation
}

// On socket event:
const xOffset = (Math.random() - 0.5) * 40  // -20 to +20px

// Crit threshold: amount >= BASE_DAMAGE * 3 (BASE_DAMAGE = 25, so >= 75)
// Or when server sends isCrit flag
const isCrit = amount >= 75  // fallback threshold

// Render:
<motion.div
  key={hit.hitId}
  style={{ left: `calc(50% + ${hit.xOffset}px)` }}
  className={`absolute font-bold pointer-events-none ${
    isCrit ? 'text-[28px] text-yellow-400' : 'text-[20px] text-white'
  }`}
  initial={{ opacity: 0, scale: 1.2, y: 0 }}
  animate={{ opacity: [0, 1, 1, 0], scale: [1.2, 1.0, 0.8], y: -80 }}
  transition={{ duration: 1.2, times: [0, 0.1, 0.7, 1], ease: 'easeOut' }}
>
  -{formatNumber(new Decimal(hit.amount))}
</motion.div>
```

### Recommended File-Change Sequence

The spec enumerates all files that change. Logical sequencing for a planner:

**Wave 1 — Foundation (no visual regressions):**
1. `index.css` — add CSS custom properties and keyframes (additive only, no existing CSS broken)
2. `DungeonBackground.tsx` — new component, not yet used anywhere
3. `KillFlashOverlay.tsx` — new component, not yet used anywhere
4. `App.tsx` — remove `bg-zinc-950` from root div (minimal change, tested by existing routes rendering)

**Wave 2 — Component Visual Upgrades (each component independently testable):**
5. `BossHpBar.tsx` — height, glow, pulse animation, HP numbers position
6. `BossSprite.tsx` — full rewrite to SVG silhouettes
7. `DamageNumbers.tsx` — x-jitter, crit differentiation, pop-in animation
8. `KillingBlowAnnouncement.tsx` — spring animation, glow, typography upgrades
9. `PlayerSidebar.tsx` — dark glass surface
10. `UpgradePanel.tsx` — dark glass surface (desktop display unchanged)
11. `TitleShop.tsx` — dark glass surface (desktop display unchanged)
12. `Leaderboard.tsx` — dark glass surface treatment on page

**Wave 3 — Layout Architecture (the big change):**
13. `Game.tsx` — full viewport layout rewrite, wire in DungeonBackground, KillFlashOverlay, screen shake, mobile drawer

Wave 3 is last because it depends on all the updated child components being correct. Doing the layout last means the visual character of the scene is already established before the layout is assembled.

### Anti-Patterns to Avoid

- **100vh on game root:** Use `h-dvh` (100dvh). On mobile, `100vh` is the initial viewport height including address bar — the browser bar then collapses and content overflows. `100dvh` adjusts dynamically.
- **overflow: visible on game root:** The root must be `overflow-hidden`. If overflow is visible, dungeon background bleeds outside and page scroll appears.
- **Two stacked overlays for kill + announcement:** KillingBlowAnnouncement and KillFlashOverlay are separate components at different z-levels (40 vs 50). They are NOT the same component. The flash fires at boss death and clears in 600ms; the announcement may linger for the full post-fight window.
- **Screen shake without reduced-motion guard:** Always check `prefersReducedMotion` (from `useReducedMotion()`) before applying shake. Screen shake is the most likely trigger for motion sickness.
- **Putting drawer state in UpgradePanel/TitleShop:** Drawer open/close state must live in `Game.tsx` so the drawer wrapper (with animation) is siblings of, not children of, the panel components. Panel components render their content; Game.tsx wraps that content in the drawer shell.
- **Breaking existing socket subscriptions:** `DamageNumbers` manages its own `boss:damage_dealt` subscription independently of `subscribeToGame`. Comment in `socket.ts` line 53 explicitly notes this. Do not move it.
- **Adding new shadcn components:** No new shadcn registry installs are needed or permitted per the UI-SPEC registry safety section.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Spring animation physics | Custom CSS cubic-bezier approximation | `motion/react` spring: `{type: "spring", stiffness: 400, damping: 20}` | motion's spring is physically accurate and handles interrupts correctly |
| Reduced motion detection | Manual `window.matchMedia('(prefers-reduced-motion)')` | `useReducedMotion()` from `motion/react` | Hook already handles SSR, updates reactively, correct API |
| CSS backdrop blur | Custom `filter: blur()` on a copy of the background | Tailwind `backdrop-blur-sm` class | Standard, compositable, no layering hacks needed |
| 100dvh fallback polyfill | Manual JS viewport height calculation | `h-dvh` Tailwind class | Browser support universal since 2023, no fallback needed |
| Drag-to-dismiss on mobile drawer | Custom pointer event handler | `motion/react` drag with `dragConstraints` | Complex gesture handling, easy to break scroll behavior |
| SVG boss art asset pipeline | Image loading, sprite sheets | Inline SVG paths per silhouette type | No network request, no asset pipeline, immediate, styled via CSS |

---

## Common Pitfalls

### Pitfall 1: Game Root Height Not Taking Effect

**What goes wrong:** `h-dvh` is set but the game route still scrolls, or the game content doesn't fill the viewport.
**Why it happens:** App.tsx wraps every route in `min-h-screen`. Setting `h-dvh` on the Game component child doesn't override the outer wrapper's scrolling behavior. Also: `overflow-hidden` only clips children if the element has a defined height.
**How to avoid:** Remove `min-h-screen` from App.tsx root wrapper specifically for the game route. The cleanest approach: Game.tsx sets `position: fixed; inset: 0` on its root div (or uses `h-dvh overflow-hidden`), and App.tsx removes `min-h-screen` from the wrapper (just `text-zinc-50 font-sans`). `bg-background` is already on `body` in `index.css`, so non-game routes keep their background color.
**Warning signs:** If the browser scrollbar appears on `/game`, or if the dungeon background scrolls with content, the viewport lock is not working.

### Pitfall 2: Backdrop Blur Requiring a Stacking Context

**What goes wrong:** `backdrop-blur-sm` appears to have no effect on panels even though the class is applied.
**Why it happens:** `backdrop-filter` only renders on elements that are positioned (non-static) or in certain stacking contexts. If a parent has `overflow: hidden`, backdrop-filter can be clipped. Also: the element behind must be visually different from the panel surface for blur to be visible.
**How to avoid:** Ensure panels use `relative` or `absolute` positioning, not default static. The dungeon background is `position: fixed; z-index: 0` — panels at z-10 can correctly see through to the bg layer. Test by temporarily making bg vivid to confirm blur is rendering.
**Warning signs:** Panels show a flat dark surface with no atmospheric depth effect.

### Pitfall 3: Screen Shake Causing Layout Reflow

**What goes wrong:** `screen-shake` animation uses `transform: translate()` which is GPU-composited and should not cause layout reflow — but if the game root is also the scroll container, a translate can temporarily expose content outside the overflow boundary, causing a brief white flash.
**Why it happens:** `overflow: hidden` on a transformed element — the clipping boundary transforms with the element, causing edges to become visible during shake.
**How to avoid:** Apply screen shake to an inner div, not the game root itself. Specifically: apply `.screen-shake` to the game content layer (z-10), not the `h-dvh overflow-hidden` root. The root stays fixed; only the content layer shakes within it.

### Pitfall 4: `isDefeated` → Kill Flash Race Condition

**What goes wrong:** Kill flash and screen shake trigger on every `boss:death`, but `bossStore.isDefeated` is also set on `boss:death`. If kill flash is triggered by watching `isDefeated` via zustand, it will fire again every time the component remounts (e.g., strict mode double mount in dev).
**Why it happens:** Zustand state is persistent — if `isDefeated` is still `true` when the component mounts (before the new boss `boss:spawn` clears it), the effect fires again.
**How to avoid:** Trigger kill flash from the socket event directly in `Game.tsx` (via a `useEffect` on the socket), NOT by watching `isDefeated` in zustand. The socket event fires once per boss death; zustand state can be stale.

```tsx
// In Game.tsx:
useEffect(() => {
  const handleDeath = () => {
    setKillFlashActive(true)
    // screen shake
    setTimeout(() => setKillFlashActive(false), 600)
  }
  socket.on('boss:death', handleDeath)
  return () => { socket.off('boss:death', handleDeath) }
}, [])
```

Note: this is safe alongside `subscribeToGame()` because it is a separate listener for the same event. Socket.IO allows multiple listeners per event.

### Pitfall 5: DamageNumbers Overflow Clipping

**What goes wrong:** Damage numbers are clipped by the boss sprite container's `overflow-hidden` before they finish floating upward.
**Why it happens:** DamageNumbers renders inside `<div className="absolute inset-0 pointer-events-none overflow-hidden">` — the overflow-hidden clips the float-up animation.
**How to avoid:** Remove `overflow-hidden` from the DamageNumbers container. Instead, clip using the outer boss sprite area bounds with CSS `clip-path` or let them float freely (they disappear via opacity fade, so overflow clipping isn't needed). The spec says float 80px up — ensure the parent container has enough height above the sprite to accommodate.

### Pitfall 6: motion/react `animate` Array Syntax for Keyframes

**What goes wrong:** DamageNumbers pop-in animation `opacity: [0, 1, 1, 0]` with custom `times` doesn't render as expected.
**Why it happens:** motion v12 uses array values for keyframes, but `times` must have the same length as the value array, and must go from 0 to 1. If `times` array is wrong, animation snaps to final value.
**How to avoid:** Verify: `opacity: [0, 1, 1, 0]` with `times: [0, 0.1, 0.7, 1]`. The `times` array has 4 values matching the 4 opacity values.

---

## Code Examples

### CSS Additions to index.css

```css
/* Source: 05-UI-SPEC.md HP Bar Contract + Screen Effects Contract */

/* Glow tokens */
--hp-bar-glow: 0 0 12px rgba(220, 38, 38, 0.7), 0 0 24px rgba(220, 38, 38, 0.3);
--kill-flash-color: rgba(220, 38, 38, 0.25);
--dungeon-vignette: radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.7) 100%);
--panel-border-glow: 0 0 8px rgba(220, 38, 38, 0.15);

/* HP bar pulse — wraps in reduced-motion guard */
@media (prefers-reduced-motion: no-preference) {
  @keyframes hp-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }

  @keyframes screen-shake {
    0%, 100% { transform: translate(0, 0); }
    20%  { transform: translate(-3px, 2px); }
    40%  { transform: translate(3px, -2px); }
    60%  { transform: translate(-2px, 3px); }
    80%  { transform: translate(2px, -1px); }
  }

  @keyframes kill-flash {
    0%   { opacity: 0; }
    20%  { opacity: 1; }
    100% { opacity: 0; }
  }

  .screen-shake {
    animation: screen-shake 400ms ease-in-out;
  }

  .boss-hit-flash {
    animation: boss-flash 80ms ease-in-out;
  }

  @keyframes boss-flash {
    0%, 100% { filter: drop-shadow(0 0 16px rgba(220,38,38,0.5)); }
    50% { filter: drop-shadow(0 0 16px rgba(220,38,38,0.5)) brightness(1.3); }
  }
}

/* Dungeon background — no reduced-motion needed, static gradient */
.dungeon-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  background:
    repeating-linear-gradient(
      0deg,
      transparent, transparent 40px,
      rgba(255,255,255,0.01) 40px,
      rgba(255,255,255,0.01) 41px
    ),
    repeating-linear-gradient(
      90deg,
      transparent, transparent 40px,
      rgba(255,255,255,0.01) 40px,
      rgba(255,255,255,0.01) 41px
    ),
    radial-gradient(ellipse at 50% 30%, #1a0a0a 0%, #0d0d0d 60%, #050505 100%);
}

.dungeon-vignette-layer {
  position: fixed;
  inset: 0;
  z-index: 1;
  background: radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.65) 100%);
  pointer-events: none;
}

/* Low HP pulse — applied to HP bar fill element */
.hp-bar-low {
  animation: hp-pulse 800ms ease-in-out infinite;
}
```

### useReducedMotion Usage in motion v12

```tsx
// Source: https://motion.dev/docs/react-use-reduced-motion
import { useReducedMotion } from 'motion/react'

function BossSprite({ bossNumber, isDefeated }) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.div
      animate={prefersReducedMotion
        ? { opacity: isDefeated ? 0 : 1 }  // simplified — no scale
        : { scale: isDefeated ? 1.4 : 1, opacity: isDefeated ? 0 : 1 }
      }
    >
      {/* ... */}
    </motion.div>
  )
}
```

### KillingBlowAnnouncement — Spring Entry

```tsx
// Source: 05-UI-SPEC.md + motion v12 docs
<motion.div
  initial={{ opacity: 0, scale: 0.5 }}
  animate={{ opacity: 1, scale: 1 }}
  exit={{ opacity: 0, scale: 0.5 }}
  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
  // ...
>
  <div
    className="relative bg-black/80 border border-white/10 rounded-lg p-8 shadow-xl w-96 flex flex-col items-center gap-4 text-center"
    style={{ boxShadow: '0 0 40px rgba(220,38,38,0.4)' }}
  >
    <h2 className="text-[28px] font-bold text-foreground leading-[1.1]">Killing Blow!</h2>
    <p className="text-[28px] font-bold text-primary leading-[1.2]">{winnerUsername} dealt the final blow</p>
  </div>
</motion.div>
```

### BossHpBar Phase 5 Contract

```tsx
// Source: 05-UI-SPEC.md HP Bar Contract
const isLowHp = percent < 20

return (
  <div className="space-y-1">
    {/* HP numbers ABOVE bar */}
    <p className="text-center text-[28px] font-bold leading-[1.1]">
      {formatNumber(new Decimal(hp))} / {formatNumber(new Decimal(maxHp))}
    </p>
    <div
      role="progressbar"
      aria-label="Boss HP"
      aria-valuenow={hp}
      aria-valuemin={0}
      aria-valuemax={maxHp}
      style={{
        height: '28px',
        width: '100%',
        borderRadius: '4px',  // rectangular, not pill
        backgroundColor: '#0f0f0f',
        border: '1px solid rgba(220,38,38,0.2)',
        overflow: 'visible',  // allow glow to bleed
      }}
    >
      <div
        className={isLowHp ? 'hp-bar-low' : ''}
        style={{
          height: '100%',
          width: `${percent}%`,
          backgroundColor: '#dc2626',
          borderRadius: '4px',
          transition: 'width 200ms ease-out',
          boxShadow: 'var(--hp-bar-glow)',
        }}
      />
    </div>
  </div>
)
```

### Mobile Loading State — "Summoning..."

```tsx
// Game.tsx loading guard (replaces current `return null`)
if (!isAuthenticated || !bossId) {
  return (
    <div className="relative h-dvh overflow-hidden flex items-center justify-center">
      <DungeonBackground />
      <p className="relative z-10 text-[28px] font-bold text-muted-foreground">Summoning...</p>
    </div>
  )
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact for Phase 5 |
|--------------|------------------|--------------|-------------------|
| `100vh` for full height mobile | `100dvh` via `h-dvh` in Tailwind v4 | CSS spec 2022, Tailwind v4 Jan 2025 | Must use `h-dvh` not `h-screen` on game root |
| `framer-motion` import | `motion/react` import | motion v11 (2024) | Already correctly imported in codebase |
| Linear CSS transition for modal | Spring physics via `type: "spring"` | motion v6+ | KBA uses spring per spec |
| Static position panels | `backdrop-filter: blur` dark glass | CSS 2020, Tailwind support | All panels use `bg-black/40 backdrop-blur-sm` |

**Deprecated/outdated in this codebase:**
- `font-semibold` (weight 600): Phase 5 eliminates semibold. Use `font-normal` (400) for Label and `font-bold` (700) for Heading/Display. Any remaining `font-semibold` in touched components is a bug.
- `h-screen` on game route: Replace with `h-dvh`. `h-screen` = `100vh` which has mobile address bar issues.
- `overflow-hidden` on DamageNumbers container: Remove this — it clips floating damage numbers before they complete the 80px float animation.

---

## Open Questions

1. **Crit flag from server**
   - What we know: Server sends `boss:damage_dealt` with `{ amount, hitId }`. No `isCrit` field exists yet.
   - What's unclear: Is adding a `isCrit` flag to the socket payload feasible within this phase's "no server changes" scope?
   - Recommendation: Use damage threshold fallback (amount >= 75 = crit) for Phase 5. Flag this as a Phase 6 or hotfix improvement. The threshold is workable because BASE_DAMAGE=25 and crit multiplier would produce values well above 75.

2. **Boss sprite SVG paths for 5 silhouettes**
   - What we know: The spec says use 5 distinct shapes (dragon, golem, wraith, spider, lich) as inline SVGs.
   - What's unclear: Exact SVG path data for each silhouette. This is creative work, not a technical unknown.
   - Recommendation: The executor creates these as simple dark silhouette shapes using basic SVG paths. They don't need to be detailed — a rough recognizable outline with the red glow filter provides the needed visual impact. Alternatively, use large lucide-react icons as stand-ins (Skull, Flame, Bug, Star, Zap) — this is simpler to implement and still achieves the "5 distinct silhouettes" goal.

3. **Drawer scroll within panels**
   - What we know: UpgradePanel and TitleShop currently render full height. In a 60vh drawer they may overflow.
   - What's unclear: Whether the drawer should scroll internally or truncate content.
   - Recommendation: Add `overflow-y-auto` to the drawer's inner content area. The panel components themselves don't need modification for this — the drawer wrapper handles scroll containment.

---

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json` — section included.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `packages/client/vitest.config.ts` |
| Quick run command | `pnpm --filter @killing-blow/client test` |
| Full suite command | `pnpm --filter @killing-blow/client test --run` |

**Current state:** vitest.config.ts uses `environment: 'node'`. There are no existing client test files. The client test suite runs with `--passWithNoTests` so the suite is green with zero tests.

### Phase Requirements Notes

Phase 5 has no requirement IDs from REQUIREMENTS.md (all v1 requirements were addressed in Phases 1-4). This phase delivers the "mobile game feel" polish described in the UI-SPEC. The requirements this phase satisfies are implicitly:
- All UI requirements (UI-01 through UI-04) — Phase 5 visually upgrades the components that implement these requirements without changing their data behavior
- New quality requirement: game viewport is immersive and mobile-friendly

### Test Map

| Behavior | Test Type | Automated Command | Notes |
|----------|-----------|-------------------|-------|
| CSS keyframes added to index.css (hp-pulse, screen-shake, kill-flash) | manual | visual inspection in browser | CSS-only, not unit-testable |
| DungeonBackground renders without errors | smoke | Vitest component test | requires jsdom environment |
| KillFlashOverlay shows when `active=true` | smoke | Vitest component test | requires jsdom + AnimatePresence mock |
| BossHpBar height 28px, rect border-radius, glow | manual | visual inspection | CSS inline style, not easily unit-tested |
| BossSprite renders 5 distinct silhouettes by bossNumber % 5 | unit | Vitest component test | pure logic test |
| DamageNumbers uses random x offset per hit | unit | Vitest state logic | test Hit creation logic |
| Game.tsx h-dvh + overflow-hidden on root | manual | browser resize test on mobile emulator | viewport behavior |
| Mobile drawer opens/closes on tab tap | manual | browser interaction | gesture-dependent |
| Leaderboard dark glass surface | manual | visual inspection | CSS class change |
| prefers-reduced-motion: animations skipped | manual | browser DevTools emulate | CSS @media behavior |

### Sampling Rate

- **Per task commit:** `pnpm --filter @killing-blow/client test --run` (passes with no tests until client tests are written)
- **Per wave merge:** same + manual browser smoke test on Chrome mobile emulator
- **Phase gate:** Full suite green + manual browser verification before `/gsd:verify-work`

### Wave 0 Gaps

The current vitest environment is `node` — component tests require `jsdom`. If component tests are added, vitest.config.ts needs updating:

- [ ] `packages/client/vitest.config.ts` — change `environment: 'node'` to `environment: 'jsdom'` if component tests are added
- [ ] `packages/client/src/components/BossSprite.test.tsx` — covers silhouette selection logic
- [ ] `packages/client/src/components/DamageNumbers.test.tsx` — covers x-jitter and crit threshold logic

However: given the visual nature of this phase, component tests provide limited value. The primary validation is **manual browser verification**. Wave 0 test infrastructure changes are optional.

---

## Sources

### Primary (HIGH confidence)
- `packages/client/src/pages/Game.tsx` — current layout, socket wiring, stores used
- `packages/client/src/components/BossSprite.tsx` — current implementation
- `packages/client/src/components/BossHpBar.tsx` — current implementation
- `packages/client/src/components/DamageNumbers.tsx` — current implementation
- `packages/client/src/components/KillingBlowAnnouncement.tsx` — current implementation
- `packages/client/src/lib/socket.ts` — socket events, listener pattern
- `packages/client/src/index.css` — existing CSS custom properties
- `.planning/phases/05-ui-overhaul-mobile-game-feel/05-UI-SPEC.md` — authoritative design contract
- `.planning/STATE.md` — all project decisions
- `packages/client/package.json` — confirmed: motion ^12.38.0, tailwindcss ^4.2.1, lucide-react ^0.577.0

### Secondary (MEDIUM confidence)
- [motion.dev useReducedMotion docs](https://motion.dev/docs/react-use-reduced-motion) — confirmed hook exists in motion v12
- [Tailwind CSS docs overflow](https://tailwindcss.com/docs/overflow) — confirmed `h-dvh` utility available in Tailwind v4
- [CSS Dynamic Viewport Units](https://modern-css.com/mobile-viewport-height-without-100vh-hack/) — confirmed browser support universal since 2023

### Tertiary (LOW confidence — training knowledge, not independently verified)
- SVG path patterns for boss silhouettes — creative work, no source required
- Exact `h-dvh` Tailwind class naming in v4 — MEDIUM (verified via search, official docs)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from package.json, no new installs required
- Architecture patterns: HIGH — derived directly from reading all source files + UI-SPEC
- Pitfalls: HIGH — identified from direct codebase analysis (socket listener pattern, overflow-hidden on DamageNumbers, isDefeated timing)
- Animation API: HIGH — motion v12 confirmed installed, useReducedMotion confirmed in official docs
- CSS utilities: HIGH — Tailwind v4 h-dvh confirmed available

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable libraries, 30-day window)
