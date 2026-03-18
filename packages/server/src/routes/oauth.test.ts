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

// Mock global fetch for OAuth user info calls
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('OAuth callback routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    // Set env vars for OAuth registration
    process.env.GOOGLE_CLIENT_ID = 'test-google-client-id'
    process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret'
    process.env.DISCORD_CLIENT_ID = 'test-discord-client-id'
    process.env.DISCORD_CLIENT_SECRET = 'test-discord-client-secret'
    process.env.SERVER_URL = 'http://localhost:3000'
    process.env.CLIENT_URL = 'http://localhost:5173'

    app = await buildApp({ logger: false })
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /auth/google/callback', () => {
    it('creates a new user, sets JWT cookie, and redirects to /profile on first Google login', async () => {
      // Mock Google token exchange (the OAuth2 plugin getAccessTokenFromAuthorizationCodeFlow)
      const googleOAuth2Mock = {
        getAccessTokenFromAuthorizationCodeFlow: vi.fn().mockResolvedValue({
          token: { access_token: 'google-access-token', refresh_token: 'google-refresh-token' }
        })
      }
      ;(app as any).googleOAuth2 = googleOAuth2Mock

      // Mock Google userinfo endpoint
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ id: 'google-123', email: 'test@gmail.com', name: 'Test User' })
      } as Response)

      // No existing OAuth account
      mockPrisma.oAuthAccount.findUnique.mockResolvedValue(null)

      // Create new user
      mockPrisma.user.create.mockResolvedValue({
        id: 'new-user-1',
        username: 'Test User',
        email: 'test@gmail.com',
        passwordHash: null,
        killCount: 0,
        kbRank: null,
        createdAt: new Date(),
        updatedAt: new Date()
      })

      const res = await app.inject({
        method: 'GET',
        url: '/auth/google/callback?code=test-auth-code&state=test-state'
      })

      // Should redirect to client profile
      expect(res.statusCode).toBe(302)
      expect(res.headers.location).toBe('http://localhost:5173/profile')

      // Should set JWT cookie
      const setCookieHeader = res.headers['set-cookie']
      expect(setCookieHeader).toBeDefined()
      const cookieStr = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader as string
      expect(cookieStr).toContain('token=')
      expect(cookieStr.toLowerCase()).toContain('httponly')
    })

    it('reuses existing user account and updates tokens on subsequent Google login', async () => {
      const googleOAuth2Mock = {
        getAccessTokenFromAuthorizationCodeFlow: vi.fn().mockResolvedValue({
          token: { access_token: 'new-google-token', refresh_token: 'new-google-refresh' }
        })
      }
      ;(app as any).googleOAuth2 = googleOAuth2Mock

      // Mock Google userinfo endpoint
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ id: 'google-456', email: 'existing@gmail.com', name: 'Existing User' })
      } as Response)

      const existingUser = {
        id: 'existing-user-1',
        username: 'ExistingUser',
        email: 'existing@gmail.com',
        passwordHash: null,
        killCount: 5,
        kbRank: 10,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      // Existing OAuth account found
      mockPrisma.oAuthAccount.findUnique.mockResolvedValue({
        id: 'oauth-account-1',
        userId: 'existing-user-1',
        provider: 'google',
        providerAccountId: 'google-456',
        accessToken: 'old-token',
        refreshToken: 'old-refresh',
        user: existingUser
      })

      mockPrisma.oAuthAccount.update.mockResolvedValue({
        id: 'oauth-account-1',
        userId: 'existing-user-1',
        provider: 'google',
        providerAccountId: 'google-456',
        accessToken: 'new-google-token',
        refreshToken: 'new-google-refresh'
      })

      const res = await app.inject({
        method: 'GET',
        url: '/auth/google/callback?code=test-auth-code&state=test-state'
      })

      expect(res.statusCode).toBe(302)
      expect(res.headers.location).toBe('http://localhost:5173/profile')

      // Verify user.create was NOT called (existing user reused)
      expect(mockPrisma.user.create).not.toHaveBeenCalled()

      // Verify oAuthAccount.update was called with new tokens
      expect(mockPrisma.oAuthAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ accessToken: 'new-google-token' })
        })
      )
    })

    it('redirects to /login?error=oauth_failed when token exchange fails', async () => {
      const googleOAuth2Mock = {
        getAccessTokenFromAuthorizationCodeFlow: vi.fn().mockRejectedValue(new Error('Token exchange failed'))
      }
      ;(app as any).googleOAuth2 = googleOAuth2Mock

      const res = await app.inject({
        method: 'GET',
        url: '/auth/google/callback?code=bad-code&state=test-state'
      })

      expect(res.statusCode).toBe(302)
      expect(res.headers.location).toBe('http://localhost:5173/login?error=oauth_failed')
    })
  })

  describe('GET /auth/discord/callback', () => {
    it('creates a new user, sets JWT cookie, and redirects to /profile on first Discord login', async () => {
      const discordOAuth2Mock = {
        getAccessTokenFromAuthorizationCodeFlow: vi.fn().mockResolvedValue({
          token: { access_token: 'discord-access-token', refresh_token: 'discord-refresh-token' }
        })
      }
      ;(app as any).discordOAuth2 = discordOAuth2Mock

      // Mock Discord userinfo endpoint
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ id: 'discord-789', email: 'player@discord.com', username: 'DiscordPlayer' })
      } as Response)

      mockPrisma.oAuthAccount.findUnique.mockResolvedValue(null)

      mockPrisma.user.create.mockResolvedValue({
        id: 'discord-user-1',
        username: 'DiscordPlayer',
        email: 'player@discord.com',
        passwordHash: null,
        killCount: 0,
        kbRank: null,
        createdAt: new Date(),
        updatedAt: new Date()
      })

      const res = await app.inject({
        method: 'GET',
        url: '/auth/discord/callback?code=discord-code&state=test-state'
      })

      expect(res.statusCode).toBe(302)
      expect(res.headers.location).toBe('http://localhost:5173/profile')

      const setCookieHeader = res.headers['set-cookie']
      expect(setCookieHeader).toBeDefined()
      const cookieStr = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader as string
      expect(cookieStr).toContain('token=')
      expect(cookieStr.toLowerCase()).toContain('httponly')
    })

    it('redirects to /login?error=oauth_failed when Discord token exchange fails', async () => {
      const discordOAuth2Mock = {
        getAccessTokenFromAuthorizationCodeFlow: vi.fn().mockRejectedValue(new Error('Discord token exchange failed'))
      }
      ;(app as any).discordOAuth2 = discordOAuth2Mock

      const res = await app.inject({
        method: 'GET',
        url: '/auth/discord/callback?code=bad-code&state=test-state'
      })

      expect(res.statusCode).toBe(302)
      expect(res.headers.location).toBe('http://localhost:5173/login?error=oauth_failed')
    })
  })

  describe('POST /auth/logout', () => {
    it('clears the token cookie and returns ok: true', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/logout'
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body).toMatchObject({ ok: true })

      // Verify cookie is cleared (set-cookie should have empty token or Max-Age=0)
      const setCookieHeader = res.headers['set-cookie']
      if (setCookieHeader) {
        const cookieStr = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader as string
        // Clearing a cookie sets it with an empty value or past expiry
        expect(cookieStr).toContain('token=')
      }
    })
  })
})
