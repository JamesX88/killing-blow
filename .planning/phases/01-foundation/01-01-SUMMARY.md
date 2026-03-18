---
phase: 01-foundation
plan: "01"
subsystem: infra
tags: [pnpm, monorepo, docker, postgres, redis, break_eternity, vitest, react, vite, fastify, prisma]

requires: []
provides:
  - pnpm monorepo with shared-types, server, and client packages
  - Docker Compose for PostgreSQL 17 + Redis 8-alpine dev services
  - formatNumber utility wrapping break_eternity.js Decimal with K/M/B/T/Qa suffixes
  - Prisma 7 schema with User + OAuthAccount models
  - vitest.config.ts in all three packages
  - Minimal React 19 client entry point
affects:
  - 01-02 (auth routes depend on Prisma schema and server package structure)
  - 01-03 (client UI depends on formatNumber and client package structure)
  - all future phases (import paths locked by monorepo layout)

tech-stack:
  added:
    - pnpm 10 workspaces
    - break_eternity.js 2.1.3
    - vitest 4.1.0
    - vite 8.0.0 + @vitejs/plugin-react
    - react 19.2.4 + react-dom + react-router-dom 7.13.1
    - zustand 5.0.12
    - fastify 5.8.2 + fastify plugins (jwt, oauth2, cookie, cors, rate-limit, websocket)
    - socket.io 4.8.3
    - prisma 7.5.0 + @prisma/client
    - redis 5.11.0
    - argon2 0.44.0
    - zod 4.3.6
  patterns:
    - formatNumber as single source of truth for all game number display
    - workspace:* protocol for inter-package dependencies
    - prisma.config.ts for Prisma 7 datasource configuration (url moved out of schema.prisma)
    - pnpm onlyBuiltDependencies for controlling native module build scripts

key-files:
  created:
    - pnpm-workspace.yaml
    - package.json (root)
    - docker-compose.yml
    - .env.example
    - .npmrc
    - packages/shared-types/src/numbers.ts
    - packages/shared-types/src/numbers.test.ts
    - packages/shared-types/src/events.ts
    - packages/shared-types/src/index.ts
    - packages/shared-types/package.json
    - packages/shared-types/tsconfig.json
    - packages/shared-types/vitest.config.ts
    - packages/server/package.json
    - packages/server/tsconfig.json
    - packages/server/vitest.config.ts
    - packages/server/prisma/schema.prisma
    - packages/server/prisma.config.ts
    - packages/client/package.json
    - packages/client/tsconfig.json
    - packages/client/vitest.config.ts
    - packages/client/vite.config.ts
    - packages/client/index.html
    - packages/client/src/main.tsx
    - packages/client/src/App.tsx
  modified: []

key-decisions:
  - "Prisma 7 requires prisma.config.ts for datasource URL — url property removed from schema.prisma datasource block"
  - "pnpm onlyBuiltDependencies in root package.json to allow argon2, esbuild, @prisma/engines native build scripts"
  - "prisma/schema.prisma created in Task 1 (not Task 2) to unblock postinstall script during pnpm install"
  - "break_eternity.js adopted as canonical Decimal type — all game numbers must flow through formatNumber"

patterns-established:
  - "Pattern: formatNumber(value) as single entry point for all displayed numbers — never render raw JS numbers"
  - "Pattern: workspace:* for cross-package imports within the monorepo"
  - "Pattern: prisma.config.ts at packages/server root for Prisma 7 datasource config"

requirements-completed:
  - UI-02

duration: 7min
completed: "2026-03-18"
---

# Phase 1 Plan 01: Monorepo Scaffold and formatNumber Summary

**pnpm monorepo with three TypeScript packages, Docker Compose for PostgreSQL 17 + Redis 8, and formatNumber utility wrapping break_eternity.js Decimal with K/M/B/T/Qa suffixes — all 13 tests pass**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-18T13:23:06Z
- **Completed:** 2026-03-18T13:30:00Z
- **Tasks:** 2
- **Files modified:** 24

## Accomplishments

- pnpm workspace with shared-types, server, and client packages — `pnpm install` succeeds with 319 packages
- Docker Compose ready to start PostgreSQL 17 and Redis 8-alpine dev services
- formatNumber utility with TDD coverage: K/M/B/T/Qa suffixes, Infinity/NaN guard, negative numbers, large Decimal values
- Prisma 7 schema with User + OAuthAccount models, prisma.config.ts for datasource URL
- vitest.config.ts in all three packages; React 19 minimal entry point in client

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold pnpm monorepo** - `82804ec` (chore)
2. **Task 2: TDD RED — failing tests for formatNumber** - `5e95fcc` (test)
3. **Task 2: TDD GREEN — implement formatNumber** - `ba8131a` (feat)

_Note: TDD task has two commits (test → feat)_

## Files Created/Modified

