# Stack Research

**Domain:** Browser-based multiplayer idle-incremental game (global shared boss, real-time WebSocket sync, persistent player progression)
**Researched:** 2026-03-18
**Confidence:** MEDIUM-HIGH (versions verified via npm/official sources; architectural recommendations based on multiple corroborating sources)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| React | 19.2.4 | Frontend UI framework | React 19 is the current stable, production-ready release (Dec 2024, updated Oct 2025). The component model suits a game UI with independently re-rendering HP bars, damage feeds, leaderboards, and upgrade panels. React 19's concurrent features help smooth high-frequency state updates without blocking the UI thread. Svelte is faster on micro-benchmarks but React's ecosystem depth (libraries, tooling, developer familiarity) wins for a project that will evolve over time. |
| Vite | 8.0.0 | Frontend build tool / dev server | Vite 8 ships with Rolldown (Rust-based bundler), delivering 10-30x faster builds than Webpack. Near-instant HMR is essential during game development iterations. The react-ts template scaffolds the full TypeScript setup in one command. Do not use CRA — it is abandoned. |
| TypeScript | 5.x (bundled with Vite) | Type safety across frontend and backend | Shared types between client and server (boss state shape, player stats, event payloads) prevent the class of bugs most likely to cause desync in a real-time game. Non-negotiable for a project where client and server must agree on data shapes. |
| Fastify | 5.8.2 | HTTP API server (REST endpoints: auth, player data, leaderboard) | 4-5x faster than Express in benchmarks (~87k req/s). Native TypeScript support via schemas and type providers. Handles WebSocket connections cleanly via `@fastify/websocket` plugin. Greenfield in 2025 — no reason to use Express. |
| Socket.IO | 4.8.3 | Real-time WebSocket transport (boss HP sync, damage events, kill announcements) | Socket.IO sits atop native WebSockets and adds automatic reconnection, event multiplexing, and room broadcasting. For a global single-room design, the room broadcasting feature maps directly: all connected clients subscribe to one room and receive boss state diffs in lockstep. Performs sufficiently for idle-game update rates (not a twitch FPS). uWebSockets.js is 10x faster but requires C++ compilation, has no automatic reconnect, and adds operational complexity that is not warranted at idle-game event frequencies. |
| Redis | 8.x (server) + `redis` npm 5.11.0 | Shared boss state cache + pub/sub fan-out across WebSocket server instances | Boss HP is a single hot number hit by every concurrent player — it lives in Redis, not Postgres. Redis INCRBY/DECRBY are atomic: 1000 players dealing damage simultaneously without race conditions. Redis pub/sub lets multiple WebSocket server nodes subscribe to boss update events and fan them out to their connected clients (horizontal scaling path). Redis 8.4 (Nov 2025) is the latest GA release. Use the official `redis` npm package (v5.11.0), not `ioredis` — Redis now officially maintains the node client. |
| PostgreSQL | 17 (via Neon or Supabase) | Persistent player data (accounts, gold, stats, equipment, kill history) | Player progression is relational: accounts own equipment, equipment has tiers, kills reference players and boss IDs. PostgreSQL's ACID transactions prevent partial saves (e.g., deducting gold but not granting item). JSONB columns allow flexible stat blobs without schema migrations for every new upgrade type. Use Neon (serverless, scales to zero, generous free tier, Databricks-backed) for hosted Postgres without an always-on server cost. |
| Prisma ORM | 7.5.0 | Database query layer (type-safe, migration management) | Prisma 7 removed the Rust engine dependency (simpler deploys), generates TypeScript types from the schema (shared with frontend via a shared package or monorepo), and manages migrations declaratively. Alternatives like Drizzle are lighter but Prisma's migration tooling is more mature for evolving schemas (equipment tiers, new upgrades) without downtime. |
| Zustand | 5.0.12 | Frontend client-side state management | The game UI has several independent state islands: boss HP (high-frequency WebSocket updates), player stats (low-frequency), sidebar player list (medium-frequency), and UI overlays (killing blow announcement). Zustand's selective subscriptions ensure only the components subscribed to boss HP re-render on every damage tick — not the entire tree. Redux is over-engineered for this scope; React Context causes whole-tree re-renders at game-tick frequency. |

