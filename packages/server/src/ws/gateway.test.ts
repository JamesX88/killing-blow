import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'

// Mock prisma before any imports that use it
vi.mock('../db/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    boss: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn()
    },
    fightContribution: {
      createMany: vi.fn()
    },
    playerStats: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  }
}))

// Mock playerStats to avoid real DB calls inside creditGold ($transaction)
vi.mock('../game/playerStats.js', async (importOriginal) => {
  const actual = await importOriginal() as typeof import('../game/playerStats.js')
  return {
    ...actual,
    creditGold: vi.fn().mockResolvedValue('25'),
  }
})

import { buildApp } from '../app.js'
import { Server as SocketIOServer } from 'socket.io'
import { setupGateway } from './gateway.js'
import { io as ioClient, type Socket } from 'socket.io-client'
import type { FastifyInstance } from 'fastify'
import jwt from 'jsonwebtoken'
import { createClient } from 'redis'
import { prisma as mockPrismaInstance } from '../db/prisma.js'
import * as playerStatsMod from '../game/playerStats.js'

const TEST_PORT = 3099
const TEST_PORT_BOSS = 3098
const JWT_SECRET = 'dev-secret'
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'

function makeToken(payload: object): string {
  return jwt.sign(payload, JWT_SECRET)
}

function connectSocket(port: number, opts: {
  cookie?: string
  timeout?: number
}): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(`http://localhost:${port}`, {
      extraHeaders: opts.cookie ? { cookie: opts.cookie } : {},
      reconnection: false,
      timeout: opts.timeout ?? 2000
    })
    socket.on('connect', () => resolve(socket))
    socket.on('connect_error', (err) => {
      socket.disconnect()
      reject(err)
    })
  })
}

