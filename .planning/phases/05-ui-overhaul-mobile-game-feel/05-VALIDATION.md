---
phase: 5
slug: ui-overhaul-mobile-game-feel
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 |
| **Config file** | `packages/client/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @killing-blow/client test --run` |
| **Full suite command** | `pnpm --filter @killing-blow/client test --run` |
| **Estimated runtime** | ~2 seconds (passes with no tests via --passWithNoTests) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @killing-blow/client test --run`
- **After every plan wave:** Run `pnpm --filter @killing-blow/client test --run` + manual browser smoke test on Chrome mobile emulator
- **Before `/gsd:verify-work`:** Full suite green + manual browser verification
- **Max feedback latency:** ~2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 1 | CSS tokens | manual | visual inspection | ✅ | ⬜ pending |
| 5-01-02 | 01 | 1 | DungeonBackground | smoke | `pnpm --filter @killing-blow/client test --run` | ❌ W0 | ⬜ pending |
| 5-01-03 | 01 | 1 | KillFlashOverlay | smoke | `pnpm --filter @killing-blow/client test --run` | ❌ W0 | ⬜ pending |
| 5-01-04 | 01 | 1 | App.tsx bg remove | manual | browser load non-game routes | ✅ | ⬜ pending |
| 5-02-01 | 02 | 2 | BossHpBar spec | manual | visual inspection in browser | ✅ | ⬜ pending |
| 5-02-02 | 02 | 2 | BossSprite silhouettes | unit | `pnpm --filter @killing-blow/client test --run` | ❌ W0 | ⬜ pending |
| 5-02-03 | 02 | 2 | DamageNumbers x-jitter | unit | `pnpm --filter @killing-blow/client test --run` | ❌ W0 | ⬜ pending |
| 5-02-04 | 02 | 2 | KillingBlowAnnouncement spring | manual | visual inspection | ✅ | ⬜ pending |
| 5-02-05 | 02 | 2 | PlayerSidebar dark glass | manual | visual inspection | ✅ | ⬜ pending |
| 5-02-06 | 02 | 2 | UpgradePanel dark glass | manual | visual inspection | ✅ | ⬜ pending |
| 5-02-07 | 02 | 2 | TitleShop dark glass | manual | visual inspection | ✅ | ⬜ pending |
| 5-02-08 | 02 | 2 | Leaderboard dark glass | manual | visual inspection | ✅ | ⬜ pending |
| 5-03-01 | 03 | 3 | Game.tsx h-dvh layout | manual | browser mobile emulator resize | ✅ | ⬜ pending |
| 5-03-02 | 03 | 3 | Mobile drawer open/close | manual | browser interaction on mobile | ✅ | ⬜ pending |
| 5-03-03 | 03 | 3 | Kill flash + screen shake | manual | browser — kill a boss | ✅ | ⬜ pending |
| 5-03-04 | 03 | 3 | Reduced motion respected | manual | DevTools emulate prefers-reduced-motion | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Wave 0 test infrastructure changes are **optional** for this phase. The primary validation is manual browser verification due to the visual nature of Phase 5.

If component tests are desired:

- [ ] `packages/client/vitest.config.ts` — change `environment: 'node'` to `environment: 'jsdom'`
- [ ] `packages/client/src/components/BossSprite.test.tsx` — silhouette selection logic (`bossNumber % 5`)
- [ ] `packages/client/src/components/DamageNumbers.test.tsx` — x-jitter range and crit threshold logic

*If Wave 0 is skipped: "Existing infrastructure covers phase requirements — all tests pass with no tests via --passWithNoTests."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CSS keyframes in index.css | hp-pulse, screen-shake, kill-flash, boss-flash | CSS-only, not unit-testable | Open DevTools → Animations panel or visually observe |
| Game viewport h-dvh lock | Mobile address bar no overflow | Viewport behavior | Chrome DevTools → mobile emulator → toggle address bar |
| Mobile drawer slide-up | Tap Upgrades/Titles tab | Gesture/touch interaction | Mobile device or DevTools touch mode |
| Kill flash + screen shake on boss death | Screen effect on boss:death | Socket event timing | Trigger boss defeat in browser |
| Backdrop blur on panels | Dark glass depth effect | GPU rendering | Inspect visually over dungeon background |
| Boss HP bar glow | 28px height, red glow | CSS inline style | Inspect element + visual check |
| prefers-reduced-motion | Animations skipped | CSS @media | DevTools → Rendering → Emulate CSS media |
| Leaderboard dark glass | Non-game route styling | CSS class applied | Load /leaderboard route |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (or Wave 0 explicitly skipped as optional)
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
