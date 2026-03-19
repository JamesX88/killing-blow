import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { createClient } from 'redis'
import type { PrismaClient } from '@prisma/client'

// We pass a mock prisma to spawnNextBoss for test isolation
function makeMockPrisma(bossOverrides?: Partial<{ id: string; bossNumber: number; name: string; maxHp: number }>) {
  let bossCounter = 0
  return {
    boss: {
      upsert: vi.fn(async (args: { where: { bossNumber: number }; update: object; create: { bossNumber: number; name: string; maxHp: number } }) => {
        bossCounter++
        return {
          id: bossOverrides?.id ?? `test-boss-${bossCounter}`,
          bossNumber: args.create.bossNumber,
          name: args.create.name,
          maxHp: args.create.maxHp,
          spawnedAt: new Date(),
          defeatedAt: null,
          winnerId: null,
        }
      }),
      create: vi.fn(async ({ data }: { data: { bossNumber: number; name: string; maxHp: number } }) => {
        bossCounter++
        return {
          id: bossOverrides?.id ?? `test-boss-${bossCounter}`,
          bossNumber: data.bossNumber,
          name: data.name,
          maxHp: data.maxHp,
          spawnedAt: new Date(),
          defeatedAt: null,
          winnerId: null,
        }
      }),
      update: vi.fn(async (args: { where: { id: string }; data: object }) => ({ id: args.where.id })),
    },
  } as unknown as PrismaClient
}

import {
  applyDamage,
  spawnNextBoss,
  ensureActiveBoss,
  getActivePlayers,
  getBaseDamage,
  getCurrentBossId,
  getBossState,
  computeAggregateDps,
} from './bossState.js'

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'

let redis: ReturnType<typeof createClient>

beforeAll(async () => {
  redis = createClient({ url: REDIS_URL })
  await redis.connect()
})

afterAll(async () => {
  await redis.quit()
})

beforeEach(async () => {
  await redis.flushDb()
})