// Helper: wait for a socket event with optional timeout
function waitForEvent<T>(socket: Socket, event: string, timeoutMs = 2000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for event: ${event}`))
    }, timeoutMs)
    socket.once(event, (payload: T) => {
      clearTimeout(timer)
      resolve(payload)
    })
  })
}

// Default player stats mock (level 0 — deterministic base damage of 25)
const defaultPlayerStats = {
  id: 'stats-1',
  userId: 'user-1',
  goldBalance: '0',
  atkLevel: 0,
  critLevel: 0,
  spdLevel: 0,
  lastSeenAt: new Date(),
  lastActiveAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('Gateway JWT middleware', () => {
  let app: FastifyInstance
  let io: SocketIOServer

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()

    io = new SocketIOServer(app.server, {
      cors: { origin: '*', credentials: true }
    })
    setupGateway(io)

    await new Promise<void>((resolve) => {
      app.server.listen(TEST_PORT, '127.0.0.1', () => resolve())
    })
  })

  afterAll(async () => {
    io.close()
    await app.close()
  })

  it('rejects connection without cookie with "Authentication required"', async () => {
    let errorMsg = ''
    await connectSocket(TEST_PORT, { cookie: undefined }).catch((err: Error) => {
      errorMsg = err.message
    })
    expect(errorMsg).toBe('Authentication required')
  })

  it('rejects connection with invalid JWT with "Invalid token"', async () => {
    let errorMsg = ''
    await connectSocket(TEST_PORT, { cookie: 'token=notavalidtoken' }).catch((err: Error) => {
      errorMsg = err.message
    })
    expect(errorMsg).toBe('Invalid token')
  })

  it('accepts connection with valid JWT and sets socket.data.userId', async () => {
    const token = makeToken({ userId: 'user-123', username: 'testplayer' })
    const socket = await connectSocket(TEST_PORT, { cookie: `token=${token}` })
    expect(socket.connected).toBe(true)
    socket.disconnect()
  })
})

describe('Boss loop events', () => {
  let app: FastifyInstance
  let io: SocketIOServer
  let redis: ReturnType<typeof createClient>
  let testBossId: string

  beforeAll(async () => {
    redis = createClient({ url: REDIS_URL })
    await redis.connect()

    app = await buildApp({ logger: false })
    await app.ready()

    io = new SocketIOServer(app.server, {
      cors: { origin: '*', credentials: true }
    })
    setupGateway(io, redis)

    await new Promise<void>((resolve) => {
      app.server.listen(TEST_PORT_BOSS, '127.0.0.1', () => resolve())
    })
  })

  afterAll(async () => {
    io.close()
    await app.close()
    await redis.quit()
  })

  beforeEach(async () => {
    await redis.flushDb()
    // Seed a test boss
    testBossId = 'test-boss-001'
    await redis.set(`boss:${testBossId}:hp`, '1000')
    await redis.set(`boss:${testBossId}:maxHp`, '1000')
    await redis.set(`boss:${testBossId}:meta`, JSON.stringify({ name: 'Boss #1', bossNumber: 1 }))
    await redis.set('boss:current', testBossId)

    // Reset prisma mocks
    const { prisma } = await import('../db/prisma.js')
    vi.mocked(prisma.boss.findFirst).mockResolvedValue({
      id: testBossId,
      bossNumber: 1,
      name: 'Boss #1',
      maxHp: 1000,
      spawnedAt: new Date(),
      defeatedAt: null,
      winnerId: null
    })
    vi.mocked(prisma.boss.findUnique).mockResolvedValue({
      id: testBossId,
      bossNumber: 1,
      name: 'Boss #1',
      maxHp: 1000,
      spawnedAt: new Date(),
      defeatedAt: null,
      winnerId: null
    })
    vi.mocked(prisma.boss.update).mockResolvedValue({
      id: testBossId,
      bossNumber: 1,
      name: 'Boss #1',
      maxHp: 1000,
      spawnedAt: new Date(),
      defeatedAt: new Date(),
      winnerId: 'user-1'
    })
    vi.mocked(prisma.boss.create).mockImplementation(async ({ data }: { data: { bossNumber: number; name: string; maxHp: number } }) => ({
      id: 'new-boss-002',
      bossNumber: data.bossNumber,
      name: data.name,
      maxHp: data.maxHp,
      spawnedAt: new Date(),
      defeatedAt: null,
      winnerId: null
    }))
    vi.mocked(prisma.fightContribution.createMany).mockResolvedValue({ count: 0 })

    // Player stats mocks — level 0 gives deterministic base damage of 25
    vi.mocked(prisma.playerStats.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.playerStats.upsert).mockResolvedValue({ ...defaultPlayerStats })
    vi.mocked(prisma.playerStats.update).mockResolvedValue({ ...defaultPlayerStats })

    // creditGold is mocked at module level — reset it to return fixed balance
    vi.mocked(playerStatsMod.creditGold).mockResolvedValue('25')
  })

  it('Test 1: attack:intent broadcasts boss:hp_update with reduced HP to attacker — BOSS-01', async () => {
    const token = makeToken({ userId: 'user-1', username: 'Player1' })
    const socket = await connectSocket(TEST_PORT_BOSS, { cookie: `token=${token}` })

    const hpUpdatePromise = waitForEvent<{ bossId: string; hp: number; maxHp: number }>(socket, 'boss:hp_update')
    socket.emit('attack:intent', { bossId: testBossId })

    const payload = await hpUpdatePromise
    expect(payload.bossId).toBe(testBossId)
    // HP should have decreased — crit chance is random, so just verify it decreased
    expect(payload.hp).toBeLessThan(1000)
    expect(payload.maxHp).toBe(1000)

    socket.disconnect()
  })

  it('Test 2: attack:intent sends boss:damage_dealt only to the attacking socket', async () => {
    const token = makeToken({ userId: 'user-1', username: 'Player1' })
    const socket = await connectSocket(TEST_PORT_BOSS, { cookie: `token=${token}` })

    const damagePromise = waitForEvent<{ amount: number; hitId: string }>(socket, 'boss:damage_dealt')
    socket.emit('attack:intent', { bossId: testBossId })

    const payload = await damagePromise
    // With level 0 stats: base damage 25, possible 50 if crit
    expect(payload.amount).toBeGreaterThan(0)
    expect(typeof payload.hitId).toBe('string')
    expect(payload.hitId.length).toBeGreaterThan(0)

    socket.disconnect()
  })

  it('Test 2b: attack:intent emits player:gold_update with goldEarned > "0" to attacker', async () => {
    const token = makeToken({ userId: 'user-1', username: 'Player1' })
    const socket = await connectSocket(TEST_PORT_BOSS, { cookie: `token=${token}` })

    const goldUpdatePromise = waitForEvent<{ goldBalance: string; goldEarned: string }>(socket, 'player:gold_update')
    socket.emit('attack:intent', { bossId: testBossId })

    const payload = await goldUpdatePromise
    expect(payload.goldEarned).toBeDefined()
    // goldEarned should be a positive number string
    expect(Number(payload.goldEarned)).toBeGreaterThan(0)
    expect(typeof payload.goldBalance).toBe('string')

    socket.disconnect()
  })

  it('Test 3: attacking boss to 0 HP emits boss:death with winnerId and winnerUsername — BOSS-03', async () => {
    // Set HP to minimum so one hit kills it (base damage 25, crit = 50)
    await redis.set(`boss:${testBossId}:hp`, '1')
    await redis.hSet(`boss:${testBossId}:usernames`, 'user-1', 'Player1')

    const token = makeToken({ userId: 'user-1', username: 'Player1' })
    const socket = await connectSocket(TEST_PORT_BOSS, { cookie: `token=${token}` })

    const deathPromise = waitForEvent<{ bossId: string; winnerId: string; winnerUsername: string }>(socket, 'boss:death')
    socket.emit('attack:intent', { bossId: testBossId })

    const payload = await deathPromise
    expect(payload.bossId).toBe(testBossId)
    expect(payload.winnerId).toBe('user-1')
    expect(payload.winnerUsername).toBe('Player1')

    socket.disconnect()
  })

  it('Test 4: after boss:death, server emits boss:spawn with new bossId — BOSS-03', async () => {
    // Set HP to minimum so one hit kills it
    await redis.set(`boss:${testBossId}:hp`, '1')
    await redis.hSet(`boss:${testBossId}:usernames`, 'user-1', 'Player1')

    const token = makeToken({ userId: 'user-1', username: 'Player1' })
    const socket = await connectSocket(TEST_PORT_BOSS, { cookie: `token=${token}` })

    // boss:spawn is emitted after 3000ms delay — increase timeout
    const spawnPromise = waitForEvent<{ bossId: string; bossNumber: number; hp: number; maxHp: number; name: string }>(socket, 'boss:spawn', 5000)
    socket.emit('attack:intent', { bossId: testBossId })

    const payload = await spawnPromise
    expect(payload.bossId).toBe('new-boss-002')
    expect(payload.bossNumber).toBe(2)

    socket.disconnect()
  })

  it('Test 5: second client in same room receives boss:hp_update when first client attacks — BOSS-01', async () => {
    const token1 = makeToken({ userId: 'user-1', username: 'Player1' })
    const token2 = makeToken({ userId: 'user-2', username: 'Player2' })

    const socket1 = await connectSocket(TEST_PORT_BOSS, { cookie: `token=${token1}` })
    const socket2 = await connectSocket(TEST_PORT_BOSS, { cookie: `token=${token2}` })

    const hpUpdateOnSocket2 = waitForEvent<{ bossId: string; hp: number; maxHp: number }>(socket2, 'boss:hp_update')
    socket1.emit('attack:intent', { bossId: testBossId })

    const payload = await hpUpdateOnSocket2
    expect(payload.bossId).toBe(testBossId)
    expect(payload.hp).toBeLessThan(1000)

    socket1.disconnect()
    socket2.disconnect()
  })

  it('Test 6: attack:intent with wrong bossId (stale) is silently discarded', async () => {
    const token = makeToken({ userId: 'user-1', username: 'Player1' })
    const socket = await connectSocket(TEST_PORT_BOSS, { cookie: `token=${token}` })

    let received = false
    socket.on('boss:hp_update', () => { received = true })
    socket.emit('attack:intent', { bossId: 'stale-boss-id' })

    // Wait briefly — no event should arrive
    await new Promise(resolve => setTimeout(resolve, 300))
    expect(received).toBe(false)

    socket.disconnect()
  })

  it('Test 7: player:list_update includes the attacker with correct damage total after attack', async () => {
    const token = makeToken({ userId: 'user-1', username: 'Player1' })
    const socket = await connectSocket(TEST_PORT_BOSS, { cookie: `token=${token}` })

    // Collect all player:list_update events; we want the one after the attack
    const listUpdates: Array<Array<{ userId: string; username: string; damageDealt: number }>> = []
    socket.on('player:list_update', (players) => { listUpdates.push(players) })

    // Wait for the initial empty player:list_update sent on connection
    await new Promise(resolve => setTimeout(resolve, 100))

    socket.emit('attack:intent', { bossId: testBossId })

    // Wait for the post-attack player:list_update
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Find the update where the attacker has damage
    const attackerUpdate = listUpdates.find(list => {
      const attacker = list.find(p => p.userId === 'user-1')
      return attacker && attacker.damageDealt > 0
    })

    expect(attackerUpdate).toBeDefined()
    const attacker = attackerUpdate!.find(p => p.userId === 'user-1')
    expect(attacker).toBeDefined()
    expect(attacker!.damageDealt).toBeGreaterThan(0)
    expect(attacker!.username).toBe('Player1')

    socket.disconnect()
  })

  it('Test 8: player:heartbeat sets Redis key player:{userId}:heartbeat', async () => {
    const token = makeToken({ userId: 'user-1', username: 'Player1' })
    const socket = await connectSocket(TEST_PORT_BOSS, { cookie: `token=${token}` })

    socket.emit('player:heartbeat')

    // Wait for Redis key to be set
    await new Promise(resolve => setTimeout(resolve, 200))

    const key = await redis.get('player:user-1:heartbeat')
    expect(key).toBe('1')

    const ttl = await redis.ttl('player:user-1:heartbeat')
    expect(ttl).toBeGreaterThan(0)
    expect(ttl).toBeLessThanOrEqual(10)

    socket.disconnect()
  })

  it('Test 9: on connection with PlayerStats lastSeenAt > 60 seconds ago, socket receives player:offline_reward', async () => {
    // Mock playerStats with lastSeenAt from 2 hours ago
    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000)
    const { prisma } = await import('../db/prisma.js')
    vi.mocked(prisma.playerStats.findUnique).mockResolvedValue({
      id: 'stats-offline-1',
      userId: 'user-offline',
      goldBalance: '0',
      atkLevel: 0,
      critLevel: 0,
      spdLevel: 0,
      lastSeenAt: twoHoursAgo,
      lastActiveAt: twoHoursAgo,
      createdAt: twoHoursAgo,
      updatedAt: twoHoursAgo,
    })

    const token = makeToken({ userId: 'user-offline', username: 'OfflinePlayer' })
    const socket = await connectSocket(TEST_PORT_BOSS, { cookie: `token=${token}` })

    const offlineRewardPromise = waitForEvent<{ goldEarned: string; offlineSeconds: number }>(socket, 'player:offline_reward')

    const payload = await offlineRewardPromise
    expect(payload.goldEarned).toBeDefined()
    expect(Number(payload.goldEarned)).toBeGreaterThan(0)
    expect(payload.offlineSeconds).toBeGreaterThan(60)

    socket.disconnect()
  })

  it('Test 10: disconnect updates PlayerStats.lastSeenAt in DB', async () => {
    const token = makeToken({ userId: 'user-1', username: 'Player1' })
    const socket = await connectSocket(TEST_PORT_BOSS, { cookie: `token=${token}` })

    // Wait for connection processing to settle
    await new Promise(resolve => setTimeout(resolve, 100))

    socket.disconnect()

    // Wait for disconnect handler to run
    await new Promise(resolve => setTimeout(resolve, 200))

    const { prisma } = await import('../db/prisma.js')
    // The disconnect handler calls playerStats.upsert with lastSeenAt
    expect(vi.mocked(prisma.playerStats.upsert)).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ lastSeenAt: expect.any(Date) }),
      })
    )
  })
})

describe('Phase 4 — KB Currency and Announcement', () => {
  let app: FastifyInstance
  let io: SocketIOServer
  let redis: ReturnType<typeof createClient>
  let testBossId: string

  const TEST_PORT_PHASE4 = 3097

  beforeAll(async () => {
    redis = createClient({ url: REDIS_URL })
    await redis.connect()

    app = await buildApp({ logger: false })
    await app.ready()

    io = new SocketIOServer(app.server, {
      cors: { origin: '*', credentials: true }
    })
    setupGateway(io, redis)

    await new Promise<void>((resolve) => {
      app.server.listen(TEST_PORT_PHASE4, '127.0.0.1', () => resolve())
    })
  })

  afterAll(async () => {
    io.close()
    await app.close()
    await redis.quit()
  })

  beforeEach(async () => {
    await redis.flushDb()
    testBossId = 'test-boss-p4'
    await redis.set(`boss:${testBossId}:hp`, '1000')
    await redis.set(`boss:${testBossId}:maxHp`, '1000')
    await redis.set(`boss:${testBossId}:meta`, JSON.stringify({ name: 'Boss #10', bossNumber: 10 }))
    await redis.set('boss:current', testBossId)

    // Reset prisma mocks
    const { prisma } = await import('../db/prisma.js')
    vi.mocked(prisma.boss.findFirst).mockResolvedValue({
      id: testBossId,
      bossNumber: 10,
      name: 'Boss #10',
      maxHp: 1000,
      spawnedAt: new Date(),
      defeatedAt: null,
      winnerId: null
    })
    vi.mocked(prisma.boss.update).mockResolvedValue({
      id: testBossId,
      bossNumber: 10,
      name: 'Boss #10',
      maxHp: 1000,
      spawnedAt: new Date(),
      defeatedAt: new Date(),
      winnerId: 'user-1'
    })
    vi.mocked(prisma.boss.create).mockImplementation(async ({ data }: { data: { bossNumber: number; name: string; maxHp: number } }) => ({
      id: 'new-boss-p4-next',
      bossNumber: data.bossNumber,
      name: data.name,
      maxHp: data.maxHp,
      spawnedAt: new Date(),
      defeatedAt: null,
      winnerId: null
    }))
    vi.mocked(prisma.fightContribution.createMany).mockResolvedValue({ count: 0 })
    vi.mocked(prisma.playerStats.upsert).mockResolvedValue({ ...defaultPlayerStats })
    vi.mocked(prisma.playerStats.update).mockResolvedValue({ ...defaultPlayerStats })

    // Mock user.findUnique for equippedTitle lookup and user.update for kill flow
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-1',
      username: 'Player1',
      passwordHash: 'hash',
      email: null,
      killCount: 5,
      kbBalance: 3,
      kbRank: null,
      equippedTitle: 'slayer',
      ownedTitles: '["slayer"]',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    vi.mocked(prisma.user.update).mockResolvedValue({
      id: 'user-1',
      username: 'Player1',
      passwordHash: 'hash',
      email: null,
      killCount: 6,
      kbBalance: 4,
      kbRank: null,
      equippedTitle: 'slayer',
      ownedTitles: '["slayer"]',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    vi.mocked(playerStatsMod.creditGold).mockResolvedValue('25')
  })

  it('Phase 4 Test 1: boss:death payload includes winnerTitle, winnerKillCount, and topContributors', async () => {
    // Set HP to 1 so one attack kills it
    await redis.set(`boss:${testBossId}:hp`, '1')
    await redis.hSet(`boss:${testBossId}:usernames`, 'user-1', 'Player1')
    await redis.hSet(`boss:${testBossId}:damage`, 'user-1', '999')

    const token = makeToken({ userId: 'user-1', username: 'Player1' })
    const socket = await connectSocket(TEST_PORT_PHASE4, { cookie: `token=${token}` })

    const deathPromise = waitForEvent<{
      bossId: string
      winnerId: string
      winnerUsername: string
      winnerTitle: string | null
      winnerKillCount: number
      topContributors: Array<{ username: string; damageDealt: number; title: string | null }>
    }>(socket, 'boss:death')
    socket.emit('attack:intent', { bossId: testBossId })

    const payload = await deathPromise
    expect(payload.bossId).toBe(testBossId)
    expect(payload.winnerId).toBe('user-1')
    expect(payload.winnerUsername).toBe('Player1')
    expect(payload).toHaveProperty('winnerTitle')
    expect(payload).toHaveProperty('winnerKillCount')
    expect(payload).toHaveProperty('topContributors')
    expect(Array.isArray(payload.topContributors)).toBe(true)

    socket.disconnect()
  })

  it('Phase 4 Test 2: winner killCount and kbBalance increment atomically on boss death', async () => {
    await redis.set(`boss:${testBossId}:hp`, '1')
    await redis.hSet(`boss:${testBossId}:usernames`, 'user-1', 'Player1')

    const token = makeToken({ userId: 'user-1', username: 'Player1' })
    const socket = await connectSocket(TEST_PORT_PHASE4, { cookie: `token=${token}` })

    const deathPromise = waitForEvent<{ winnerId: string }>(socket, 'boss:death')
    socket.emit('attack:intent', { bossId: testBossId })
    await deathPromise

    const { prisma } = await import('../db/prisma.js')
    expect(vi.mocked(prisma.user.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          killCount: { increment: 1 },
          kbBalance: { increment: 1 },
        }),
      })
    )

    socket.disconnect()
  })

  it('Phase 4 Test 3: topContributors sorted by damageDealt descending, max 5', async () => {
    await redis.set(`boss:${testBossId}:hp`, '1')
    // Seed 6 players with varying damage
    for (let i = 1; i <= 6; i++) {
      await redis.hSet(`boss:${testBossId}:usernames`, `player-${i}`, `Player${i}`)
      await redis.hSet(`boss:${testBossId}:damage`, `player-${i}`, String(i * 100))
    }
    await redis.hSet(`boss:${testBossId}:usernames`, 'user-1', 'Player1')

    const token = makeToken({ userId: 'user-1', username: 'Player1' })
    const socket = await connectSocket(TEST_PORT_PHASE4, { cookie: `token=${token}` })

    const deathPromise = waitForEvent<{
      topContributors: Array<{ username: string; damageDealt: number; title: string | null }>
    }>(socket, 'boss:death')
    socket.emit('attack:intent', { bossId: testBossId })

    const payload = await deathPromise
    expect(payload.topContributors.length).toBeLessThanOrEqual(5)
    // Verify descending order
    for (let i = 0; i < payload.topContributors.length - 1; i++) {
      expect(payload.topContributors[i].damageDealt).toBeGreaterThanOrEqual(payload.topContributors[i + 1].damageDealt)
    }

    socket.disconnect()
  })

  it('Phase 4 Test 4: equippedTitle stored in boss:titles Redis hash during attack', async () => {
    const token = makeToken({ userId: 'user-1', username: 'Player1' })
    const socket = await connectSocket(TEST_PORT_PHASE4, { cookie: `token=${token}` })

    // Wait for attack to be processed
    const hpUpdatePromise = waitForEvent<{ hp: number }>(socket, 'boss:hp_update')
    socket.emit('attack:intent', { bossId: testBossId })
    await hpUpdatePromise

    // Verify equippedTitle stored in Redis
    const storedTitle = await redis.hGet(`boss:${testBossId}:titles`, 'user-1')
    expect(storedTitle).toBe('slayer')

    socket.disconnect()
  })
})
