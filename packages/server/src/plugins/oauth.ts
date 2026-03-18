import fp from 'fastify-plugin'
import oauth2Plugin from '@fastify/oauth2'

export default fp(async (fastify) => {
  // Only register OAuth plugins if credentials are configured
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    fastify.register(oauth2Plugin, {
      name: 'googleOAuth2',
      credentials: {
        client: {
          id: process.env.GOOGLE_CLIENT_ID,
          secret: process.env.GOOGLE_CLIENT_SECRET
        },
        auth: oauth2Plugin.GOOGLE_CONFIGURATION
      },
      startRedirectPath: '/auth/google',
      callbackUri: `${process.env.SERVER_URL}/auth/google/callback`,
      scope: ['openid', 'profile', 'email'],
      pkce: 'S256'
    })
  }

  if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
    fastify.register(oauth2Plugin, {
      name: 'discordOAuth2',
      credentials: {
        client: {
          id: process.env.DISCORD_CLIENT_ID,
          secret: process.env.DISCORD_CLIENT_SECRET
        },
        auth: oauth2Plugin.DISCORD_CONFIGURATION
      },
      startRedirectPath: '/auth/discord',
      callbackUri: `${process.env.SERVER_URL}/auth/discord/callback`,
      scope: ['identify', 'email']
    })
  }
})
