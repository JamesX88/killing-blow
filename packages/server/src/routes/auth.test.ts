import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import { buildApp } from '../app.js'
import type { FastifyInstance } from 'fastify'

// Mock prisma before any imports that use it
vi.mock('../db/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn()
    }
  }
}))

import { prisma } from '../db/prisma.js'

const mockPrisma = prisma as {
  user: {
    findUnique: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
  }
}

describe('Auth routes', () => {
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

  describe('POST /auth/register', () => {
    it('creates a new user and returns 200 with id and username', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-1',
        username: 'testuser',
        passwordHash: 'hashedpw',
        email: null,
        killCount: 0,
        kbRank: null,
        createdAt: new Date(),
        updatedAt: new Date()
      })

      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { username: 'testuser', password: 'password123' }
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body).toMatchObject({ id: 'user-1', username: 'testuser' })
      expect(body).not.toHaveProperty('passwordHash')
    })

    it('returns 409 when username is already taken', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'existing-1',
        username: 'testuser',
        passwordHash: 'hashedpw',
        email: null,
        killCount: 0,
        kbRank: null,
        createdAt: new Date(),
        updatedAt: new Date()
      })

      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { username: 'testuser', password: 'password123' }
      })

      expect(res.statusCode).toBe(409)
      const body = JSON.parse(res.body)
      expect(body.error).toBe('That username is already taken. Try a different one.')
    })

    it('returns 400 with empty username', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { username: '', password: 'password123' }
      })

      expect(res.statusCode).toBe(400)
    })

    it('returns 400 when password is shorter than 8 chars', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { username: 'testuser', password: 'short' }
      })

      expect(res.statusCode).toBe(400)
    })

    it('sets httpOnly cookie named "token" with maxAge of 30 days', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-1',
        username: 'testuser',
        passwordHash: 'hashedpw',
        email: null,
        killCount: 0,
        kbRank: null,
        createdAt: new Date(),
        updatedAt: new Date()
      })

      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { username: 'testuser', password: 'password123' }
      })

      expect(res.statusCode).toBe(200)
      const setCookieHeader = res.headers['set-cookie']
      expect(setCookieHeader).toBeDefined()
      const cookieStr = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader
      expect(cookieStr).toContain('token=')
      expect(cookieStr.toLowerCase()).toContain('httponly')
      // 30 days = 2592000 seconds
      expect(cookieStr.toLowerCase()).toContain('max-age=2592000')
    })
  })

  describe('POST /auth/login', () => {
    it('returns 200 with id, username, and killCount for valid credentials', async () => {
      // Register first to get a real argon2id hash stored by the route
      mockPrisma.user.findUnique.mockResolvedValue(null)
      let capturedHash = ''
      mockPrisma.user.create.mockImplementation(async ({ data }: { data: { username: string; passwordHash: string } }) => {
        capturedHash = data.passwordHash
        return {
          id: 'login-user-1',
          username: data.username,
          passwordHash: data.passwordHash,
          email: null,
          killCount: 7,
          kbRank: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { username: 'loginvalid', password: 'password123' }
      })

      // Now mock findUnique for login using the real captured hash
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'login-user-1',
        username: 'loginvalid',
        passwordHash: capturedHash,
        email: null,
        killCount: 7,
        kbRank: null,
        createdAt: new Date(),
        updatedAt: new Date()
      })

      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { username: 'loginvalid', password: 'password123' }
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body).toMatchObject({ id: 'login-user-1', username: 'loginvalid', killCount: 7 })

      // Verify httpOnly cookie is set
      const setCookieHeader = res.headers['set-cookie']
      expect(setCookieHeader).toBeDefined()
      const cookieStr = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader as string
      expect(cookieStr).toContain('token=')
      expect(cookieStr.toLowerCase()).toContain('httponly')
      expect(cookieStr.toLowerCase()).toContain('max-age=2592000')
    })

    it('returns 401 with wrong password', async () => {
      // Register to get a real hash, then try wrong password
      mockPrisma.user.findUnique.mockResolvedValue(null)
      let capturedHash = ''
      mockPrisma.user.create.mockImplementation(async ({ data }: { data: { username: string; passwordHash: string } }) => {
        capturedHash = data.passwordHash
        return {
          id: 'wrong-pw-user',
          username: data.username,
          passwordHash: data.passwordHash,
          email: null,
          killCount: 0,
          kbRank: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { username: 'wrongpwuser', password: 'password123' }
      })

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'wrong-pw-user',
        username: 'wrongpwuser',
        passwordHash: capturedHash,
        email: null,
        killCount: 0,
        kbRank: null,
        createdAt: new Date(),
        updatedAt: new Date()
      })

      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { username: 'wrongpwuser', password: 'wrongpassword' }
      })

      expect(res.statusCode).toBe(401)
      const body = JSON.parse(res.body)
      expect(body.error).toBe('Incorrect username or password.')
    })

    it('returns 401 when username does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { username: 'nonexistent', password: 'password123' }
      })

      expect(res.statusCode).toBe(401)
      const body = JSON.parse(res.body)
      expect(body.error).toBe('Incorrect username or password.')
    })

    it('sets httpOnly cookie on successful login (covered in valid credentials test)', async () => {
      // Covered by the "valid credentials" test above — this confirms 401 path sets no cookie
      mockPrisma.user.findUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { username: 'nonexistent', password: 'password123' }
      })

      expect(res.statusCode).toBe(401)
      // On failure, no token cookie should be set
      const setCookieHeader = res.headers['set-cookie']
      if (setCookieHeader) {
        const cookieStr = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader as string
        expect(cookieStr).not.toContain('token=')
      }
    })
  })

  describe('GET /auth/me', () => {
    it('returns 401 without JWT cookie', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/auth/me'
      })

      expect(res.statusCode).toBe(401)
    })

    it('returns current user with id, username, killCount, kbRank when JWT cookie is valid', async () => {
      // First register to get a real JWT cookie
      mockPrisma.user.findUnique.mockResolvedValue(null)
      mockPrisma.user.create.mockResolvedValue({
        id: 'me-user-1',
        username: 'meuser',
        passwordHash: 'hash',
        email: null,
        killCount: 3,
        kbRank: 42,
        createdAt: new Date(),
        updatedAt: new Date()
      })

      const registerRes = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { username: 'meuser', password: 'password123' }
      })

      expect(registerRes.statusCode).toBe(200)

      // Extract the JWT cookie from register response
      const setCookieHeader = registerRes.headers['set-cookie']
      const cookieStr = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader as string
      const tokenMatch = cookieStr?.match(/token=([^;]+)/)
      const token = tokenMatch?.[1]

      expect(token).toBeDefined()

      // Now mock findUnique for /me
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'me-user-1',
        username: 'meuser',
        killCount: 3,
        kbRank: 42
      })

      const meRes = await app.inject({
        method: 'GET',
        url: '/auth/me',
        cookies: { token: token! }
      })

      expect(meRes.statusCode).toBe(200)
      const body = JSON.parse(meRes.body)
      expect(body).toMatchObject({
        id: 'me-user-1',
        username: 'meuser',
        killCount: 3,
        kbRank: 42
      })
    })
  })
})
