import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'

// Mock prisma before any imports that use it
vi.mock('../db/prisma.js', () => ({
  prisma: {
    oAuthAccount: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    user: {
      create: vi.fn(),
      findUnique: vi.fn()
    }
  }
}))

import { prisma } from '../db/prisma.js'
import { buildApp } from '../app.js'

const mockPrisma = prisma as {
  oAuthAccount: {
    findUnique: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
  user: {
    create: ReturnType<typeof vi.fn>
    findUnique: ReturnType<typeof vi.fn>
  }
}

vi.stubGlobal('fetch', vi.fn())

describe('GET /profile/:userId', () => {
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

  it('returns 200 with user data for authenticated request', async () => {
    // Register to get a real JWT cookie
    mockPrisma.user.findUnique.mockResolvedValueOnce(null) // register: username not taken
    mockPrisma.user.create.mockResolvedValueOnce({
      id: 'profile-user-1',
      username: 'profiletestuser',
      passwordHash: 'hash',
      email: null,
      killCount: 0,
      kbRank: null,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    const registerRes = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { username: 'profiletestuser', password: 'password123' }
    })
    expect(registerRes.statusCode).toBe(200)

    // Extract JWT cookie
    const setCookieHeader = registerRes.headers['set-cookie']
    const cookieStr = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader as string
    const tokenMatch = cookieStr?.match(/token=([^;]+)/)
    const token = tokenMatch?.[1]
    expect(token).toBeDefined()

    // Mock the profile lookup
    const createdAt = new Date('2026-03-18T00:00:00Z')
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'profile-user-1',
      username: 'profiletestuser',
      killCount: 0,
      kbRank: null,
      createdAt
    })

    const profileRes = await app.inject({
      method: 'GET',
      url: '/profile/profile-user-1',
      cookies: { token: token! }
    })

    expect(profileRes.statusCode).toBe(200)
    const body = JSON.parse(profileRes.body)
    expect(body).toMatchObject({
      id: 'profile-user-1',
      username: 'profiletestuser',
      killCount: 0,
      createdAt: createdAt.toISOString()
    })
    // kbRank is null when user has no rank
    expect(body.kbRank).toBeNull()
  })

  it('returns 401 for unauthenticated request (no cookie)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/profile/any-user-id'
    })

    expect(res.statusCode).toBe(401)
  })

  it('returns 404 with {error: "User not found"} for nonexistent userId', async () => {
    // Register to get a JWT token
    mockPrisma.user.findUnique.mockResolvedValueOnce(null)
    mockPrisma.user.create.mockResolvedValueOnce({
      id: 'auth-user-2',
      username: 'authuserfortestprofile',
      passwordHash: 'hash',
      email: null,
      killCount: 0,
      kbRank: null,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    const registerRes = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { username: 'authuserfortestprofile', password: 'password123' }
    })
    expect(registerRes.statusCode).toBe(200)

    const setCookieHeader = registerRes.headers['set-cookie']
    const cookieStr = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader as string
    const tokenMatch = cookieStr?.match(/token=([^;]+)/)
    const token = tokenMatch?.[1]
    expect(token).toBeDefined()

    // Profile lookup returns null = not found
    mockPrisma.user.findUnique.mockResolvedValueOnce(null)

    const res = await app.inject({
      method: 'GET',
      url: '/profile/nonexistent-user-id',
      cookies: { token: token! }
    })

    expect(res.statusCode).toBe(404)
    const body = JSON.parse(res.body)
    expect(body).toMatchObject({ error: 'User not found' })
  })

  it('killCount defaults to 0 for new users', async () => {
    // Register fresh user
    mockPrisma.user.findUnique.mockResolvedValueOnce(null)
    mockPrisma.user.create.mockResolvedValueOnce({
      id: 'new-kill-user',
      username: 'newkilluser',
      passwordHash: 'hash',
      email: null,
      killCount: 0,
      kbRank: null,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    const registerRes = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { username: 'newkilluser', password: 'password123' }
    })
    expect(registerRes.statusCode).toBe(200)

    const setCookieHeader = registerRes.headers['set-cookie']
    const cookieStr = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader as string
    const tokenMatch = cookieStr?.match(/token=([^;]+)/)
    const token = tokenMatch?.[1]
    expect(token).toBeDefined()

    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'new-kill-user',
      username: 'newkilluser',
      killCount: 0,
      kbRank: null,
      createdAt: new Date()
    })

    const res = await app.inject({
      method: 'GET',
      url: '/profile/new-kill-user',
      cookies: { token: token! }
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.killCount).toBe(0)
  })
})