- `pnpm-workspace.yaml` - Monorepo workspace definition with packages/* glob
- `package.json` (root) - Workspace scripts + onlyBuiltDependencies for native builds
- `docker-compose.yml` - PostgreSQL 17 + Redis 8-alpine dev services with named volumes
- `.env.example` - All required env var keys including OAuth credentials
- `.npmrc` - Build script approval setting
- `packages/shared-types/src/numbers.ts` - formatNumber + Decimal re-export
- `packages/shared-types/src/numbers.test.ts` - 13 unit tests covering all behaviors
- `packages/shared-types/src/events.ts` - Placeholder Socket.IO event type interfaces
- `packages/shared-types/src/index.ts` - Re-exports formatNumber, Decimal, event types
- `packages/server/prisma/schema.prisma` - User + OAuthAccount Prisma models
- `packages/server/prisma.config.ts` - Prisma 7 datasource config (url moved here from schema)
- `packages/[shared-types|server|client]/vitest.config.ts` - Test runner configs
- `packages/client/vite.config.ts` - Vite 8 config with proxy to :3000
- `packages/client/index.html` - HTML entry with dark class
- `packages/client/src/main.tsx` + `App.tsx` - Minimal React 19 entry

## Decisions Made

- **Prisma 7 datasource change:** Prisma 7 removed the `url` property from `datasource` in `schema.prisma`. The connection URL must now live in `prisma.config.ts` using `defineConfig({ datasourceUrl: ... })`. This is a Prisma 7 breaking change not covered in the research doc.
- **pnpm onlyBuiltDependencies:** pnpm 10 introduced a security prompt for native build scripts (`argon2`, `esbuild`, `@prisma/engines`). Added `"pnpm": { "onlyBuiltDependencies": [...] }` to root `package.json` to explicitly allow these builds without an interactive prompt.
- **Prisma schema in Task 1:** The server's `postinstall` script runs `prisma generate`. Without `schema.prisma`, the install fails. Created the schema during Task 1 to unblock `pnpm install`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created prisma/schema.prisma during Task 1 to unblock postinstall**
- **Found during:** Task 1 (pnpm install execution)
- **Issue:** `packages/server/package.json` has `"postinstall": "prisma generate"` but no `prisma/schema.prisma` existed — install failed with "Could not find Prisma Schema"
- **Fix:** Created `packages/server/prisma/schema.prisma` with the User + OAuthAccount models from Pattern 6 in the research doc
- **Files modified:** `packages/server/prisma/schema.prisma`
- **Verification:** pnpm install completed successfully after fix
- **Committed in:** 82804ec (Task 1 commit)

**2. [Rule 1 - Bug] Updated schema.prisma for Prisma 7 datasource format change**
- **Found during:** Task 1 (second pnpm install attempt)
- **Issue:** Prisma 7 removed the `url` property from `datasource` in schema files — error P1012 "The datasource property `url` is no longer supported in schema files"
- **Fix:** Removed `url = env("DATABASE_URL")` from `datasource db` block; created `packages/server/prisma.config.ts` using `defineConfig({ datasourceUrl: process.env.DATABASE_URL })`
- **Files modified:** `packages/server/prisma/schema.prisma`, `packages/server/prisma.config.ts` (new)
- **Verification:** `prisma validate` passed; `prisma generate` succeeded; `pnpm install` clean
- **Committed in:** 82804ec (Task 1 commit)

**3. [Rule 2 - Missing Critical] Added pnpm onlyBuiltDependencies for native module build approval**
- **Found during:** Task 1 (pnpm install warning about ignored build scripts)
- **Issue:** pnpm 10 security feature blocks native module build scripts (argon2, esbuild, @prisma/engines) without explicit approval — argon2 would not compile at runtime
- **Fix:** Added `"pnpm": { "onlyBuiltDependencies": ["@prisma/engines", "argon2", "esbuild", "prisma"] }` to root `package.json`
- **Files modified:** `package.json`
- **Verification:** Re-ran `pnpm install`; all four build scripts ran successfully
- **Committed in:** 82804ec (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking, 1 bug, 1 missing critical)
**Impact on plan:** All three fixes necessary for correct operation. No scope creep. Prisma 7 breaking changes not documented in research doc; fixed inline.

## Issues Encountered

- Prisma 7 introduced two breaking changes vs. the research doc pattern: (1) datasource `url` moved to `prisma.config.ts`, (2) `prisma generate` requires the schema file during `postinstall`. Both fixed automatically.
- pnpm 10 requires explicit build script approval for native modules — handled via `onlyBuiltDependencies` in root `package.json`.

## User Setup Required

None — no external service configuration required for this plan. Docker services not started (just the compose file is created).

## Next Phase Readiness

- Monorepo structure locked — all future import paths use `@killing-blow/shared-types`, `@killing-blow/server`, `@killing-blow/client`
- formatNumber is the canonical display utility — all UI components must use it
- prisma.config.ts pattern established for all future Prisma operations
- Docker Compose ready for `docker compose up -d` when database is needed in Plan 02

---
*Phase: 01-foundation*
*Completed: 2026-03-18*
