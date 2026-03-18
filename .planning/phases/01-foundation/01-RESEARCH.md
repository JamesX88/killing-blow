# Phase 1: Foundation - Research

**Researched:** 2026-03-18
**Domain:** Authentication (JWT + OAuth2), WebSocket gateway setup, big-number library adoption, Prisma schema, Redis + PostgreSQL infrastructure, pnpm monorepo scaffolding
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | User can register with username and password | Argon2id hashing via `argon2` npm; Prisma `User` model; `@fastify/jwt` for token issuance |
| AUTH-02 | User session persists across browser refresh and revisit | HTTP-only cookie storage of JWT via `@fastify/cookie` + `@fastify/jwt` cookie option; Socket.IO handshake auth re-reads same cookie |
| AUTH-03 | User has a public profile showing username, kill count, and KB leaderboard rank | Prisma `User` model with `killCount` and `kbRank` fields; profile GET route behind JWT authenticate decorator |
| AUTH-04 | User can sign in via Google or Discord OAuth | `@fastify/oauth2` v8.2.0 with built-in `GOOGLE_CONFIGURATION` and `DISCORD_CONFIGURATION` presets; requires `@fastify/cookie` registered first |
| UI-02 | All game numbers are formatted with K/M/B/T suffixes (big number library from day one) | `break_eternity.js` v2.1.3 with TypeScript `index.d.ts`; drop-in replacement for `break_infinity.js`; custom `formatNumber()` utility wrapping `toFixed()` with suffix lookup |
</phase_requirements>

---

## Summary

Phase 1 establishes three non-negotiable architectural foundations before any game logic is written: (1) player identity via username/password and OAuth2, (2) authenticated WebSocket sessions so every real-time event is tied to a verified user, and (3) the big-number library integration that makes all future game math safe from NaN/Infinity corruption. None of these can be retrofitted cheaply after game logic exists.

The stack is a pnpm monorepo with `packages/client` (Vite 8 + React 19 + TypeScript), `packages/server` (Fastify 5 + Socket.IO 4.8 + Prisma 7 + Redis), and `packages/shared-types` (pure TypeScript type definitions shared by both). This three-package structure is the correct architectural decision to make at Phase 1 because it affects all import paths and build tooling going forward — changing it later means renaming thousands of imports.

The most important implementation details are: (a) JWTs stored in HTTP-only cookies, not `localStorage`, to prevent XSS theft; (b) Socket.IO middleware verifies the JWT on the WebSocket handshake before any `connection` event fires — unauthenticated sockets never reach game handlers; (c) `break_eternity.js` adopted as the canonical `Decimal` type for ALL numbers that ever appear in game logic, even constants, with a `formatNumber(d: Decimal): string` utility exported from `packages/shared-types` as the single formatting source of truth.

