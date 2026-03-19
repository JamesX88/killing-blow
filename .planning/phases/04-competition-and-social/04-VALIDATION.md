---
phase: 4
slug: competition-and-social
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 |
| **Config file** | vitest config in package.json (`"test": "vitest"`) |
| **Quick run command** | `pnpm --filter @killing-blow/server test --run` |
| **Full suite command** | `pnpm --filter @killing-blow/server test --run && pnpm --filter @killing-blow/client test --run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @killing-blow/server test --run`
- **After every plan wave:** Run `pnpm --filter @killing-blow/server test --run && pnpm --filter @killing-blow/client test --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 4-xx-01 | 01 | 0 | KB-02, KB-03, KB-05 | unit | `pnpm --filter @killing-blow/server test --run gateway` | ❌ W0 | ⬜ pending |
| 4-xx-02 | 01 | 0 | KB-03 | unit | `pnpm --filter @killing-blow/server test --run leaderboard` | ❌ W0 | ⬜ pending |
| 4-xx-03 | 01 | 0 | UI-03 | unit | `pnpm --filter @killing-blow/server test --run titles` | ❌ W0 | ⬜ pending |
| 4-xx-04 | 01 | 0 | UI-04 | unit | `pnpm --filter @killing-blow/server test --run bossState` | ⚠️ exists — add case | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/server/src/ws/gateway.test.ts` — extended boss:death payload tests (KB-02, KB-03, KB-05) — file exists from Phase 2, add Phase 4 test cases
- [ ] `packages/server/src/routes/leaderboard.test.ts` — covers KB-03 leaderboard query (new file)
- [ ] `packages/server/src/routes/titles.test.ts` — covers UI-03 purchase, equip, list (new file)
- [ ] `packages/server/src/game/bossState.test.ts` — add lore test case for UI-04 (file exists — add test case)
- [ ] `prisma migrate dev --name phase4-kb-currency-titles-lore` — must run before any tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Killing blow announcement visible to all connected players simultaneously | KB-02 | Multi-client UI broadcast | Open 2 browser tabs, kill boss, verify overlay appears in both simultaneously |
| Title appears next to player name in sidebar and leaderboard | UI-03 | UI rendering check | Equip title via shop, verify display in sidebar and leaderboard |
| Boss lore snippet visible during fight | UI-04 | UI rendering check | Spawn boss, verify lore/name visible in UI |
| Post-boss death screen shows top damage contributors | KB-05 | UI rendering check | After boss:death event, verify contributor list renders |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
