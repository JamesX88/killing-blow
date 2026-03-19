import type { FastifyInstance } from 'fastify'
import { purchaseUpgrade, getUpgradeCost, type StatKey } from '../game/playerStats.js'
import { prisma } from '../db/prisma.js'

const VALID_STATS: readonly StatKey[] = ['atk', 'crit', 'spd'] as const

export default async function upgradeRoutes(fastify: FastifyInstance) {
  fastify.post<{ Params: { stat: string } }>('/upgrades/:stat', {
    onRequest: [fastify.authenticate],
  }, async (req, reply) => {
    const stat = req.params.stat as StatKey
    if (!VALID_STATS.includes(stat)) {
      return reply.status(400).send({ error: 'Invalid stat. Must be atk, crit, or spd.' })
    }

    const userId = (req.user as { userId: string }).userId

    const result = await purchaseUpgrade(prisma, userId, stat)

    if (!result.success) {
      return reply.status(400).send({ error: result.error })
    }

    return reply.send({
      atkLevel: result.stats.atkLevel,
      critLevel: result.stats.critLevel,
      spdLevel: result.stats.spdLevel,
      goldBalance: result.stats.goldBalance,
    })
  })

  // GET /upgrades/costs — return current costs for all stats
  fastify.get('/upgrades/costs', {
    onRequest: [fastify.authenticate],
  }, async (req, reply) => {
    const userId = (req.user as { userId: string }).userId
    const stats = await prisma.playerStats.findUnique({ where: { userId } })
    const levels = {
      atk: stats?.atkLevel ?? 0,
      crit: stats?.critLevel ?? 0,
      spd: stats?.spdLevel ?? 0,
    }
    return reply.send({
      atk: { level: levels.atk, cost: getUpgradeCost('atk', levels.atk).toString() },
      crit: { level: levels.crit, cost: getUpgradeCost('crit', levels.crit).toString() },
      spd: { level: levels.spd, cost: getUpgradeCost('spd', levels.spd).toString() },
      goldBalance: stats?.goldBalance ?? '0',
    })
  })
}
