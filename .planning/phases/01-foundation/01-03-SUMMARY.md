---
phase: 01-foundation
plan: 03
subsystem: ui
tags: [react, shadcn, tailwind, zustand, react-router-dom, typescript, vite]

requires:
  - phase: 01-foundation
    provides: monorepo scaffold with packages/client Vite+React app skeleton

provides:
  - shadcn/ui zinc dark theme with red-600 accent override
  - Tailwind v4 CSS configured via @import in index.css
  - React Router v7 with /register, /login, /profile routes
  - Zustand session store (useSessionStore) with setSession, clearSession, checkSession
  - apiPost helper with credentials: 'include'
  - Register page matching UI-SPEC: form validation, OAuth buttons, aria-describedby
  - Login page matching UI-SPEC: form validation, OAuth buttons, nav link

affects:
  - 01-04 (profile page will use useSessionStore and shadcn components)
  - 01-05 (real-time features will use session state)
  - all future UI phases (shadcn component library and theme established)

tech-stack:
  added:
    - tailwindcss 4.x (via @tailwindcss/vite plugin, CSS @import approach)
    - shadcn/ui (base-nova style, base-ui primitives)
    - @base-ui/react (shadcn v4 underlying primitives)
    - tw-animate-css
    - lucide-react
    - class-variance-authority
    - clsx + tailwind-merge (via lib/utils.ts cn())
  patterns:
    - CSS variable theming with oklch color space (shadcn v4 default)
    - HSL override for red-600 accent: --primary: 0 72% 51% in .dark
    - apiPost helper returns { ok, status, data } for uniform error handling
    - Zustand store pattern: state + actions in single create() call
    - aria-describedby + aria-invalid for accessible form error association

