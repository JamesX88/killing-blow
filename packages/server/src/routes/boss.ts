import type { FastifyInstance } from 'fastify'
import { getCurrentBossId, getBossState } from '../game/bossState.js'

export default async function bossRoutes(fastify: FastifyInstance) {
  fastify.get('/boss/current', {
    onRequest: [fastify.authenticate]
  }, async (req, reply) => {
    const redis = fastify.redis
    if (!redis) return reply.status(503).send({ error: 'Game service unavailable' })

    const bossId = await getCurrentBossId(redis)
    if (!bossId) return reply.status(503).send({ error: 'No active boss' })

    const state = await getBossState(redis, bossId)
    if (!state) return reply.status(503).send({ error: 'Boss state unavailable' })

    return state
  })
}
