import fp from 'fastify-plugin'
import { createClient } from 'redis'

export default fp(async (fastify) => {
  const client = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' })

  client.on('error', (err) => fastify.log.warn({ err }, 'Redis error'))

  try {
    await client.connect()
    fastify.log.info('Redis connected')
    fastify.decorate('redis', client)
    fastify.addHook('onClose', async () => { await client.quit() })
  } catch (err) {
    fastify.log.warn({ err }, 'Redis unavailable — server starting without it (needed for Phase 2 game loop)')
  }
})
