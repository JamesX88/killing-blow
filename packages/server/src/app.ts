import Fastify from 'fastify'
import cookiePlugin from './plugins/cookie.js'
import jwtPlugin from './plugins/jwt.js'
import authRoutes from './routes/auth.js'

export async function buildApp(opts = {}) {
  const app = Fastify(opts)

  // Cookie MUST be registered before JWT (JWT uses cookie mode)
  await app.register(cookiePlugin)
  await app.register(jwtPlugin)

  await app.register(authRoutes, { prefix: '/auth' })

  return app
}