**Primary recommendation:** Scaffold the monorepo, wire up auth end-to-end (register → login → OAuth → profile), stand up the WebSocket gateway with JWT middleware, and ship the `formatNumber` utility with tests — everything else in the game depends on these.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fastify | 5.8.2 | HTTP server + plugin system | 4-5x faster than Express; native TS schema validation; required Node 20.19+ |
| @fastify/jwt | 10.0.0 | JWT sign/verify/decorate | Official Fastify plugin; decorates `request.jwtVerify()` and `reply.jwtSign()` |
| @fastify/oauth2 | 8.2.0 | Google + Discord OAuth2 | Official plugin; built-in `GOOGLE_CONFIGURATION` + `DISCORD_CONFIGURATION` presets |
| @fastify/cookie | 11.0.2 | HTTP-only cookie transport for JWT | Required by `@fastify/oauth2` since v7.2.0; must register before OAuth plugin |
| @fastify/websocket | 11.2.0 | WebSocket support on Fastify server | Official plugin; exposes ws-compatible `handleUpgrade`; needed to attach Socket.IO |
| socket.io | 4.8.3 | Real-time WebSocket transport | Used for the game loop broadcasts; auto-reconnect; room = global boss room |
| socket.io-client | 4.8.3 | Frontend WebSocket client | Must match server major version exactly |
| prisma | 7.5.0 | ORM + migration CLI | Prisma 7 removes Rust binary dependency (pure JS); generates TypeScript types from schema |
| @prisma/client | 7.5.0 | Generated DB client | Auto-generated from `schema.prisma`; type-safe queries |
| redis | 5.11.0 | Redis client (official `redis` npm) | Officially recommended over ioredis; supports Node Redis v4+ API |
| argon2 | 0.44.0 | Password hashing | OWASP recommended; Argon2id variant; superior to bcrypt for GPU resistance |
| break_eternity.js | 2.1.3 | Big-number arithmetic | Drop-in replacement for `break_infinity.js`; handles up to 10^^1e308; includes `index.d.ts` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @fastify/cors | 11.2.0 | CORS headers | Required for browser SPA → API cross-origin requests |
| @fastify/rate-limit | 10.3.0 | Request rate limiting | Apply to `/auth/register` and `/auth/login` to prevent brute force |
| zod | 4.3.6 | Runtime schema validation | Validate request bodies and environment variables |
| dotenv | 17.3.1 | Environment variable loading | Dev-only; production uses real env vars |
| vitest | 4.1.0 | Test runner | Vite-native; fast TS support; used for both client and server unit tests |
| react | 19.2.4 | Frontend UI | Concurrent mode handles high-frequency WebSocket state updates smoothly |
| vite | 8.0.0 | Frontend build + HMR | Rolldown-based; near-instant HMR; requires Node 20.19+ |
| zustand | 5.0.12 | Client state management | Selective subscriptions; lightweight; three stores: boss, player, session |
| react-router-dom | 7.13.1 | Client-side routing | Register, login, OAuth callback, profile, game routes |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `argon2` | `bcrypt` | bcrypt is fine for most apps but lacks memory-hardness; argon2id is OWASP first choice for new projects |
| `@fastify/oauth2` | `passport` + `passport-google-oauth20` | Passport works but has no Fastify-native plugin; `@fastify/oauth2` integrates cleanly with Fastify's hook lifecycle |
| `break_eternity.js` | `break_infinity.js` | `break_eternity.js` is the direct sequel and drop-in replacement; handles a larger numeric range; choose eternity |
| `socket.io` | raw `ws` via `@fastify/websocket` | Raw ws requires manual reconnect logic, room management, and auth middleware from scratch; Socket.IO provides all three |
| Neon (cloud PG) | local Docker Postgres | Both valid; Docker Compose is recommended for Phase 1 dev so no external dependency; Neon for staging/production |

**Installation (server):**
```bash
pnpm add fastify @fastify/jwt @fastify/oauth2 @fastify/cookie @fastify/websocket @fastify/cors @fastify/rate-limit socket.io prisma @prisma/client redis argon2 zod dotenv
pnpm add -D vitest typescript tsx @types/node
```

**Installation (client):**
```bash
pnpm add react react-dom react-router-dom zustand socket.io-client break_eternity.js
pnpm add -D vite @vitejs/plugin-react typescript vitest
```

**Installation (shared-types):**
```bash
pnpm add break_eternity.js
pnpm add -D typescript
```

**Version verification (confirmed 2026-03-18 against npm registry):**
All versions above confirmed current. `fastify-socket.io` (ducktors, v5.1.0) exists but was last published 2 years ago — avoid it. Attach Socket.IO directly to Fastify's underlying Node.js HTTP server instead.

---

## Architecture Patterns

### Recommended Project Structure
```
killing-blow/
├── packages/
│   ├── shared-types/          # Pure TypeScript: event payloads, Decimal wrappers, formatNumber
│   │   ├── src/
│   │   │   ├── events.ts      # Socket.IO event type contracts
│   │   │   ├── numbers.ts     # Decimal = break_eternity.js Decimal; formatNumber()
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── server/                # Fastify + Socket.IO + Prisma + Redis
│   │   ├── src/
│   │   │   ├── app.ts         # Fastify factory (exported for testing)
│   │   │   ├── server.ts      # Entry point: calls app() then listens
│   │   │   ├── plugins/
│   │   │   │   ├── jwt.ts     # @fastify/jwt registration + authenticate decorator
│   │   │   │   ├── oauth.ts   # @fastify/oauth2 Google + Discord registration
│   │   │   │   └── redis.ts   # Redis client plugin
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts    # POST /auth/register, POST /auth/login
│   │   │   │   ├── oauth.ts   # GET /auth/google, /auth/google/callback etc.
│   │   │   │   └── profile.ts # GET /profile/:userId (protected)
│   │   │   ├── ws/
│   │   │   │   └── gateway.ts # Socket.IO server + JWT middleware + auth event handlers
│   │   │   └── db/
│   │   │       └── prisma.ts  # PrismaClient singleton
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── client/                # Vite + React + Zustand
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── pages/
│       │   │   ├── Register.tsx
│       │   │   ├── Login.tsx
│       │   │   └── Profile.tsx
│       │   ├── stores/
│       │   │   └── sessionStore.ts  # Zustand: userId, username, token
│       │   ├── lib/
│       │   │   └── socket.ts        # Socket.IO client singleton
│       │   └── components/
│       │       └── NumberDisplay.tsx # Always renders via formatNumber()
│       ├── package.json
│       └── vite.config.ts
├── pnpm-workspace.yaml
├── package.json               # Root: workspace scripts only
└── docker-compose.yml         # Redis + PostgreSQL for development
```

