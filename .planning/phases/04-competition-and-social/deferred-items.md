# Deferred Items — Phase 04

## Pre-existing Failures (out of scope, not caused by 04-02)

### gateway.test.ts — Test 4: boss:spawn timeout

**Discovered during:** Plan 04-02, Task 1
**Status:** Pre-existing failure (confirmed via git stash)
**Root cause:** `spawnNextBoss` in `bossState.ts` calls `prisma.boss.upsert`, but the
`Boss loop events` describe block in `gateway.test.ts` does not mock `prisma.boss.upsert`.
When the test reaches the 3000ms delay and then tries to spawn next boss, it fails silently
and `boss:spawn` is never emitted, causing a 5000ms timeout.
**Fix:** Add `vi.mocked(prisma.boss.upsert).mockImplementation(...)` to the `beforeEach`
block in the `Boss loop events` describe. Also consider adding `boss.upsert: vi.fn()` to
the top-level prisma mock factory.
**Impact:** 1 test failing consistently; does not affect Phase 4 tests.

### playerStats.test.ts — Test 14: 30 seconds offline returns Decimal(0)

**Discovered during:** Plan 04-03, Task 3 (automated verification)
**Status:** Pre-existing failure (confirmed — same failure count before and after 04-03 changes)
**Root cause:** `computeOfflineGold` does not apply a 60-second minimum threshold before calculating offline gold. The test expects `Decimal(0)` for 30s offline but receives `375`.
**Fix:** Add an early return in `computeOfflineGold` when `offlineSeconds < 60`.
**Impact:** Minor — offline gold threshold may grant gold for shorter offline periods than intended. Does not affect Phase 4 features.
