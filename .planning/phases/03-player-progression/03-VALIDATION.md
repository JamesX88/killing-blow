---
phase: 3
slug: player-progression
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 |
| **Config file** | `packages/server/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @killing-blow/server test --run` |
| **Full suite command** | `pnpm --filter @killing-blow/server test --run && pnpm --filter @killing-blow/shared-types test --run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @killing-blow/server test --run`
- **After every plan wave:** Run `pnpm --filter @killing-blow/server test --run && pnpm --filter @killing-blow/shared-types test --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-xx-01 | TBD | 0 | PROG-01 | unit | `pnpm --filter @killing-blow/server test --run packages/server/src/game/playerStats.test.ts` | ❌ W0 | ⬜ pending |
| 3-xx-02 | TBD | 0 | PROG-02 | unit | `pnpm --filter @killing-blow/server test --run packages/server/src/game/playerStats.test.ts` | ❌ W0 | ⬜ pending |
| 3-xx-03 | TBD | 0 | PROG-02 | integration | `pnpm --filter @killing-blow/server test --run packages/server/src/routes/upgrades.test.ts` | ❌ W0 | ⬜ pending |
| 3-xx-04 | TBD | 0 | PROG-03 | unit | `pnpm --filter @killing-blow/server test --run packages/server/src/game/playerStats.test.ts` | ❌ W0 | ⬜ pending |
| 3-xx-05 | TBD | 1 | PROG-01 | integration | `pnpm --filter @killing-blow/server test --run packages/server/src/ws/gateway.test.ts` | ✅ extend | ⬜ pending |
| 3-xx-06 | TBD | 1 | PROG-03 | integration | `pnpm --filter @killing-blow/server test --run packages/server/src/ws/gateway.test.ts` | ✅ extend | ⬜ pending |
| 3-xx-07 | TBD | 1 | PROG-04 | integration | `pnpm --filter @killing-blow/server test --run packages/server/src/ws/gateway.test.ts` | ✅ extend | ⬜ pending |
| 3-xx-08 | TBD | 1 | BOSS-04 | unit | `pnpm --filter @killing-blow/server test --run packages/server/src/game/bossState.test.ts` | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/server/src/game/playerStats.test.ts` — stubs for PROG-01 (gold credit), PROG-02 (cost formula at levels 0/10/50), PROG-03 (offline gold calc capped at 8h)
- [ ] `packages/server/src/routes/upgrades.test.ts` — stubs for PROG-02 (upgrade purchase endpoint: success, insufficient gold 400)

*(Existing `bossState.test.ts` and `gateway.test.ts` will be extended — no new files required)*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Gold balance updates visibly during fight | PROG-01 | Browser UI — requires visual confirmation | Open game, attack boss, verify gold counter increments in real-time |
| DPS increases immediately after upgrade purchase | PROG-02 | Browser UI + timing | Purchase ATK upgrade, observe DPS readout increases before next attack |
| Active tab DPS > offline rate | PROG-04 | Requires closing/reopening tab | Note DPS with tab focused; close tab 1min; reopen; verify offline gold < active rate × 60s |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