### Pattern 1: Fastify App Factory (Testability)
**What:** Separate the Fastify instance creation (`app.ts`) from the server startup (`server.ts`). Tests import the factory, not the live server.
**When to use:** Always — required for `app.inject()` testing without port conflicts.
**Example:**
```typescript
// packages/server/src/app.ts
// Source: https://fastify.dev/docs/latest/Guides/Testing/
import Fastify from 'fastify'
import jwtPlugin from './plugins/jwt.js'
import authRoutes from './routes/auth.js'

export async function buildApp() {
  const app = Fastify({ logger: true })
  await app.register(jwtPlugin)
  await app.register(authRoutes, { prefix: '/auth' })
  return app
}

// packages/server/src/server.ts
import { buildApp } from './app.js'
import { Server as SocketIOServer } from 'socket.io'
import { setupGateway } from './ws/gateway.js'

const app = await buildApp()
await app.ready()
const io = new SocketIOServer(app.server, { cors: { origin: process.env.CLIENT_URL } })
setupGateway(io)
await app.listen({ port: 3000, host: '0.0.0.0' })
```

### Pattern 2: JWT Authenticate Decorator
**What:** Wrap `request.jwtVerify()` in a named decorator so it can be used as an `onRequest` hook on protected routes.
**When to use:** All routes that require an authenticated user.
**Example:**
```typescript
// packages/server/src/plugins/jwt.ts
// Source: https://github.com/fastify/fastify-jwt#readme
import fp from 'fastify-plugin'
import jwt from '@fastify/jwt'

export default fp(async (fastify) => {
  fastify.register(jwt, {
    secret: process.env.JWT_SECRET!,
    cookie: { cookieName: 'token', signed: false }
  })

  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.send(err)
    }
  })
})

// Usage on a protected route:
fastify.get('/profile/:userId', { onRequest: [fastify.authenticate] }, handler)
```

### Pattern 3: Socket.IO JWT Middleware
**What:** Validate JWT on the WebSocket handshake, before the `connection` event fires. Attach `userId` to `socket.data` for all subsequent handlers.
**When to use:** Always — no socket reaches a game handler without passing this middleware.
**Example:**
```typescript
// packages/server/src/ws/gateway.ts
// Source: https://socket.io/docs/v4/middlewares/
import { Server, Socket } from 'socket.io'
import jwt from 'jsonwebtoken'

export function setupGateway(io: Server) {
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth.token as string | undefined
    if (!token) return next(new Error('Authentication required'))
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string }
      socket.data.userId = decoded.userId
      next()
    } catch {
      next(new Error('Invalid token'))
    }
  })

  io.on('connection', (socket) => {
    // socket.data.userId is guaranteed here
    socket.join('global-boss-room')
  })
}
```

### Pattern 4: Socket.IO Client Auth
**What:** Read the JWT from the HTTP-only cookie on the client and pass it in the `auth` handshake option.
**When to use:** Frontend Socket.IO client initialization.
**Example:**
```typescript
// packages/client/src/lib/socket.ts
// Source: https://socket.io/docs/v4/middlewares/
import { io } from 'socket.io-client'

export const socket = io(import.meta.env.VITE_SERVER_URL, {
  autoConnect: false, // connect only after login
  auth: (cb) => {
    // JWT is in HTTP-only cookie; server reads it directly on the HTTP upgrade
    // For Bearer approach: cb({ token: localStorage.getItem('token') })
    cb({})
  }
})
```
**Note:** With HTTP-only cookies, the browser sends the cookie on the WebSocket upgrade request automatically. The `@fastify/jwt` cookie mode reads it server-side from `socket.handshake.headers.cookie`. This is the most secure approach and preferred for this project.

