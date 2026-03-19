import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'

// Mock prisma before any imports that use it
vi.mock('../db/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    playerStats: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

import { prisma } from '../db/prisma.js'
import { buildApp } from '../app.js'

const mockPrisma = prisma as {
  user: {
    findUnique: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
  }
  playerStats: {
    findUnique: ReturnType<typeof vi.fn>
    upsert: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
  $transaction: ReturnType<typeof vi.fn>
}

describe('Upgrade routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildApp({ logger: false })
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Helper: register a user and get JWT cookie
  async function getAuthCookie(username = 'upgradetestuser'): Promise<string> {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null)
    mockPrisma.user.create.mockResolvedValueOnce({
      id: `user-${username}`,
      username,
      passwordHash: 'hash',
      email: null,
      killCount: 0,
      kbRank: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { username, password: 'password123' },
    })
    const setCookieHeader = res.headers['set-cookie']
    const cookieStr = Array.isArray(setCookieHeader) ? setCookieHeader[0] : (setCookieHeader as string)
    const tokenMatch = cookieStr?.match(/token=([^;]+)/)
    return tokenMatch![1]
  }

  describe('POST /upgrades/:stat', () => {
    it('returns 200 with incremented atkLevel and reduced goldBalance when sufficient gold', async () => {
      const token = await getAuthCookie('upgradeuser1')

      // purchaseUpgrade calls $transaction internally
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        // Simulate the transaction: upsert returns existing stats, then update returns new stats
        const txMock = {
          playerStats: {
            upsert: vi.fn().mockResolvedValue({
              id: 'stats-1',
              userId: 'user-upgradeuser1',
              goldBalance: '100',
              atkLevel: 0,
              critLevel: 0,
              spdLevel: 0,
              lastSeenAt: new Date(),
              lastActiveAt: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
            update: vi.fn().mockResolvedValue({
              id: 'stats-1',
              userId: 'user-upgradeuser1',
              goldBalance: '90',
              atkLevel: 1,
              critLevel: 0,
              spdLevel: 0,
              lastSeenAt: new Date(),
              lastActiveAt: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
          },
        }
        return fn(txMock)
      })

      const res = await app.inject({
        method: 'POST',
        url: '/upgrades/atk',
        cookies: { token },
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.atkLevel).toBe(1)
      expect(body.goldBalance).toBe('90')
    })

    it('returns 400 with error INSUFFICIENT_GOLD when goldBalance is 0', async () => {
      const token = await getAuthCookie('upgradeuser2')

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const txMock = {
          playerStats: {
            upsert: vi.fn().mockResolvedValue({
              id: 'stats-2',
              userId: 'user-upgradeuser2',
              goldBalance: '0',
              atkLevel: 0,
              critLevel: 0,
              spdLevel: 0,
              lastSeenAt: new Date(),
              lastActiveAt: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
            update: vi.fn(),
          },
        }
        return fn(txMock)
      })

      const res = await app.inject({
        method: 'POST',
        url: '/upgrades/atk',
        cookies: { token },
      })

      expect(res.statusCode).toBe(400)
      const body = JSON.parse(res.body)
      expect(body.error).toBe('INSUFFICIENT_GOLD')
    })

    it('returns 400 with error message when stat is invalid', async () => {
      const token = await getAuthCookie('upgradeuser3')

      const res = await app.inject({
        method: 'POST',
        url: '/upgrades/invalid',
        cookies: { token },
      })

      expect(res.statusCode).toBe(400)
      const body = JSON.parse(res.body)
      expect(body.error).toContain('Invalid stat')
    })

    it('returns 401 when not authenticated', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/upgrades/atk',
      })

      expect(res.statusCode).toBe(401)
    })
  })

  describe('GET /upgrades/costs', () => {
    it('returns current levels and upgrade costs for all 3 stats', async () => {
      const token = await getAuthCookie('costsuser1')

      mockPrisma.playerStats.findUnique.mockResolvedValueOnce({
        id: 'stats-costs-1',
        userId: 'user-costsuser1',
        goldBalance: '50',
        atkLevel: 2,
        critLevel: 1,
        spdLevel: 0,
        lastSeenAt: new Date(),
        lastActiveAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const res = await app.inject({
        method: 'GET',
        url: '/upgrades/costs',
        cookies: { token },
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.atk).toBeDefined()
      expect(body.atk.level).toBe(2)
      expect(typeof body.atk.cost).toBe('string')
      expect(body.crit).toBeDefined()
      expect(body.crit.level).toBe(1)
      expect(body.spd).toBeDefined()
      expect(body.spd.level).toBe(0)
      expect(body.goldBalance).toBe('50')
    })

    it('returns 401 when not authenticated', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/upgrades/costs',
      })

      expect(res.statusCode).toBe(401)
    })
  })
})
