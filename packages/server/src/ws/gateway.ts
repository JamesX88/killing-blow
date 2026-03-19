import { Server, Socket } from 'socket.io'
import jwt from 'jsonwebtoken'
import { parse as parseCookie } from 'cookie'
import { createClient } from 'redis'
import crypto from 'crypto'
import {
  applyDamage,
  getCurrentBossId,
  spawnNextBoss,
  getActivePlayers,
  computeAggregateDps,
} from '../game/bossState.js'
import {
  getPlayerDamage,
  creditGold,
  computeOfflineGold,
  ACTIVE_BONUS_MULTIPLIER,
} from '../game/playerStats.js'
import Decimal from 'break_eternity.js'
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

  // Per-socket rate limit: max 10 attacks/second (50ms floor for DoS protection)
  const lastAttackTime = new Map<string, number>()

  io.on('connection', (socket) => {
    // socket.data.userId is guaranteed here
    socket.join('global-boss-room')
    console.log(`Player connected: ${socket.data.username} (${socket.data.userId})`)

    // Register all event handlers synchronously first — before any awaits
    // This prevents Socket.io from dropping events that arrive during async init

    socket.on('attack:intent', async ({ bossId }: { bossId: string }) => {
      if (!redis) return

      // DoS floor — max 20 attacks/second per socket
      const now = Date.now()
      const last = lastAttackTime.get(socket.id) || 0
      if (now - last < 50) return
      lastAttackTime.set(socket.id, now)

      // Validate bossId matches current boss — discard stale intents silently
      const currentBossId = await getCurrentBossId(redis)
      if (bossId !== currentBossId) return

      const userId = socket.data.userId as string
      const username = socket.data.username as string

      // Load player stats (upsert to guarantee row exists)
      const playerStats = await prisma.playerStats.upsert({
        where: { userId },
        update: {},
        create: { userId, goldBalance: '0' },
      })

      const damageResult = getPlayerDamage(playerStats)

      // Check active bonus via Redis heartbeat key
      const isActive = await redis.exists(`player:${userId}:heartbeat`)
      const damage = isActive
        ? Math.floor(damageResult.damage * ACTIVE_BONUS_MULTIPLIER)
        : damageResult.damage

      // Store username for player list (outside Lua — not atomic, but fine for display)
      await redis.hSet(`boss:${bossId}:usernames`, userId, username)

      // Store equipped title for player list and boss:death payload
      const userRecord = await prisma.user.findUnique({
        where: { id: userId },
        select: { equippedTitle: true }
      })
      if (userRecord?.equippedTitle) {
        await redis.hSet(`boss:${bossId}:titles`, userId, userRecord.equippedTitle)
      }

      // Get maxHp for threshold calculation
      const maxHpStr = await redis.get(`boss:${bossId}:maxHp`)
      const maxHp = Number(maxHpStr) || 1000

      const { newHp, killed, winnerId } = await applyDamage(redis, bossId, userId, damage, maxHp)

      // Award gold proportional to damage dealt
      const goldEarned = new Decimal(damage)
      const newGoldBalance = await creditGold(prisma, userId, goldEarned)
      socket.emit('player:gold_update', {
        goldBalance: newGoldBalance,
        goldEarned: goldEarned.toString(),
      })

      // Broadcast HP update to all connected clients
      io.to('global-boss-room').emit('boss:hp_update', { bossId, hp: newHp, maxHp })

      // Floating damage number to attacker only
      socket.emit('boss:damage_dealt', { amount: damage, hitId: crypto.randomUUID() })

      // Broadcast updated player list
      const players = await getActivePlayers(redis, bossId)
      io.to('global-boss-room').emit('player:list_update', players)

      if (killed) {
        const winnerUsername = (await redis.hGet(`boss:${bossId}:usernames`, winnerId)) || 'Unknown'

        // Atomically increment winner's killCount and kbBalance
        const updatedWinner = await prisma.user.update({
          where: { id: winnerId },
          data: {
            killCount: { increment: 1 },
            kbBalance: { increment: 1 },
          },
          select: { killCount: true, kbBalance: true, equippedTitle: true }
        })

        // Build top contributors from Redis (authoritative for current fight)
        const damageHash = await redis.hGetAll(`boss:${bossId}:damage`)
        const usernameHash = await redis.hGetAll(`boss:${bossId}:usernames`)
        const titlesHash = await redis.hGetAll(`boss:${bossId}:titles`)
        const topContributors = Object.entries(damageHash)
          .map(([uid, dmg]) => ({
            username: usernameHash[uid] ?? uid,
            damageDealt: Number(dmg),
            title: titlesHash[uid] ?? null,
          }))
          .sort((a, b) => b.damageDealt - a.damageDealt)
          .slice(0, 5)

        io.to('global-boss-room').emit('boss:death', {
          bossId,
          winnerId,
          winnerUsername,
          winnerTitle: updatedWinner.equippedTitle,
          winnerKillCount: updatedWinner.killCount,
          topContributors,
        })

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

        // Compute dynamic HP for next boss based on this fight's aggregate DPS
        let dynamicMaxHp: number | undefined
        try {
          const aggregateDps = await computeAggregateDps(redis, prisma, bossId)
          if (aggregateDps > 0) {
            const TARGET_FIGHT_DURATION = 300
            dynamicMaxHp = Math.round(aggregateDps * TARGET_FIGHT_DURATION)
          }
        } catch { /* fallback to default */ }

        // Wait for death animation + kill recognition before spawning next boss
        await new Promise(resolve => setTimeout(resolve, 3000))

        try {
          const nextBoss = await spawnNextBoss(redis, prisma, prevBossNumber, dynamicMaxHp)
          io.to('global-boss-room').emit('boss:spawn', nextBoss)
        } catch (err) {
          console.error('Failed to spawn next boss:', err)
        }
      }
    })

    socket.on('player:heartbeat', async () => {
      if (!redis) return
      const userId = socket.data.userId as string
      await redis.set(`player:${userId}:heartbeat`, '1', { EX: 10 })
    })

    socket.on('disconnect', async () => {
      console.log(`Player disconnected: ${socket.data.username}`)
      lastAttackTime.delete(socket.id)

      // Persist lastSeenAt for offline progress calculation
      const userId = socket.data.userId as string
      try {
        await prisma.playerStats.upsert({
          where: { userId },
          update: { lastSeenAt: new Date() },
          create: { userId, lastSeenAt: new Date() },
        })
      } catch { /* non-fatal */ }

      // Clean up heartbeat key
      if (redis) {
        await redis.del(`player:${userId}:heartbeat`).catch(() => {})
      }
    })

    // Async initialization after handlers are registered — safe to await now
    setImmediate(async () => {
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

      // Offline progress calculation on reconnect
      try {
        const stats = await prisma.playerStats.findUnique({ where: { userId: socket.data.userId } })
        if (stats) {
          const now = new Date()
          const offlineSeconds = (now.getTime() - stats.lastSeenAt.getTime()) / 1000

          if (offlineSeconds > 30) {
            const offlineGold = computeOfflineGold(stats, offlineSeconds)
            if (offlineGold.gt(0)) {
              await creditGold(prisma, socket.data.userId, offlineGold)
              socket.emit('player:offline_reward', {
                goldEarned: offlineGold.toString(),
                offlineSeconds: Math.floor(offlineSeconds),
              })
            }
          }

          // Reset lastSeenAt to current server time
          await prisma.playerStats.update({
            where: { userId: socket.data.userId },
            data: { lastSeenAt: now },
          })
        }
      } catch { /* non-fatal */ }
    })
  })
}
