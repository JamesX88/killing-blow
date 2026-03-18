---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 |
| **Config file** | `packages/server/vitest.config.ts` and `packages/shared-types/vitest.config.ts` (Wave 0 — neither exists yet) |
| **Quick run command** | `pnpm --filter server test --run` |
| **Full suite command** | `pnpm -r test --run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter server test --run` and `pnpm --filter shared-types test --run`
- **After every plan wave:** Run `pnpm -r test --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 0 | AUTH-01 | unit | `pnpm --filter server test --run auth.test` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 0 | AUTH-01 | unit | `pnpm --filter server test --run auth.test` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 0 | AUTH-02 | unit | `pnpm --filter server test --run auth.test` | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 0 | AUTH-03 | unit | `pnpm --filter server test --run profile.test` | ❌ W0 | ⬜ pending |
| 1-01-05 | 01 | 0 | AUTH-04 | unit | `pnpm --filter server test --run oauth.test` | ❌ W0 | ⬜ pending |
| 1-01-06 | 01 | 0 | AUTH-04 | unit | `pnpm --filter server test --run gateway.test` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 0 | UI-02 | unit | `pnpm --filter shared-types test --run numbers.test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/server/src/routes/auth.test.ts` — stubs for AUTH-01, AUTH-02
- [ ] `packages/server/src/routes/profile.test.ts` — stubs for AUTH-03
- [ ] `packages/server/src/routes/oauth.test.ts` — stubs for AUTH-04 (OAuth callback with mocked token exchange)
- [ ] `packages/server/src/ws/gateway.test.ts` — stubs for AUTH-04 (Socket.IO JWT middleware)
- [ ] `packages/shared-types/src/numbers.test.ts` — stubs for UI-02
- [ ] `packages/server/vitest.config.ts` — test runner config
- [ ] `packages/client/vitest.config.ts` — test runner config
- [ ] `packages/shared-types/vitest.config.ts` — test runner config
- [ ] Framework install: `pnpm add -D vitest` in each package — if not present
- [ ] `packages/server/src/app.ts` factory function — required for `app.inject()` test pattern

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Google OAuth redirect and callback flow | AUTH-04 | Requires live Google OAuth credentials and browser interaction | 1. Click "Sign in with Google" 2. Authenticate with a Google account 3. Verify redirect to `/profile` 4. Verify JWT cookie is set in DevTools |
| Discord OAuth redirect and callback flow | AUTH-04 | Requires live Discord OAuth credentials and browser interaction | 1. Click "Sign in with Discord" 2. Authenticate with a Discord account 3. Verify redirect to `/profile` 4. Verify JWT cookie is set in DevTools |
| Session persists across browser refresh | AUTH-02 | Requires live browser state | 1. Log in 2. Refresh the page (F5) 3. Verify user remains authenticated without re-login |
| Session persists after closing and reopening tab | AUTH-02 | Requires live browser state | 1. Log in 2. Close the tab 3. Reopen the app URL 4. Verify user is still authenticated |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