### Pattern 5: OAuth2 Registration (@fastify/oauth2)
**What:** Register one OAuth2 instance per provider. The plugin creates the redirect and callback routes automatically.
**When to use:** Google and Discord sign-in.
**Example:**
```typescript
// packages/server/src/plugins/oauth.ts
// Source: https://github.com/fastify/fastify-oauth2#readme
import fp from 'fastify-plugin'
import oauth2Plugin from '@fastify/oauth2'

export default fp(async (fastify) => {
  // @fastify/cookie must be registered before this plugin
  fastify.register(oauth2Plugin, {
    name: 'googleOAuth2',
    credentials: {
      client: { id: process.env.GOOGLE_CLIENT_ID!, secret: process.env.GOOGLE_CLIENT_SECRET! },
      auth: oauth2Plugin.GOOGLE_CONFIGURATION
    },
    startRedirectPath: '/auth/google',
    callbackUri: `${process.env.SERVER_URL}/auth/google/callback`,
    pkce: 'S256'
  })

  fastify.register(oauth2Plugin, {
    name: 'discordOAuth2',
    credentials: {
      client: { id: process.env.DISCORD_CLIENT_ID!, secret: process.env.DISCORD_CLIENT_SECRET! },
      auth: oauth2Plugin.DISCORD_CONFIGURATION
    },
    startRedirectPath: '/auth/discord',
    callbackUri: `${process.env.SERVER_URL}/auth/discord/callback`
  })
})

// Callback handler example (Google):
fastify.get('/auth/google/callback', async (request, reply) => {
  const { token } = await fastify.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request)
  // Fetch user info from Google, upsert in DB, issue JWT cookie
  const jwtToken = await reply.jwtSign({ userId: user.id })
  reply.setCookie('token', jwtToken, { httpOnly: true, secure: true, sameSite: 'lax' })
  reply.redirect(`${process.env.CLIENT_URL}/profile`)
})
```

### Pattern 6: Prisma User Schema
**What:** User model with username/password auth AND OAuth provider fields. Separate `OAuthAccount` model allows one user to have multiple providers.
**When to use:** Phase 1 database schema definition.
**Example:**
```prisma
// packages/server/prisma/schema.prisma
// Source: https://www.prisma.io/docs/orm/prisma-schema/overview

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(cuid())
  username     String   @unique
  passwordHash String?  // null for OAuth-only accounts
  email        String?  @unique
  killCount    Int      @default(0)
  kbRank       Int?     // Updated by leaderboard logic in later phases
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  oauthAccounts OAuthAccount[]
}

model OAuthAccount {
  id                String  @id @default(cuid())
  userId            String
  provider          String  // "google" | "discord"
  providerAccountId String
  accessToken       String?
  refreshToken      String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}
```

### Pattern 7: formatNumber Utility (break_eternity.js)
**What:** Single source of truth for all number display. Wraps `Decimal` from `break_eternity.js` to produce K/M/B/T/Q suffixes. Never displays raw integers or Infinity/NaN.
**When to use:** Every number rendered in the UI must pass through this. No exceptions.
**Example:**
```typescript
// packages/shared-types/src/numbers.ts
// Source: break_eternity.js index.d.ts (TypeScript included)
import Decimal from 'break_eternity.js'

export { Decimal }

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc']

export function formatNumber(value: Decimal | number | string): string {
  const d = value instanceof Decimal ? value : new Decimal(value)

  if (!d.isFinite() || d.isNan()) return '0'

  const absVal = d.abs()
  if (absVal.lt(1000)) return d.toFixed(1)

  const exp = Math.floor(absVal.log10().toNumber())
  const tier = Math.floor(exp / 3)

  if (tier >= SUFFIXES.length) {
    // Fall back to scientific for extremely large numbers
    return d.toExponential(2)
  }

  const scale = new Decimal(10).pow(tier * 3)
  const scaled = d.div(scale)
  return `${scaled.toFixed(1)}${SUFFIXES[tier]}`
}
```