key-files:
  created:
    - packages/client/components.json (shadcn configuration, base-nova style)
    - packages/client/src/index.css (Tailwind v4 + zinc dark theme + red-600 accent)
    - packages/client/src/lib/utils.ts (cn() helper)
    - packages/client/src/lib/api.ts (apiPost helper)
    - packages/client/src/stores/sessionStore.ts (Zustand session store)
    - packages/client/src/pages/Register.tsx (Register page)
    - packages/client/src/pages/Login.tsx (Login page)
    - packages/client/src/components/ui/button.tsx
    - packages/client/src/components/ui/input.tsx
    - packages/client/src/components/ui/label.tsx
    - packages/client/src/components/ui/card.tsx
    - packages/client/src/components/ui/separator.tsx
  modified:
    - packages/client/package.json (added shadcn, tailwind, lucide-react, zustand deps)
    - packages/client/tsconfig.json (added @/* path alias)
    - packages/client/vite.config.ts (added tailwindcss plugin + @/* resolve alias)
    - packages/client/src/main.tsx (added BrowserRouter wrapper)
    - packages/client/src/App.tsx (added Routes for /register, /login, /profile)

key-decisions:
  - "shadcn v4 uses base-nova style with @base-ui/react primitives and oklch color space — not the traditional zinc/slate HSL tokens; HSL override applied on top for red-600 accent"
  - "Tailwind v4 uses @import 'tailwindcss' in CSS instead of tailwind.config.ts — vite.config.ts uses @tailwindcss/vite plugin"
  - "tsconfig.json path alias @/* required before shadcn init can validate import alias"
  - "shadcn init auto-adds tw-animate-css and @fontsource-variable/geist; Geist font kept but not required (Inter specified in @theme inline)"

patterns-established:
  - "Form pattern: client validate -> submit -> apiPost -> ok/409/401/5xx branching -> setSession + navigate"
  - "Error display pattern: aria-describedby ID links input to error paragraph, aria-invalid toggles border styling"
  - "OAuth link pattern: <a href='/auth/provider'> wrapping <Button variant='outline'> with min-h-[44px]"

requirements-completed: [AUTH-01, AUTH-02]

duration: 6min
completed: 2026-03-18
---

# Phase 1 Plan 03: shadcn/ui zinc dark theme with Register and Login pages

**React frontend with shadcn v4 (base-ui primitives), Tailwind v4 CSS, Zustand session store, and Register/Login pages matching UI-SPEC with full validation, OAuth buttons, and aria accessibility**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-18T13:34:03Z
- **Completed:** 2026-03-18T13:40:00Z
- **Tasks:** 2
- **Files modified:** 17

## Accomplishments

- shadcn/ui initialized with zinc dark preset and red-600 accent override (`--primary: 0 72% 51%`), Tailwind v4 via `@tailwindcss/vite` plugin, five shadcn components installed
- Zustand session store (`useSessionStore`) with `setSession`, `clearSession`, `setLoading`, `checkSession` actions ready for all auth flows
- Register and Login pages implement every UI-SPEC requirement: exact copy, aria-describedby error association, Loader2 spinner, 44px OAuth buttons, hover/focus/disabled states

## Task Commits

1. **Task 1: Initialize shadcn/ui with zinc dark theme, Tailwind v4 and routing** - `5ffcd65` (feat)
2. **Task 2: Session store, API helper, Register and Login pages** - `7bc1db2` (feat)

## Files Created/Modified

- `packages/client/components.json` - shadcn config (base-nova style, @/* alias, lucide icons)
- `packages/client/src/index.css` - Tailwind v4 imports, zinc dark CSS variables, red-600 accent override
- `packages/client/src/lib/utils.ts` - cn() helper (clsx + tailwind-merge)
- `packages/client/src/lib/api.ts` - apiPost({ ok, status, data }) with credentials: 'include'
- `packages/client/src/stores/sessionStore.ts` - Zustand store: userId, username, isAuthenticated, isLoading + actions
- `packages/client/src/pages/Register.tsx` - Register page: form validation, 409/5xx errors, OAuth, nav link, aria
- `packages/client/src/pages/Login.tsx` - Login page: form validation, 401/5xx errors, OAuth, nav link, aria
- `packages/client/src/components/ui/button.tsx` - shadcn Button (base-ui primitive, default/outline variants)
- `packages/client/src/components/ui/input.tsx` - shadcn Input (base-ui primitive)
- `packages/client/src/components/ui/label.tsx` - shadcn Label
- `packages/client/src/components/ui/card.tsx` - shadcn Card/CardContent/CardHeader etc.
- `packages/client/src/components/ui/separator.tsx` - shadcn Separator (base-ui primitive)
- `packages/client/tsconfig.json` - added @/* path alias (required for shadcn init)
- `packages/client/vite.config.ts` - added tailwindcss() plugin and @/* resolve alias
- `packages/client/src/main.tsx` - BrowserRouter wrapping App
- `packages/client/src/App.tsx` - Routes: /register, /login, /profile, / -> /login redirect

## Decisions Made

- shadcn v4 (2025 edition) uses `base-nova` style with `@base-ui/react` primitives and oklch color tokens — the plan referenced zinc/HSL approach from shadcn v2/v3. The red-600 accent override was applied as HSL on top of the oklch dark theme, satisfying the `--primary: 0 72% 51%` requirement.
- Tailwind v4 no longer uses `tailwind.config.ts` — configuration is entirely in CSS via `@import "tailwindcss"` and `@tailwindcss/vite` plugin in vite config.
- tsconfig.json needed `@/*` path alias added before shadcn init would pass its validation step — this was a prerequisite not fully specified in the plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added path alias to tsconfig.json before shadcn init**
- **Found during:** Task 1 (shadcn init)
- **Issue:** shadcn init failed with "No import alias found in tsconfig.json" and "No Tailwind CSS configuration found" — the plan expected shadcn to work out-of-the-box but Tailwind v4 needs CSS configuration first
- **Fix:** Created `src/index.css` with `@import "tailwindcss"`, added `baseUrl` + `paths` to tsconfig.json, and added `@tailwindcss/vite` plugin to vite.config.ts before running shadcn init
- **Files modified:** packages/client/tsconfig.json, packages/client/vite.config.ts, packages/client/src/index.css
- **Verification:** shadcn init completed successfully after fixes
- **Committed in:** 5ffcd65 (Task 1 commit)

**2. [Rule 3 - Blocking] shadcn v4 base-nova style vs legacy zinc style**
- **Found during:** Task 1 (shadcn init)
- **Issue:** `shadcn@latest init --defaults` selected `base-nova` style (not the legacy zinc theme described in the plan). Components use `@base-ui/react` primitives instead of Radix UI.
- **Fix:** Accepted shadcn v4 defaults and applied the red-600 accent override (`--primary: 0 72% 51%`) inside the `.dark` block as specified, satisfying the UI-SPEC requirement while using the current shadcn version
- **Files modified:** packages/client/src/index.css
- **Verification:** vite build succeeded; --primary override confirmed in built CSS
- **Committed in:** 5ffcd65 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking issues from shadcn v4 upgrade)
**Impact on plan:** Both fixes necessary to proceed with shadcn initialization under Tailwind v4. Functional result matches plan intent exactly — zinc dark theme with red-600 accent, identical component API from consumer perspective.

## Issues Encountered

- `npx shadcn@latest init --defaults` first attempt failed: Tailwind CSS configuration not found + no import alias. Required setting up Tailwind v4 CSS configuration and tsconfig alias first — resolved with targeted prereq setup.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- shadcn component library and zinc dark theme fully established for all future UI phases
- Session store ready for 01-04 (Profile page) to consume `useSessionStore`
- Register and Login pages connect to backend auth routes implemented in 01-02
- App routes wired: /register, /login, /profile placeholder — 01-04 replaces the placeholder
- vite build passes cleanly — frontend ready for development server

---
*Phase: 01-foundation*
*Completed: 2026-03-18*
