import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { createClient } from 'redis'
import type { PrismaClient } from '@prisma/client'

// We pass a mock prisma to spawnNextBoss for test isolation
function makeMockPrisma(bossOverrides?: Partial<{ id: string; bossNumber: number; name: string; maxHp: number }>) {
  let bossCounter = 0
  return {
    boss: {
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
      expect(state.name).toBe('Boss #1')

      const hp = await redis.get(`boss:spawned-boss-1:hp`)
      const maxHp = await redis.get(`boss:spawned-boss-1:maxHp`)
      const current = await redis.get('boss:current')

      expect(hp).toBe('1000')
      expect(maxHp).toBe('1000')
      expect(current).toBe('spawned-boss-1')
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
})
