import type { FastifyInstance } from 'fastify'
import { prisma } from '../db/prisma.js'

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 30 * 24 * 60 * 60 * 1000
}

export default async function oauthRoutes(fastify: FastifyInstance) {
  // Google callback
  fastify.get('/google/callback', async (request, reply) => {
    try {
      const { token } = await (fastify as any).googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request)

      // Fetch Google user info
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${token.access_token}` }
      })
      const googleUser = await userInfoRes.json() as { id: string; email: string; name: string }

      // Upsert OAuthAccount and User
      let oauthAccount = await prisma.oAuthAccount.findUnique({
        where: { provider_providerAccountId: { provider: 'google', providerAccountId: googleUser.id } },
        include: { user: true }
      })

      let user
      if (oauthAccount) {
        user = oauthAccount.user
        await prisma.oAuthAccount.update({
          where: { id: oauthAccount.id },
          data: { accessToken: token.access_token, refreshToken: token.refresh_token }
        })
      } else {
        // Create new user + oauth account
        user = await prisma.user.create({
          data: {
            username: googleUser.name || `google_${googleUser.id.slice(0, 8)}`,
            email: googleUser.email,
            oauthAccounts: {
              create: {
                provider: 'google',
                providerAccountId: googleUser.id,
                accessToken: token.access_token,
                refreshToken: token.refresh_token
              }
            }
          }
        })
      }

      const jwtToken = await reply.jwtSign({ userId: user.id, username: user.username })
      reply
        .setCookie('token', jwtToken, COOKIE_OPTIONS)
        .redirect(`${process.env.CLIENT_URL}/profile`)
    } catch (err) {
      reply.redirect(`${process.env.CLIENT_URL ?? ''}/login?error=oauth_failed`)
    }
  })

  // Discord callback
  fastify.get('/discord/callback', async (request, reply) => {
    try {
      const { token } = await (fastify as any).discordOAuth2.getAccessTokenFromAuthorizationCodeFlow(request)

      // Fetch Discord user info
      const userInfoRes = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${token.access_token}` }
      })
      const discordUser = await userInfoRes.json() as { id: string; email?: string; username: string }

      // Upsert OAuthAccount and User
      let oauthAccount = await prisma.oAuthAccount.findUnique({
        where: { provider_providerAccountId: { provider: 'discord', providerAccountId: discordUser.id } },
        include: { user: true }
      })

      let user
      if (oauthAccount) {
        user = oauthAccount.user
        await prisma.oAuthAccount.update({
          where: { id: oauthAccount.id },
          data: { accessToken: token.access_token, refreshToken: token.refresh_token }
        })
      } else {
        user = await prisma.user.create({
          data: {
            username: discordUser.username || `discord_${discordUser.id.slice(0, 8)}`,
            email: discordUser.email || null,
            oauthAccounts: {
              create: {
                provider: 'discord',
                providerAccountId: discordUser.id,
                accessToken: token.access_token,
                refreshToken: token.refresh_token
              }
            }
          }
        })
      }

      const jwtToken = await reply.jwtSign({ userId: user.id, username: user.username })
      reply
        .setCookie('token', jwtToken, COOKIE_OPTIONS)
        .redirect(`${process.env.CLIENT_URL ?? ''}/profile`)
    } catch (err) {
      reply.redirect(`${process.env.CLIENT_URL ?? ''}/login?error=oauth_failed`)
    }
  })

  // Logout
  fastify.post('/logout', async (request, reply) => {
    reply
      .clearCookie('token', { path: '/' })
      .send({ ok: true })
  })
}
