import { Server, Socket } from 'socket.io'
import jwt from 'jsonwebtoken'
import { parse as parseCookie } from 'cookie'
import { createClient } from 'redis'
import crypto from 'crypto'
import {
  applyDamage,
  getBaseDamage,
  getCurrentBossId,
  spawnNextBoss,
  getActivePlayers,
} from '../game/bossState.js'
import { prisma } from '../db/prisma.js'

export function setupGateway(io: Server, redis?: ReturnType<typeof createClient>) {
  // JWT middleware — validates token from cookie on WebSocket upgrade
  io.use((socket: Socket, next) => {
    const cookieHeader = socket.handshake.headers.cookie
    if (!cookieHeader) return next(new Error('Authentication required'))

    const cookies = parseCookie(cookieHeader)
    const token = cookies.token
    if (!token) return next(new Error('Authentication required'))

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as {
        userId: string
        username: string
      }
      socket.data.userId = decoded.userId
      socket.data.username = decoded.username
      next()
    } catch {
      next(new Error('Invalid token'))
    }
  })

  // Per-socket rate limit: max 10 attacks/second (100ms cooldown)
  const lastAttackTime = new Map<string, number>()

  io.on('connection', async (socket) => {
    // socket.data.userId is guaranteed here
    socket.join('global-boss-room')
    console.log(`Player connected: ${socket.data.username} (${socket.data.userId})`)

    // Send current player list to newly connected socket
    if (redis) {
      try {
        const currentBossId = await getCurrentBossId(redis)
        if (currentBossId) {
          const players = await getActivePlayers(redis, currentBossId)
          socket.emit('player:list_update', players)
        }
      } catch { /* non-fatal */ }
    }

    socket.on('attack:intent', async ({ bossId }: { bossId: string }) => {
      if (!redis) return

      // Rate limit: drop events faster than 100ms from the same socket
      const now = Date.now()
      const last = lastAttackTime.get(socket.id) || 0
      if (now - last < 100) return
      lastAttackTime.set(socket.id, now)

      // Validate bossId matches current boss — discard stale intents silently
      const currentBossId = await getCurrentBossId(redis)
      if (bossId !== currentBossId) return

      const userId = socket.data.userId as string
      const username = socket.data.username as string
      const damage = getBaseDamage() // 25

      // Store username for player list (outside Lua — not atomic, but fine for display)
      await redis.hSet(`boss:${bossId}:usernames`, userId, username)

      // Get maxHp for threshold calculation
      const maxHpStr = await redis.get(`boss:${bossId}:maxHp`)
      const maxHp = Number(maxHpStr) || 1000

      const { newHp, killed, winnerId } = await applyDamage(redis, bossId, userId, damage, maxHp)

      // Broadcast HP update to all connected clients
      io.to('global-boss-room').emit('boss:hp_update', { bossId, hp: newHp, maxHp })

      // Floating damage number to attacker only
      socket.emit('boss:damage_dealt', { amount: damage, hitId: crypto.randomUUID() })

      // Broadcast updated player list
      const players = await getActivePlayers(redis, bossId)
      io.to('global-boss-room').emit('player:list_update', players)

      if (killed) {
        const winnerUsername = (await redis.hGet(`boss:${bossId}:usernames`, winnerId)) || 'Unknown'

        io.to('global-boss-room').emit('boss:death', { bossId, winnerId, winnerUsername })

        // Persist defeat best-effort — DB failure must not block spawn
        let prevBossNumber = 0
        try {
          const bossRecord = await prisma.boss.findFirst({ where: { id: bossId } })
          if (bossRecord) {
            prevBossNumber = bossRecord.bossNumber
            await prisma.boss.update({
              where: { id: bossId },
              data: { defeatedAt: new Date(), winnerId },
            })
            const damageHash = await redis.hGetAll(`boss:${bossId}:damage`)
            const contributions = Object.entries(damageHash).map(([uId, dmg]) => ({
              bossId,
              userId: uId,
              damageDealt: Number(dmg),
            }))
            if (contributions.length > 0) {
              await prisma.fightContribution.createMany({ data: contributions, skipDuplicates: true })
            }
          }
        } catch (err) {
          console.error('Failed to persist boss defeat (spawn will still proceed):', err)
        }

        // Wait for death animation + kill recognition before spawning next boss
        await new Promise(resolve => setTimeout(resolve, 3000))

        try {
          const nextBoss = await spawnNextBoss(redis, prisma, prevBossNumber)
          io.to('global-boss-room').emit('boss:spawn', nextBoss)
        } catch (err) {
          console.error('Failed to spawn next boss:', err)
        }
      }
    })

    socket.on('disconnect', () => {
      console.log(`Player disconnected: ${socket.data.username}`)
      lastAttackTime.delete(socket.id)
    })
  })
}