describe('bossState', () => {
  describe('applyDamage', () => {
    it('Test 1: decrements boss HP by damage amount (1000 - 25 = 975)', async () => {
      const bossId = 'boss-test-1'
      await redis.set(`boss:${bossId}:hp`, '1000')
      await redis.set(`boss:${bossId}:maxHp`, '1000')

      const result = await applyDamage(redis, bossId, 'user-1', 25, 1000)

      expect(result.newHp).toBe(975)
    })

    it('Test 2: returns killed=false when HP > 0 after damage', async () => {
      const bossId = 'boss-test-2'
      await redis.set(`boss:${bossId}:hp`, '1000')
      await redis.set(`boss:${bossId}:maxHp`, '1000')

      const result = await applyDamage(redis, bossId, 'user-1', 25, 1000)

      expect(result.killed).toBe(false)
    })

    it('Test 3: returns killed=true and winnerId when HP reaches 0', async () => {
      const bossId = 'boss-test-3'
      await redis.set(`boss:${bossId}:hp`, '25')
      await redis.set(`boss:${bossId}:maxHp`, '1000')

      const result = await applyDamage(redis, bossId, 'user-1', 25, 1000)

      expect(result.killed).toBe(true)
      expect(result.winnerId).toBe('user-1')
    })

    it('Test 4: two concurrent applyDamage calls when HP=25 — exactly one returns killed=true (KB-01 atomic kill claim)', async () => {
      const bossId = 'boss-test-4'
      await redis.set(`boss:${bossId}:hp`, '25')
      await redis.set(`boss:${bossId}:maxHp`, '1000')

      const [r1, r2] = await Promise.all([
        applyDamage(redis, bossId, 'user-1', 25, 1000),
        applyDamage(redis, bossId, 'user-2', 25, 1000),
      ])

      const killedResults = [r1, r2].filter(r => r.killed)
      expect(killedResults).toHaveLength(1)
    })

    it('Test 5: player attacking while HP <= threshold (10) gets added to last1pct hash (KB-04)', async () => {
      const bossId = 'boss-test-5'
      await redis.set(`boss:${bossId}:hp`, '10')
      await redis.set(`boss:${bossId}:maxHp`, '1000')

      await applyDamage(redis, bossId, 'user-eligible', 5, 1000)

      const hash = await redis.hGetAll(`boss:${bossId}:last1pct`)
      expect(hash['user-eligible']).toBe('1')
    })

    it('Test 6: player attacking while HP > threshold does NOT get added to last1pct hash (KB-04)', async () => {
      const bossId = 'boss-test-6'
      await redis.set(`boss:${bossId}:hp`, '500')
      await redis.set(`boss:${bossId}:maxHp`, '1000')

      await applyDamage(redis, bossId, 'user-ineligible', 25, 1000)

      const hash = await redis.hGetAll(`boss:${bossId}:last1pct`)
      expect(hash['user-ineligible']).toBeUndefined()
    })
  })

  describe('spawnNextBoss', () => {
    it('Test 7: creates Redis keys boss:{id}:hp and boss:{id}:maxHp with value "1000", sets boss:current', async () => {
      const mockPrisma = makeMockPrisma({ id: 'spawned-boss-1' })

      const state = await spawnNextBoss(redis, mockPrisma, 0)

      expect(state.bossId).toBe('spawned-boss-1')
      expect(state.bossNumber).toBe(1)
      expect(state.maxHp).toBe(1000)
      expect(state.hp).toBe(1000)
      // name now comes from lore catalogue, not hardcoded 'Boss #N'
      expect(state.name).toBeTruthy()
      expect(state.name).not.toMatch(/^Boss #/)

      const hp = await redis.get(`boss:spawned-boss-1:hp`)
      const maxHp = await redis.get(`boss:spawned-boss-1:maxHp`)
      const current = await redis.get('boss:current')

      expect(hp).toBe('1000')
      expect(maxHp).toBe('1000')
      expect(current).toBe('spawned-boss-1')
    })

    it('Test 8b: spawnNextBoss with overrideMaxHp=5000 creates boss with maxHp=5000', async () => {
      const mockPrisma = makeMockPrisma({ id: 'spawned-boss-dynamic' })

      const state = await spawnNextBoss(redis, mockPrisma, 5, 5000)

      expect(state.bossId).toBe('spawned-boss-dynamic')
      expect(state.maxHp).toBe(5000)
      expect(state.hp).toBe(5000)

      const maxHpStr = await redis.get('boss:spawned-boss-dynamic:maxHp')
      expect(maxHpStr).toBe('5000')
    })

    it('Test 8c: spawnNextBoss clamps overrideMaxHp below MIN_BOSS_HP (1000)', async () => {
      const mockPrisma = makeMockPrisma({ id: 'spawned-boss-min' })

      const state = await spawnNextBoss(redis, mockPrisma, 10, 100)

      expect(state.maxHp).toBe(1000)
    })

    it('Test 8d: spawnNextBoss clamps overrideMaxHp above MAX_BOSS_HP (10000000)', async () => {
      const mockPrisma = makeMockPrisma({ id: 'spawned-boss-max' })

      const state = await spawnNextBoss(redis, mockPrisma, 11, 99_000_000)

      expect(state.maxHp).toBe(10_000_000)
    })
  })

  describe('computeAggregateDps', () => {
    it('Test 9: returns totalDamage / fightSeconds from Redis damage hash + Prisma boss record', async () => {
      const bossId = 'boss-dps-test-1'
      const spawnedAt = new Date('2026-01-01T00:00:00Z')
      const defeatedAt = new Date('2026-01-01T00:05:00Z') // 300 seconds later

      await redis.hSet(`boss:${bossId}:damage`, { 'user-a': '1500', 'user-b': '4500' })

      const mockPrisma = {
        boss: {
          findUnique: vi.fn().mockResolvedValue({
            id: bossId,
            bossNumber: 1,
            name: 'Boss #1',
            maxHp: 1000,
            spawnedAt,
            defeatedAt,
            winnerId: 'user-b',
          }),
        },
      } as unknown as import('@prisma/client').PrismaClient

      const dps = await computeAggregateDps(redis, mockPrisma, bossId)
      // totalDamage = 6000, fightSeconds = 300, dps = 20
      expect(dps).toBeCloseTo(20, 1)
    })

    it('Test 10: returns 0 when boss has no defeatedAt', async () => {
      const bossId = 'boss-dps-test-2'
      await redis.hSet(`boss:${bossId}:damage`, { 'user-a': '500' })

      const mockPrisma = {
        boss: {
          findUnique: vi.fn().mockResolvedValue({
            id: bossId,
            bossNumber: 2,
            name: 'Boss #2',
            maxHp: 1000,
            spawnedAt: new Date(),
            defeatedAt: null,
            winnerId: null,
          }),
        },
      } as unknown as import('@prisma/client').PrismaClient

      const dps = await computeAggregateDps(redis, mockPrisma, bossId)
      expect(dps).toBe(0)
    })
  })

  describe('getActivePlayers', () => {
    it('Test 8: returns players sorted by damage descending', async () => {
      const bossId = 'boss-test-8'
      await redis.hSet(`boss:${bossId}:damage`, { 'user-a': '100', 'user-b': '500', 'user-c': '250' })
      await redis.hSet(`boss:${bossId}:usernames`, { 'user-a': 'Alice', 'user-b': 'Bob', 'user-c': 'Carol' })

      const players = await getActivePlayers(redis, bossId)

      expect(players).toHaveLength(3)
      expect(players[0].userId).toBe('user-b')
      expect(players[0].damageDealt).toBe(500)
      expect(players[1].userId).toBe('user-c')
      expect(players[1].damageDealt).toBe(250)
      expect(players[2].userId).toBe('user-a')
      expect(players[2].damageDealt).toBe(100)
    })
  })

  describe('Phase 4 - Lore and Titles', () => {
    it('Phase4-Test1: spawnNextBoss stores lore in boss:meta Redis key', async () => {
      const mockPrisma = makeMockPrisma({ id: 'boss-lore-1' })

      await spawnNextBoss(redis, mockPrisma, 0)

      const metaStr = await redis.get('boss:boss-lore-1:meta')
      expect(metaStr).not.toBeNull()
      const meta = JSON.parse(metaStr!)
      expect(typeof meta.lore).toBe('string')
      expect(meta.lore.length).toBeGreaterThan(0)
    })

    it('Phase4-Test2: spawnNextBoss returns BossState with lore field matching getBossLore(bossNumber).lore', async () => {
      const mockPrisma = makeMockPrisma({ id: 'boss-lore-2' })

      const state = await spawnNextBoss(redis, mockPrisma, 2)

      expect(typeof state.lore).toBe('string')
      expect(state.lore!.length).toBeGreaterThan(0)
    })

    it('Phase4-Test3: spawnNextBoss uses catalogue name not "Boss #N" pattern', async () => {
      const mockPrisma = makeMockPrisma({ id: 'boss-lore-3' })

      const state = await spawnNextBoss(redis, mockPrisma, 0)

      expect(state.name).not.toMatch(/^Boss #/)
      expect(state.name.length).toBeGreaterThan(0)
    })

    it('Phase4-Test4: getActivePlayers returns equippedTitle from boss:{bossId}:titles hash', async () => {
      const bossId = 'boss-titles-1'
      await redis.hSet(`boss:${bossId}:damage`, { 'user-a': '100' })
      await redis.hSet(`boss:${bossId}:usernames`, { 'user-a': 'Alice' })
      await redis.hSet(`boss:${bossId}:titles`, { 'user-a': 'Slayer' })

      const players = await getActivePlayers(redis, bossId)

      expect(players).toHaveLength(1)
      expect(players[0].equippedTitle).toBe('Slayer')
    })

    it('Phase4-Test5: getActivePlayers returns null equippedTitle when no title set', async () => {
      const bossId = 'boss-titles-2'
      await redis.hSet(`boss:${bossId}:damage`, { 'user-b': '200' })
      await redis.hSet(`boss:${bossId}:usernames`, { 'user-b': 'Bob' })
      // No titles hash set

      const players = await getActivePlayers(redis, bossId)

      expect(players).toHaveLength(1)
      expect(players[0].equippedTitle).toBeNull()
    })
  })
})