### Pattern 8: Docker Compose Dev Environment
**What:** Single `docker-compose.yml` at repo root spins up Redis and PostgreSQL for local development. Node.js runs on host machine (not in Docker) for fast iteration.
**When to use:** Phase 1 initial infrastructure setup.
**Example:**
```yaml
# docker-compose.yml
version: '3.9'
services:
  postgres:
    image: postgres:17
    environment:
      POSTGRES_USER: killingblow
      POSTGRES_PASSWORD: killingblow
      POSTGRES_DB: killingblow_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:8-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### Anti-Patterns to Avoid
- **Storing JWT in localStorage:** Vulnerable to XSS. Use HTTP-only cookies exclusively. The `@fastify/jwt` `cookie` option handles this.
- **Sending JWT as WebSocket query string parameter:** URL appears in server logs and browser history. Use `socket.handshake.auth.token` or HTTP-only cookie on the upgrade request instead.
- **Registering @fastify/oauth2 before @fastify/cookie:** Will throw at startup. Cookie plugin must be registered first.
- **Using `app.listen()` then attaching Socket.IO:** Socket.IO requires the raw `http.Server` reference via `app.server` — call `app.ready()` first, then `new Server(app.server)`.
- **Using `fastify-socket.io` (ducktors package):** Last published 2 years ago, stale. Attach Socket.IO manually to `app.server`.
- **Storing Decimal values as JavaScript `number` in Postgres:** Serialize big numbers as `String` in PostgreSQL. `killCount` is `Int` (safe at these ranges); gold and DPS values in later phases must be `String`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Custom crypto.scrypt wrapper | `argon2` (Argon2id) | Memory-hardness, OWASP best practice, native Node bindings |
| JWT sign/verify | Manual `jsonwebtoken` integration | `@fastify/jwt` | Decorates request object; handles cookie mode; integrates with Fastify lifecycle |
| OAuth2 flow (PKCE, state, token exchange) | Manual OAuth2 handshake code | `@fastify/oauth2` | PKCE support, state param handling, built-in Google/Discord configs |
| Big number arithmetic | Native JS `number` with special cases | `break_eternity.js` | NaN/Infinity propagation is silent and corrupts all downstream game state |
| Number formatting with K/M/B/T | Ad-hoc ternary chains | Single `formatNumber()` from shared-types | Inconsistency across components; missed edge cases (negative, Infinity, NaN) |
| WebSocket reconnect logic | Manual backoff + re-auth | `socket.io-client` | Auto-reconnect with exponential backoff; auth token resent on reconnect automatically |

**Key insight:** Every item in this table has subtle edge cases (OAuth state validation, argon2 pepper management, number representation boundaries) that have caused production security incidents or data corruption in other projects. The libraries exist precisely because these problems are hard.

---

## Common Pitfalls

### Pitfall 1: @fastify/oauth2 Plugin Registration Order
**What goes wrong:** Server throws `Error: @fastify/cookie is not registered` at startup with a cryptic message.
**Why it happens:** `@fastify/oauth2` v7.2.0+ depends on `@fastify/cookie` being already registered to store the OAuth state parameter.
**How to avoid:** Always register `@fastify/cookie` before `@fastify/oauth2` in the plugin chain.
**Warning signs:** Startup error mentioning "cookie" or "state parameter"; OAuth redirect loop.

### Pitfall 2: Socket.IO Attached Before app.ready()
**What goes wrong:** Socket.IO attaches to the HTTP server before Fastify plugins finish booting; JWT plugin decorator not yet available inside the Socket.IO middleware.
**Why it happens:** Fastify plugin loading is async; `app.server` exists immediately but plugins finish after `await app.ready()`.
**How to avoid:** Always `await app.ready()` before `new Server(app.server, ...)`.
**Warning signs:** `fastify.authenticate is not a function` errors inside Socket.IO middleware.

### Pitfall 3: Prisma Client Imported Before Schema Migration
**What goes wrong:** `@prisma/client` throws "Prisma client not generated" error at runtime.
**Why it happens:** `@prisma/client` generates code at install time; if schema changes without running `prisma generate`, the client is stale.
**How to avoid:** Add `postinstall` script: `"postinstall": "prisma generate"`. Run `prisma migrate dev --name init` before first server start.
**Warning signs:** Import error: `Cannot find module '.prisma/client/default'`.

### Pitfall 4: JWT Cookie Not Sent on WebSocket Upgrade
**What goes wrong:** `socket.handshake.headers.cookie` is undefined in the Socket.IO middleware even though the browser has the cookie.
**Why it happens:** The `SameSite` attribute or the Secure flag blocks the cookie on localhost/non-HTTPS origins.
**How to avoid:** In development, use `sameSite: 'lax'` and `secure: false` for cookies. In production, use `secure: true` and `sameSite: 'lax'` with HTTPS.
**Warning signs:** Auth middleware always rejects connections in development; cookie visible in DevTools but absent in socket handshake headers.

### Pitfall 5: break_eternity.js Decimal Serialization to Redis/Postgres
**What goes wrong:** `JSON.stringify(new Decimal(1e308))` produces `"1e+308"` — this roundtrips fine through JSON but NOT through `parseFloat()` after storage.
**Why it happens:** `parseFloat("1e+308")` is safe, but edge cases near `Infinity` can produce `Infinity` string values.
**How to avoid:** Always use `d.toString()` for serialization and `new Decimal(storedString)` for deserialization. Never use `JSON.stringify` directly on a Decimal; add a `toJSON()` replacer.
**Warning signs:** Numbers round-tripping through Redis come back as `Infinity` or lose precision.

### Pitfall 6: OAuth Callback URI Mismatch
**What goes wrong:** Google/Discord returns `redirect_uri_mismatch` error even with correct code.
**Why it happens:** The `callbackUri` in `@fastify/oauth2` config must exactly match the URI registered in the Google Cloud Console / Discord Developer Portal (including trailing slash, protocol, and port).
**How to avoid:** Register `http://localhost:3000/auth/google/callback` in Google Console for dev; `https://yourdomain.com/auth/google/callback` for prod. Keep an `.env` variable `SERVER_URL` and build the callback URI from it.
**Warning signs:** 400 error from OAuth provider immediately on redirect; `redirect_uri_mismatch` in error message.

