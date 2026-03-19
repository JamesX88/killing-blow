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
async function getAuthCookie(app: FastifyInstance, username = 'titlesuser'): Promise<string> {
  mockPrisma.user.findUnique.mockResolvedValueOnce(null)
  mockPrisma.user.create.mockResolvedValueOnce({
    id: `user-${username}`,
    username,
    passwordHash: 'hash',
    email: null,
    killCount: 0,
    kbBalance: 10,
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

describe('Title shop routes', () => {
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

  describe('GET /titles', () => {
    it('Test 5: returns catalogue with owned: boolean and equipped: boolean per entry', async () => {
      const token = await getAuthCookie(app, 'titlesuser1')

      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-titlesuser1',
        username: 'titlesuser1',
        passwordHash: 'hash',
        email: null,
        killCount: 0,
        kbBalance: 10,
        kbRank: null,
        equippedTitle: 'slayer',
        ownedTitles: '["slayer"]',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const res = await app.inject({
        method: 'GET',
        url: '/titles',
        cookies: { token },
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(Array.isArray(body.titles)).toBe(true)
      expect(body.titles.length).toBeGreaterThan(0)
      expect(body.kbBalance).toBe(10)

      const slayerEntry = body.titles.find((t: { id: string }) => t.id === 'slayer')
      expect(slayerEntry).toBeDefined()
      expect(slayerEntry.owned).toBe(true)
      expect(slayerEntry.equipped).toBe(true)

      const annihilatorEntry = body.titles.find((t: { id: string }) => t.id === 'annihilator')
      expect(annihilatorEntry).toBeDefined()
      expect(annihilatorEntry.owned).toBe(false)
      expect(annihilatorEntry.equipped).toBe(false)
    })
  })

  describe('POST /titles/:id/purchase', () => {
    it('Test 6: deducts kbBalance and adds title to ownedTitles', async () => {
      const token = await getAuthCookie(app, 'titlesuser2')

      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-titlesuser2',
        username: 'titlesuser2',
        passwordHash: 'hash',
        email: null,
        killCount: 0,
        kbBalance: 10,
        kbRank: null,
        equippedTitle: null,
        ownedTitles: '[]',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      mockPrisma.user.update.mockResolvedValueOnce({
        id: 'user-titlesuser2',
        username: 'titlesuser2',
        passwordHash: 'hash',
        email: null,
        killCount: 0,
        kbBalance: 9,
        kbRank: null,
        equippedTitle: null,
        ownedTitles: '["slayer"]',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const res = await app.inject({
        method: 'POST',
        url: '/titles/slayer/purchase',
        cookies: { token },
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.success).toBe(true)
      expect(body.kbBalance).toBe(9) // 10 - 1 (slayer cost)

      // Verify update called with correct data
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            kbBalance: { decrement: 1 },
            ownedTitles: '["slayer"]',
          }),
        })
      )
    })

    it('Test 7: fails with 400 when kbBalance insufficient', async () => {
      const token = await getAuthCookie(app, 'titlesuser3')

      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-titlesuser3',
        username: 'titlesuser3',
        passwordHash: 'hash',
        email: null,
        killCount: 0,
        kbBalance: 0, // Not enough for slayer (cost 1)
        kbRank: null,
        equippedTitle: null,
        ownedTitles: '[]',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const res = await app.inject({
        method: 'POST',
        url: '/titles/slayer/purchase',
        cookies: { token },
      })

      expect(res.statusCode).toBe(400)
      const body = JSON.parse(res.body)
      expect(body.error).toBe('Not enough KB')
    })

    it('Test 8: fails with 400 when title already owned', async () => {
      const token = await getAuthCookie(app, 'titlesuser4')

      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-titlesuser4',
        username: 'titlesuser4',
        passwordHash: 'hash',
        email: null,
        killCount: 0,
        kbBalance: 10,
        kbRank: null,
        equippedTitle: 'slayer',
        ownedTitles: '["slayer"]', // Already owned
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const res = await app.inject({
        method: 'POST',
        url: '/titles/slayer/purchase',
        cookies: { token },
      })

      expect(res.statusCode).toBe(400)
      const body = JSON.parse(res.body)
      expect(body.error).toBe('Title already owned')
    })

    it('Test 9: fails with 404 for unknown title id', async () => {
      const token = await getAuthCookie(app, 'titlesuser5')

      const res = await app.inject({
        method: 'POST',
        url: '/titles/invalid/purchase',
        cookies: { token },
      })

      expect(res.statusCode).toBe(404)
      const body = JSON.parse(res.body)
      expect(body.error).toBe('Title not found')
    })
  })

  describe('PATCH /titles/:id/equip', () => {
    it('Test 10: sets equippedTitle to slayer when title is owned', async () => {
      const token = await getAuthCookie(app, 'titlesuser6')

      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-titlesuser6',
        username: 'titlesuser6',
        passwordHash: 'hash',
        email: null,
        killCount: 0,
        kbBalance: 10,
        kbRank: null,
        equippedTitle: null,
        ownedTitles: '["slayer"]',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      mockPrisma.user.update.mockResolvedValueOnce({
        id: 'user-titlesuser6',
        username: 'titlesuser6',
        passwordHash: 'hash',
        email: null,
        killCount: 0,
        kbBalance: 10,
        kbRank: null,
        equippedTitle: 'slayer',
        ownedTitles: '["slayer"]',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const res = await app.inject({
        method: 'PATCH',
        url: '/titles/slayer/equip',
        cookies: { token },
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.success).toBe(true)
      expect(body.equippedTitle).toBe('slayer')
    })

    it('Test 11: fails with 403 when title not owned', async () => {
      const token = await getAuthCookie(app, 'titlesuser7')

      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-titlesuser7',
        username: 'titlesuser7',
        passwordHash: 'hash',
        email: null,
        killCount: 0,
        kbBalance: 10,
        kbRank: null,
        equippedTitle: null,
        ownedTitles: '[]', // Does not own slayer
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const res = await app.inject({
        method: 'PATCH',
        url: '/titles/slayer/equip',
        cookies: { token },
      })

      expect(res.statusCode).toBe(403)
      const body = JSON.parse(res.body)
      expect(body.error).toBe('Title not owned')
    })

    it('Test 12: equipping "none" unequips (sets equippedTitle to null)', async () => {
      const token = await getAuthCookie(app, 'titlesuser8')

      mockPrisma.user.update.mockResolvedValueOnce({
        id: 'user-titlesuser8',
        username: 'titlesuser8',
        passwordHash: 'hash',
        email: null,
        killCount: 0,
        kbBalance: 10,
        kbRank: null,
        equippedTitle: null,
        ownedTitles: '["slayer"]',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const res = await app.inject({
        method: 'PATCH',
        url: '/titles/none/equip',
        cookies: { token },
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.success).toBe(true)
      expect(body.equippedTitle).toBeNull()

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { equippedTitle: null },
        })
      )
    })
  })
})