---

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@fastify/websocket` | ^8.x | WebSocket server plugin for Fastify | Use to attach the Socket.IO adapter or raw WS server to the Fastify HTTP server so auth middleware and WS share one port |
| `@fastify/cookie` + `@fastify/session` | latest | HTTP-only session cookies for auth | Use instead of JWT in localStorage — idle game sessions persist across tabs; HttpOnly cookies prevent XSS token theft |
| `bcrypt` | ^5.x | Password hashing for player accounts | Required for any username/password auth; use 12 rounds as the cost factor |
| `zod` | ^3.x | Runtime schema validation for WebSocket events and API payloads | Validates incoming damage events server-side before applying to boss HP; prevents cheating via malformed payloads |
| `@tanstack/react-query` | ^5.x | Server-state fetching/caching (leaderboard, player profile, equipment catalog) | Use for REST API data that is not real-time — leaderboard fetches, initial player load on login. Keeps server state out of Zustand. Pair with Zustand: Zustand for live WebSocket state, React Query for HTTP request state. |
| `framer-motion` | ^11.x | Killing blow announcement animation, floating damage numbers | The killing blow moment must feel special per PROJECT.md. Framer Motion's layout animations and `AnimatePresence` handle mount/unmount of damage number overlays without custom canvas code. Use only for UI overlay effects — do not use for the HP bar itself (CSS transitions are sufficient and faster). |
| `date-fns` | ^4.x | Offline progress time calculation | Calculates elapsed seconds between `last_active` timestamp (stored in Postgres) and current time on reconnect. Lightweight alternative to moment.js (which is unmaintained). |
| `vitest` | ^3.x | Unit and integration testing | Co-located with Vite — zero config. Use to test: offline progress calculation logic, boss HP reduction math, damage event validators |
| `@types/node` + `tsx` | latest | TypeScript execution for backend development | Use `tsx` (not `ts-node`) for the Fastify server in development — it uses esbuild and is significantly faster to restart |

---

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `npm create vite@latest` with `react-ts` template | Scaffold frontend | Produces a minimal Vite + React + TypeScript project. Do not use Next.js — SSR adds no value for a WebSocket-heavy game client, and it complicates the real-time architecture. |
| ESLint + `@typescript-eslint` | Code quality enforcement | Configure to error on `any` types — critical for maintaining the shared-type contract between client and server |
| Prettier | Code formatting | Use `--single-quote --no-semi` or match team preference; commit a `.prettierrc` |
| Docker Compose | Local development environment (Redis + Postgres) | Run `redis:8-alpine` and `postgres:17-alpine` locally; mirrors production topology without paying for cloud during development |
| Neon CLI or Supabase CLI | Database branching/migration management | Neon supports database branching (create a branch for each PR) — significant safety win when evolving equipment schemas |

---

## Installation

```bash
# Frontend
npm create vite@latest killing-blow-client -- --template react-ts
cd killing-blow-client
npm install react react-dom
npm install zustand @tanstack/react-query socket.io-client framer-motion date-fns
npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom

# Backend
mkdir killing-blow-server && cd killing-blow-server
npm init -y
npm install fastify @fastify/websocket @fastify/cookie @fastify/session
npm install socket.io redis prisma @prisma/client zod bcrypt date-fns
npm install -D typescript tsx @types/node vitest

