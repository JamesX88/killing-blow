import fp from 'fastify-plugin'
import { createClient } from 'redis'

export default fp(async (fastify) => {
  const client = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' })
  await client.connect()

  fastify.decorate('redis', client)

  fastify.addHook('onClose', async () => {
    await client.quit()
  })
})
