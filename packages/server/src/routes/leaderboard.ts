import type { FastifyInstance } from 'fastify'
import { prisma } from '../db/prisma.js'

export default async function leaderboardRoutes(fastify: FastifyInstance) {
  fastify.get('/leaderboard', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const { page = 1, limit = 20 } = req.query as { page?: number; limit?: number }
    const safeLimit = Math.min(Number(limit) || 20, 100)
    const safePage = Math.max(Number(page) || 1, 1)
    const skip = (safePage - 1) * safeLimit

    const users = await prisma.user.findMany({
      orderBy: { killCount: 'desc' },
      take: safeLimit,
      skip,
      select: {
        id: true,
        username: true,
        killCount: true,
        equippedTitle: true,
      },
    })

    const total = await prisma.user.count()

    return { users, page: safePage, limit: safeLimit, total }
  })
}
