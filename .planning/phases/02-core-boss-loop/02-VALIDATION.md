---
phase: 2
slug: core-boss-loop
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 |
| **Config file** | `packages/server/vitest.config.ts` (exists from Phase 1) |
| **Quick run command** | `pnpm --filter server test --run` |
| **Full suite command** | `pnpm -r test --run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter server test --run`
- **After every plan wave:** Run `pnpm -r test --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-W0-01 | W0 | 0 | KB-01 | unit | `pnpm --filter server test --run bossState.test` | ❌ W0 | ⬜ pending |
| 02-W0-02 | W0 | 0 | KB-04 | unit | `pnpm --filter server test --run bossState.test` | ❌ W0 | ⬜ pending |
| 02-W0-03 | W0 | 0 | BOSS-01 | integration | `pnpm --filter server test --run gateway.test` | ✅ extend | ⬜ pending |
| 02-xx-01 | TBD | 1+ | BOSS-01 | integration | `pnpm --filter server test --run gateway.test` | ✅ extend | ⬜ pending |
| 02-xx-02 | TBD | 1+ | BOSS-02 | integration | `pnpm --filter server test --run gateway.test` | ✅ extend | ⬜ pending |
| 02-xx-03 | TBD | 1+ | BOSS-03 | integration | `pnpm --filter server test --run gateway.test` | ✅ extend | ⬜ pending |
| 02-xx-04 | TBD | 1+ | KB-01 | unit | `pnpm --filter server test --run bossState.test` | ❌ W0 | ⬜ pending |
| 02-xx-05 | TBD | 1+ | KB-04 | unit | `pnpm --filter server test --run bossState.test` | ❌ W0 | ⬜ pending |
| 02-xx-06 | TBD | 1+ | UI-01 | integration | `pnpm --filter server test --run gateway.test` | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs with `TBD` will be updated once plans are created. `gateway.test.ts` exists from Phase 1 and must be EXTENDED, not replaced.*

---

## Wave 0 Requirements

- [ ] `packages/server/src/game/bossState.ts` — boss spawn, `applyDamage()` wrapping Redis Lua eval
- [ ] `packages/server/src/game/killClaim.lua` — atomic kill-claim Lua script
- [ ] `packages/server/src/game/bossState.test.ts` — unit tests for: no client damage value in `attack:intent` (KB-01); concurrent kill race returns exactly one winner (KB-01); last-1% eligibility set/not-set correctly (KB-04)
- [ ] `packages/server/src/routes/boss.ts` — stub for `GET /boss/current`
- [ ] `packages/client/src/stores/bossStore.ts` — Zustand store stub
- [ ] `packages/client/src/stores/playerStore.ts` — Zustand store stub
- [ ] `packages/client/src/components/BossHpBar.tsx` — stub component
- [ ] `packages/client/src/components/DamageNumber.tsx` — stub component
- [ ] `packages/client/src/components/PlayerSidebar.tsx` — stub component
- [ ] `packages/client/src/pages/Game.tsx` — stub page at `/game` route

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Floating damage numbers animate upward on attack | BOSS-02 | Visual CSS/motion animation | Open `/game`, click Attack Boss, verify yellow number floats up in attacker's tab only; other open tab must NOT show the number |
| Boss death animation plays before respawn | BOSS-03 | motion animation — not assertable headless | Attack boss to 0 HP solo; verify sprite fades/scales for ~400ms before new boss name appears |
| HP bar transitions smoothly (150ms) per attack | BOSS-01 | CSS transition — cannot assert in vitest | Click attack rapidly; verify bar slides not jumps |
| Defeat overlay shows "Defeated by [username]" | KB-01 | Requires live game session with kill | Attack solo to 0 HP; verify overlay shows your own username in the message |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
