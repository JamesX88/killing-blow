import Fastify from 'fastify'
import cookiePlugin from './plugins/cookie.js'
import jwtPlugin from './plugins/jwt.js'
import oauthPlugin from './plugins/oauth.js'
import authRoutes from './routes/auth.js'
import oauthRoutes from './routes/oauth.js'
import profileRoutes from './routes/profile.js'
import bossRoutes from './routes/boss.js'

export async function buildApp(opts = {}) {
  const app = Fastify(opts)

  // Cookie MUST be registered before JWT (JWT uses cookie mode)
  // Cookie MUST also be registered before OAuth (Research Pitfall 1)
  await app.register(cookiePlugin)
  await app.register(jwtPlugin)
  await app.register(oauthPlugin)

  await app.register(authRoutes, { prefix: '/auth' })
  await app.register(oauthRoutes, { prefix: '/auth' })
  await app.register(profileRoutes)
  await app.register(bossRoutes)

  return app
}
