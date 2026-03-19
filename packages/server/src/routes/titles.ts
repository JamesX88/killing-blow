import type { FastifyInstance } from 'fastify'
import { prisma } from '../db/prisma.js'
import { TITLE_CATALOGUE } from '../game/titles.js'

export default async function titleRoutes(fastify: FastifyInstance) {
  // GET /titles — list catalogue with ownership state
  fastify.get('/titles', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const userId = (req.user as { userId: string }).userId
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { ownedTitles: true, equippedTitle: true, kbBalance: true },
    })
    const owned: string[] = JSON.parse(user?.ownedTitles || '[]')
    const equipped = user?.equippedTitle || null

    const titles = TITLE_CATALOGUE.map(t => ({
      id: t.id,
      label: t.label,
      cost: t.cost,
      owned: owned.includes(t.id),
      equipped: t.id === equipped,
    }))

    return { titles, kbBalance: user?.kbBalance ?? 0 }
  })

  // POST /titles/:id/purchase — buy a title
  fastify.post('/titles/:id/purchase', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const titleId = (req.params as { id: string }).id
    const title = TITLE_CATALOGUE.find(t => t.id === titleId)
    if (!title) return reply.status(404).send({ error: 'Title not found' })

    const userId = (req.user as { userId: string }).userId
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { kbBalance: true, ownedTitles: true },
    })
    if (!user) return reply.status(404).send({ error: 'User not found' })

    const owned: string[] = JSON.parse(user.ownedTitles || '[]')
    if (owned.includes(titleId)) return reply.status(400).send({ error: 'Title already owned' })
    if (user.kbBalance < title.cost) return reply.status(400).send({ error: 'Not enough KB' })

    owned.push(titleId)
    await prisma.user.update({
      where: { id: userId },
      data: {
        kbBalance: { decrement: title.cost },
        ownedTitles: JSON.stringify(owned),
      },
    })

    return { success: true, kbBalance: user.kbBalance - title.cost }
  })

  // PATCH /titles/:id/equip — equip an owned title (or 'none' to unequip)
  fastify.patch('/titles/:id/equip', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const titleId = (req.params as { id: string }).id
    const userId = (req.user as { userId: string }).userId

    if (titleId === 'none') {
      await prisma.user.update({
        where: { id: userId },
        data: { equippedTitle: null },
      })
      return { success: true, equippedTitle: null }
    }

    const title = TITLE_CATALOGUE.find(t => t.id === titleId)
    if (!title) return reply.status(404).send({ error: 'Title not found' })

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { ownedTitles: true },
    })
    if (!user) return reply.status(404).send({ error: 'User not found' })

    const owned: string[] = JSON.parse(user.ownedTitles || '[]')
    if (!owned.includes(titleId)) return reply.status(403).send({ error: 'Title not owned' })

    await prisma.user.update({
      where: { id: userId },
      data: { equippedTitle: titleId },
    })

    return { success: true, equippedTitle: titleId }
  })
}