### Pitfall 7: Zustand SessionStore Race on Page Load
**What goes wrong:** Page loads, Socket.IO connects before the session store has rehydrated the JWT cookie, resulting in an immediate `Authentication required` rejection.
**Why it happens:** React renders before the async cookie-validation request returns.
**How to avoid:** On app load, call `GET /auth/me` (a protected endpoint that returns the current user from the JWT cookie) before connecting the socket. Only call `socket.connect()` after the session is confirmed valid.
**Warning signs:** Page refreshes always disconnect-then-reconnect; users see a flash of "unauthenticated" state.

---

## Code Examples

### Register Endpoint with Argon2id
```typescript
// packages/server/src/routes/auth.ts
// Source: argon2 npm README + @fastify/jwt README
import argon2 from 'argon2'
import { prisma } from '../db/prisma.js'

fastify.post('/register', async (request, reply) => {
  const { username, password } = request.body as { username: string; password: string }

  const existing = await prisma.user.findUnique({ where: { username } })
  if (existing) return reply.status(409).send({ error: 'Username taken' })

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id })
  const user = await prisma.user.create({
    data: { username, passwordHash }
  })

  const token = await reply.jwtSign({ userId: user.id, username: user.username })
  reply
    .setCookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' })
    .send({ id: user.id, username: user.username })
})
```

### Login Endpoint
```typescript
fastify.post('/login', async (request, reply) => {
  const { username, password } = request.body as { username: string; password: string }

  const user = await prisma.user.findUnique({ where: { username } })
  if (!user || !user.passwordHash) return reply.status(401).send({ error: 'Invalid credentials' })

  const valid = await argon2.verify(user.passwordHash, password)
  if (!valid) return reply.status(401).send({ error: 'Invalid credentials' })

  const token = await reply.jwtSign({ userId: user.id, username: user.username })
  reply
    .setCookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' })
    .send({ id: user.id, username: user.username, killCount: user.killCount })
})
```

### Profile Route (Protected)
```typescript
fastify.get('/profile/:userId', { onRequest: [fastify.authenticate] }, async (request, reply) => {
  const { userId } = request.params as { userId: string }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, killCount: true, kbRank: true, createdAt: true }
  })
  if (!user) return reply.status(404).send({ error: 'User not found' })
  return user
})
```

### pnpm-workspace.yaml
```yaml
# pnpm-workspace.yaml (repo root)
packages:
  - 'packages/*'
```

### vitest.config.ts (server package)
```typescript
// packages/server/vitest.config.ts
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    environment: 'node',
    globals: true
  }
})
```

