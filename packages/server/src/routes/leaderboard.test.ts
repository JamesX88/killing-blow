import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'

// Mock prisma before any imports that use it
vi.mock('../db/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
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
    findMany: ReturnType<typeof vi.fn>
    count: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
  playerStats: {
    findUnique: ReturnType<typeof vi.fn>
    upsert: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
  $transaction: ReturnType<typeof vi.fn>
}

// Helper: register a user and get JWT cookie
async function getAuthCookie(app: FastifyInstance, username = 'leaderboarduser'): Promise<string> {
  mockPrisma.user.findUnique.mockResolvedValueOnce(null)
  mockPrisma.user.create.mockResolvedValueOnce({
    id: `user-${username}`,
    username,
    passwordHash: 'hash',
    email: null,
    killCount: 0,
    kbBalance: 0,
    kbRank: null,
    equippedTitle: null,
    ownedTitles: '[]',
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

describe('Leaderboard routes', () => {
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

  describe('GET /leaderboard', () => {
    it('Test 1: returns users sorted by killCount DESC', async () => {
      const token = await getAuthCookie(app, 'lbuser1')

      mockPrisma.user.findMany.mockResolvedValueOnce([
        { id: 'u3', username: 'Alpha', killCount: 100, equippedTitle: 'slayer' },
        { id: 'u1', username: 'Beta', killCount: 50, equippedTitle: null },
        { id: 'u2', username: 'Gamma', killCount: 10, equippedTitle: null },
      ])
      mockPrisma.user.count.mockResolvedValueOnce(3)

      const res = await app.inject({
        method: 'GET',
        url: '/leaderboard',
        cookies: { token },
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.users).toHaveLength(3)
      expect(body.users[0].killCount).toBe(100)
      expect(body.users[1].killCount).toBe(50)
      expect(body.users[2].killCount).toBe(10)
      expect(body.total).toBe(3)
      expect(body.page).toBe(1)
    })

    it('Test 2: GET /leaderboard?page=2&limit=2 returns correct page with skip', async () => {
      const token = await getAuthCookie(app, 'lbuser2')

      mockPrisma.user.findMany.mockResolvedValueOnce([
        { id: 'u2', username: 'Gamma', killCount: 10, equippedTitle: null },
      ])
      mockPrisma.user.count.mockResolvedValueOnce(3)

      const res = await app.inject({
        method: 'GET',
        url: '/leaderboard?page=2&limit=2',
        cookies: { token },
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.page).toBe(2)
      expect(body.limit).toBe(2)
      // Verify findMany was called with correct skip/take
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 2,
          take: 2,
        })
      )
    })

    it('Test 3: GET /leaderboard limits max to 100 per page', async () => {
      const token = await getAuthCookie(app, 'lbuser3')

      mockPrisma.user.findMany.mockResolvedValueOnce([])
      mockPrisma.user.count.mockResolvedValueOnce(0)

      const res = await app.inject({
        method: 'GET',
        url: '/leaderboard?limit=9999',
        cookies: { token },
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.limit).toBeLessThanOrEqual(100)
      // Verify findMany was called with take <= 100
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        })
      )
    })

    it('Test 4: GET /leaderboard requires authentication (401 without cookie)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/leaderboard',
      })

      expect(res.statusCode).toBe(401)
    })
  })
})
