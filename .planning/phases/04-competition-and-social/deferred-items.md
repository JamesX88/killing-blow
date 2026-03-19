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
