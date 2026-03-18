import type { FastifyInstance } from 'fastify'
import { prisma } from '../db/prisma.js'

export default async function profileRoutes(fastify: FastifyInstance) {
  fastify.get('/profile/:userId', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.params as { userId: string }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        killCount: true,
        kbRank: true,
        createdAt: true
      }
    })
    if (!user) return reply.status(404).send({ error: 'User not found' })
    return user
  })
}