# Prisma init (run from server directory)
npx prisma init --datasource-provider postgresql
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Socket.IO 4.8 | uWebSockets.js (µWS) | If you have >50k concurrent players and are CPU-bound on WebSocket message throughput. At idle-game frequencies (1–5 updates/sec to all clients), Socket.IO's overhead is negligible. µWS requires C++ compilation per Node version — adds operational friction. |
| Socket.IO 4.8 | Native `ws` library | If you want zero abstraction and are comfortable building your own reconnect, ping/pong, and broadcast logic. Reasonable for a team that wants full control, but Socket.IO's reconnect and room broadcast are worth keeping for this project. |
| Fastify 5 | Express 4/5 | If the team has deep Express institutional knowledge and the project timeline does not allow a learning curve. Express 5 is now stable but offers no meaningful improvement over Express 4. |
| Fastify 5 | NestJS | If the team prefers Angular-style decorators and the project will grow to a large codebase with many developers. NestJS adds significant boilerplate overhead for a game backend that is mostly WebSocket handlers and a few REST endpoints. |
| React 19 | Svelte 5 | If bundle size is a critical constraint (Svelte ships ~1.6kb vs React ~44kb) or if the team has strong Svelte experience. Svelte's compile-time reactivity would handle high-frequency boss HP updates elegantly. The tradeoff: smaller ecosystem, fewer game-adjacent libraries. |
| Redis (pub/sub + atomic ops) | In-process Node.js state | If deploying a single-server architecture that will never scale horizontally. A single Node.js process can hold boss state in memory — simpler, zero infrastructure. But the moment you need two server instances (for deploys, crashes, load), in-process state is wrong. Start with Redis from day one. |
| PostgreSQL + Prisma | MongoDB | If the player data model is genuinely document-oriented (no foreign key relationships). Player accounts, equipment ownership, kill records, and gold transactions are all relational. PostgreSQL + JSONB handles the flexible stat blob use case without sacrificing transactions. |
| Neon (hosted Postgres) | Supabase | If you want an integrated backend platform with auth, realtime, and storage in one product. Supabase includes more built-in features but they mostly duplicate this stack (you already have Fastify for auth, Redis for realtime). Neon is a cleaner "just Postgres" choice that doesn't lock you into a platform. |
| Zustand 5 | Redux Toolkit | If the team is large (5+ frontend developers), the state logic is extremely complex (time-travel debugging needed), or the codebase must conform to enterprise Redux patterns. For a game client with WebSocket state and UI state, Zustand's simplicity is a significant productivity advantage. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Create React App (CRA) | Abandoned by Meta in 2023. No longer maintained, stuck on Webpack 4, broken peer dependency tree. | `npm create vite@latest` with `react-ts` template |
| `ioredis` | Still functional and at v5.10.0, but Redis has officially taken over the Node.js client via the `redis` package. New projects should not start on `ioredis` — the official client (`redis` npm) has better support and is the documented path. | `redis` npm package v5.11.0 |
| JWT in localStorage / sessionStorage | Browser storage is accessible to JavaScript — any XSS vulnerability exposes the auth token. For a browser game where users stay logged in, HttpOnly cookies with server-side sessions are more appropriate. | `@fastify/session` + HttpOnly cookies |
| Socket.IO v2 or v3 | Incompatible with v4 clients/servers. v4 has been the stable major since 2021; v4.8.3 is current. Starting a new project on v2/v3 means immediate technical debt. | Socket.IO 4.8.3 |
| WebRTC (for boss state sync) | WebRTC is peer-to-peer — unsuitable when you need a single authoritative server holding canonical boss HP. One client declaring a killing blow must be validated server-side; P2P architectures cannot enforce this without a relay server, at which point you have reconstructed a WebSocket server anyway. | Socket.IO over WebSocket |
| Next.js | SSR and file-system routing add complexity with no payoff for a WebSocket-first game client. The game's "pages" are: login screen, game screen. There is no SEO requirement. Next.js App Router + WebSocket integration has known friction. | Vite + React (SPA) |
| moment.js | Unmaintained since 2020, 67kb minified. Only needed for date arithmetic (offline progress calculation). | `date-fns` (13kb, tree-shakeable, maintained) |
| Mongoose + MongoDB | The player progression data model is naturally relational (accounts → equipment → tiers, kills → leaderboard). Document databases complicate queries like "top 10 players by lifetime boss kills" and provide no atomicity for gold transactions. | Prisma + PostgreSQL |

---

## Stack Patterns by Variant

