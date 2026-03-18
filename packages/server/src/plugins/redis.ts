import fp from 'fastify-plugin'
import { createClient } from 'redis'

export default fp(async (fastify) => {
  const client = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: { reconnectStrategy: false },
  })

  client.on('error', () => {/* suppress — handled in catch below */})

  try {
    await client.connect()
    fastify.log.info('Redis connected')
    fastify.decorate('redis', client)
    fastify.addHook('onClose', async () => { await client.quit() })
  } catch {
    fastify.log.warn('Redis unavailable — starting without it (required for Phase 2 game loop)')
  }
})