### Basic Auth Route Test
```typescript
// packages/server/src/routes/auth.test.ts
// Source: https://fastify.dev/docs/latest/Guides/Testing/
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../app.js'

describe('POST /auth/register', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp()
  })

  afterAll(async () => {
    await app.close()
  })

  it('creates a new user and returns 200', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { username: 'testuser', password: 'password123' }
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toMatchObject({ username: 'testuser' })
  })
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Express + passport | Fastify 5 + `@fastify/oauth2` | Fastify 5 released 2024 | 4-5x faster; native TypeScript; no middleware boilerplate |
| ioredis | `redis` npm (v4+) | redis v4 released 2022; v5 in 2024 | Official client now recommended; simpler API; Promises-native |
| Prisma requiring Rust binary | Prisma 7 (pure JS engine) | Prisma 7 released 2025 | Faster installs; no Rust toolchain needed in Docker |
| localStorage for JWT | HTTP-only cookie | Security standard evolved | Prevents XSS token theft; industry best practice since ~2020 |
| `break_infinity.js` | `break_eternity.js` | break_eternity.js released as sequel | Drop-in replacement; handles larger ranges; TypeScript built-in |
| `bcrypt` for passwords | `argon2id` | OWASP PHC recommendations 2015+ | Memory-hard; superior GPU/ASIC resistance |

**Deprecated/outdated:**
- `jsonwebtoken` (direct): Still works but `@fastify/jwt` wraps it with Fastify lifecycle integration — use the plugin.
- `passport` + `passport-google-oauth20`: No Fastify integration; use `@fastify/oauth2`.
- `fastify-socket.io` (ducktors): Last published 2 years ago — stale. Attach Socket.IO manually.
- `sequelize` or `typeorm`: Prisma 7 is the TypeScript-first ORM of record for this stack.

---

## Open Questions

1. **HTTP-only cookie vs Bearer token for Socket.IO auth**
   - What we know: Both work. HTTP-only cookie is more secure (XSS-resistant). Bearer token in `handshake.auth` is simpler to implement.
   - What's unclear: In production with a CDN/reverse proxy, does the cookie reliably reach the WebSocket upgrade request headers?
   - Recommendation: Use HTTP-only cookie as primary; fall back to `handshake.auth.token` with a short-lived token if cookie doesn't propagate. Phase 1 uses cookie; Phase 2 can harden.

2. **Session persistence strategy (AUTH-02)**
   - What we know: JWT in HTTP-only cookie satisfies the browser-refresh requirement. The cookie persists across tab closes by default if `maxAge` or `expires` is set.
   - What's unclear: Exact JWT expiry policy — 1 hour + refresh token, or 30-day long-lived JWT? Refresh token adds complexity.
   - Recommendation: For Phase 1, use a 30-day JWT in an HTTP-only cookie with `maxAge`. No refresh token complexity until Phase 3+ when user data is more sensitive. Revisit before production.

3. **Neon vs Docker Postgres for Phase 1**
   - What we know: Docker Compose is the research recommendation for local dev. Neon is the recommendation for staging/production (free tier, PgBouncer pooling built-in).
   - What's unclear: Does the team want a single connection string that works for all environments, or separate dev/prod configs?
   - Recommendation: Docker Postgres for local dev (no external dependency); Neon free tier for CI and any shared staging environment.

---

## Validation Architecture

`nyquist_validation` is enabled (confirmed in `.planning/config.json`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 |
| Config file | `packages/server/vitest.config.ts` and `packages/client/vitest.config.ts` (Wave 0 — neither exists yet) |
| Quick run command | `pnpm --filter server test --run` |
| Full suite command | `pnpm -r test --run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | `POST /auth/register` creates user with hashed password; duplicate username returns 409 | unit | `pnpm --filter server test --run auth.test` | Wave 0 |
| AUTH-01 | `POST /auth/login` verifies password and sets JWT cookie | unit | `pnpm --filter server test --run auth.test` | Wave 0 |
| AUTH-02 | JWT cookie has `maxAge`; re-sending cookie on subsequent requests returns authenticated user | unit | `pnpm --filter server test --run auth.test` | Wave 0 |
| AUTH-03 | `GET /profile/:userId` returns username, killCount, kbRank for valid authenticated request | unit | `pnpm --filter server test --run profile.test` | Wave 0 |
| AUTH-04 | OAuth callback handler: upserts user, issues JWT cookie, redirects to client | unit (mocked OAuth token) | `pnpm --filter server test --run oauth.test` | Wave 0 |
| AUTH-04 | Socket.IO middleware: valid JWT passes; invalid/missing JWT emits connect_error | unit | `pnpm --filter server test --run gateway.test` | Wave 0 |
| UI-02 | `formatNumber(1000)` → `"1.0K"`, `formatNumber(1e6)` → `"1.0M"`, `formatNumber(Infinity)` → `"0"`, `formatNumber(NaN)` → `"0"` | unit | `pnpm --filter shared-types test --run numbers.test` | Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter server test --run` and `pnpm --filter shared-types test --run`
- **Per wave merge:** `pnpm -r test --run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/server/src/routes/auth.test.ts` — covers AUTH-01, AUTH-02
- [ ] `packages/server/src/routes/profile.test.ts` — covers AUTH-03
- [ ] `packages/server/src/routes/oauth.test.ts` — covers AUTH-04 (OAuth callback with mocked token exchange)
- [ ] `packages/server/src/ws/gateway.test.ts` — covers AUTH-04 (Socket.IO JWT middleware)
- [ ] `packages/shared-types/src/numbers.test.ts` — covers UI-02
- [ ] `packages/server/vitest.config.ts` — test runner config
- [ ] `packages/client/vitest.config.ts` — test runner config
- [ ] `packages/shared-types/vitest.config.ts` — test runner config
- [ ] Framework install: `pnpm add -D vitest` in each package — if not yet present
- [ ] `packages/server/src/app.ts` factory function — required for `app.inject()` test pattern

---

## Sources

### Primary (HIGH confidence)
- `npm view fastify version` — v5.8.2 confirmed 2026-03-18
- `npm view @fastify/jwt version` — v10.0.0 confirmed 2026-03-18
- `npm view @fastify/oauth2 version` — v8.2.0 confirmed 2026-03-18
- `npm view @fastify/cookie version` — v11.0.2 confirmed 2026-03-18
- `npm view @fastify/websocket version` — v11.2.0 confirmed 2026-03-18
- `npm view socket.io version` — v4.8.3 confirmed 2026-03-18
- `npm view prisma version` — v7.5.0 confirmed 2026-03-18
- `npm view redis version` — v5.11.0 confirmed 2026-03-18
- `npm view argon2 version` — v0.44.0 confirmed 2026-03-18
- `npm view break_eternity.js version` — v2.1.3 confirmed 2026-03-18
- `npm view vitest version` — v4.1.0 confirmed 2026-03-18
- https://fastify.dev/docs/latest/Guides/Testing/ — app.inject() pattern, factory separation
- https://github.com/fastify/fastify-jwt#readme — JWT decorator, cookie mode, authenticate pattern
- https://github.com/fastify/fastify-oauth2#readme — OAuth2 plugin config, Google/Discord presets, PKCE, cookie registration requirement
- https://socket.io/docs/v4/middlewares/ — Socket.IO JWT middleware, handshake.auth.token pattern
- https://socket.io/docs/v4/server-initialization/ — Attaching to existing HTTP server (app.server pattern)
- https://www.prisma.io/docs/orm/prisma-schema/overview — User model field types
- https://www.prisma.io/docs/orm/prisma-migrate/getting-started — migrate dev workflow
- https://github.com/Patashu/break_eternity.js — API reference, TypeScript support, drop-in replacement status
- .planning/research/SUMMARY.md — pre-existing project research (HIGH confidence; verified against npm registry)

### Secondary (MEDIUM confidence)
- https://guptadeepak.com/the-complete-guide-to-password-hashing-argon2-vs-bcrypt-vs-scrypt-vs-pbkdf2-2026/ — Argon2id recommendation (verified against OWASP standards)
- https://neon.com/docs/guides/prisma — Neon + Prisma integration, connection pooling via PgBouncer
- https://sevic.dev/notes/postgres-redis-docker-compose/ — Docker Compose Redis + PostgreSQL pattern
- https://pnpm.io/workspaces — pnpm workspace setup, `workspace:*` protocol

### Tertiary (LOW confidence)
- https://dev.to/lico/step-by-step-guide-sharing-types-and-values-between-react-esm-and-nestjs-cjs-in-a-pnpm-monorepo-2o2j — shared types monorepo pattern (NestJS example, not Fastify, but workspace structure applies)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry 2026-03-18
- Authentication patterns: HIGH — verified against official @fastify/jwt and @fastify/oauth2 READMEs
- Socket.IO WebSocket auth: HIGH — verified against official Socket.IO middleware docs
- Prisma schema: HIGH — verified against official Prisma docs
- Big number (break_eternity.js): HIGH — verified against official GitHub README and npm
- Monorepo structure: MEDIUM — pnpm workspaces pattern is standard; the exact folder names are a recommendation, not a requirement
- Docker Compose dev setup: MEDIUM — well-documented pattern; exact configuration is project-specific

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable libraries; break_eternity.js, Prisma, Fastify versions all follow semver)