**If the game reaches >1,000 concurrent players:**
- Horizontally scale the Fastify/Socket.IO servers behind a load balancer (nginx or AWS ALB)
- Use Redis pub/sub as the cross-instance boss event bus (already in the stack)
- Redis cluster mode handles the increased pub/sub volume
- Sticky sessions on the load balancer are NOT required because Socket.IO reconnect restores state from Redis

**If you want to skip a separate Redis instance for development:**
- Run boss state in-memory on the single Fastify process
- Use `socket.io-adapter` in default mode (no Redis adapter)
- Switch to `@socket.io/redis-adapter` before deploying to multi-instance production
- This is a clean upgrade path — the API does not change

**If authentication complexity is a concern (social login, guest accounts):**
- Add `@lucia-auth/lucia` (MIT, framework-agnostic, Postgres adapter available) on top of the Fastify session layer
- Lucia manages session lifecycle, guest-to-registered upgrade, and OAuth without pulling in a full third-party auth platform
- Avoid Auth0/Clerk for a game — external auth platforms introduce latency on every session validation and add per-MAU cost at scale

**If the team wants a monorepo (shared types between client and server):**
- Use `pnpm workspaces` with three packages: `apps/client`, `apps/server`, `packages/shared-types`
- `shared-types` exports the boss state type, event payload types, and player stat types
- Both client and server import from `@killing-blow/shared-types`
- This eliminates the most common source of real-time desync bugs

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Socket.IO 4.8.3 (server) | Socket.IO 4.x (client) | v4 client and v4 server are compatible. Do NOT mix v3 client with v4 server — handshake protocol changed. |
| Fastify 5.x | Node.js 20.19+ | Fastify 5 dropped Node.js 18. Vite 8 also requires Node.js 20.19+. Pin Node.js to 22.x LTS for both. |
| Prisma 7.5.0 | PostgreSQL 11–17 | Prisma 7 supports Postgres 17. Use `@prisma/adapter-pg` with the `pg` driver for best performance on Neon's connection pooling. |
| `redis` npm 5.11.0 | Redis server 6.x–8.x | The official node client v5 supports Redis 6, 7, and 8. Pair with Redis 8 server for latest performance. |
| React 19.2.4 | Vite 8 + `@vitejs/plugin-react` | Use `@vitejs/plugin-react` (not `@vitejs/plugin-react-swc`) with Vite 8 — the SWC plugin has an open compatibility lag with React 19 concurrent features. |
| Zustand 5.0.12 | React 18+ | Zustand 5 requires React 18 or React 19. Do not use Zustand 4 with React 19 — there are concurrent mode edge cases. |

---

## Sources

- Socket.IO npm registry — v4.8.3 confirmed current (Dec 2025 release) — HIGH confidence
- Fastify npm registry / fastify.dev — v5.8.2 confirmed current — HIGH confidence
- React release blog (react.dev) — v19.2.4 confirmed current — HIGH confidence
- Vite release blog (vite.dev) — v8.0.0 confirmed current (Rolldown bundler) — HIGH confidence
- Prisma ORM blog — v7.5.0 confirmed current; Prisma 7 is Rust-free — HIGH confidence
- Redis `redis` npm package — v5.11.0 confirmed current; officially recommended over ioredis — HIGH confidence
- Zustand npm registry — v5.0.12 confirmed current — HIGH confidence
- Ably: "Scaling Pub/Sub with WebSockets and Redis" — Redis pub/sub pattern for WebSocket fan-out — MEDIUM confidence
- Redis.io blog: "How to Create a Real-Time Online Multi-Player Strategy Game Using Redis" — boss state / atomic counter pattern — MEDIUM confidence
- Multiple 2025 framework comparison articles (DEV Community, Better Stack) — React vs Svelte, Fastify vs Express, Zustand vs Redux — MEDIUM confidence (WebSearch, corroborated by multiple sources)
- Game database architecture guide (generalistprogrammer.com, 2025) — PostgreSQL vs MongoDB for game backends — MEDIUM confidence
- Neon vs Supabase comparison sources — free tier and PostgreSQL 17 support — MEDIUM confidence

---

*Stack research for: Browser multiplayer idle-incremental game (Killing Blow)*
*Researched: 2026-03-18*
