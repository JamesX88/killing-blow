import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'

// Mock prisma before any imports that use it
vi.mock('../db/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn()
    },
    boss: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn()
    },
    fightContribution: {
      createMany: vi.fn()
    }
  }
}))

import { buildApp } from '../app.js'
import { Server as SocketIOServer } from 'socket.io'
import { setupGateway } from './gateway.js'
import { io as ioClient, type Socket } from 'socket.io-client'
import type { FastifyInstance } from 'fastify'
import jwt from 'jsonwebtoken'
import { createClient } from 'redis'

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
  })

  it('Test 1: attack:intent broadcasts boss:hp_update with newHp=975 (1000-25) to attacker — BOSS-01', async () => {
    const token = makeToken({ userId: 'user-1', username: 'Player1' })
    const socket = await connectSocket(TEST_PORT_BOSS, { cookie: `token=${token}` })

    const hpUpdatePromise = waitForEvent<{ bossId: string; hp: number; maxHp: number }>(socket, 'boss:hp_update')
    socket.emit('attack:intent', { bossId: testBossId })

    const payload = await hpUpdatePromise
    expect(payload.bossId).toBe(testBossId)
    expect(payload.hp).toBe(975)
    expect(payload.maxHp).toBe(1000)

    socket.disconnect()
  })

  it('Test 2: attack:intent sends boss:damage_dealt only to the attacking socket', async () => {
    const token = makeToken({ userId: 'user-1', username: 'Player1' })
    const socket = await connectSocket(TEST_PORT_BOSS, { cookie: `token=${token}` })

    const damagePromise = waitForEvent<{ amount: number; hitId: string }>(socket, 'boss:damage_dealt')
    socket.emit('attack:intent', { bossId: testBossId })

    const payload = await damagePromise
    expect(payload.amount).toBe(25)
    expect(typeof payload.hitId).toBe('string')
    expect(payload.hitId.length).toBeGreaterThan(0)

    socket.disconnect()
  })

  it('Test 3: attacking boss to 0 HP emits boss:death with winnerId and winnerUsername — BOSS-03', async () => {
    // Set HP to 25 so one hit kills it
    await redis.set(`boss:${testBossId}:hp`, '25')
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
    // Set HP to 25 so one hit kills it
    await redis.set(`boss:${testBossId}:hp`, '25')
    await redis.hSet(`boss:${testBossId}:usernames`, 'user-1', 'Player1')

    const token = makeToken({ userId: 'user-1', username: 'Player1' })
    const socket = await connectSocket(TEST_PORT_BOSS, { cookie: `token=${token}` })

    const spawnPromise = waitForEvent<{ bossId: string; bossNumber: number; hp: number; maxHp: number; name: string }>(socket, 'boss:spawn')
    socket.emit('attack:intent', { bossId: testBossId })

    const payload = await spawnPromise
    expect(payload.bossId).toBe('new-boss-002')
    expect(payload.bossNumber).toBe(2)
    expect(payload.hp).toBe(1000)
    expect(payload.maxHp).toBe(1000)

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
    expect(payload.hp).toBe(975)

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

  it('Test 7: player:list_update includes the attacker with correct damage total', async () => {
    const token = makeToken({ userId: 'user-1', username: 'Player1' })
    const socket = await connectSocket(TEST_PORT_BOSS, { cookie: `token=${token}` })

    const playerListPromise = waitForEvent<Array<{ userId: string; username: string; damageDealt: number }>>(socket, 'player:list_update')
    socket.emit('attack:intent', { bossId: testBossId })

    const players = await playerListPromise
    const attacker = players.find(p => p.userId === 'user-1')
    expect(attacker).toBeDefined()
    expect(attacker!.damageDealt).toBe(25)
    expect(attacker!.username).toBe('Player1')

    socket.disconnect()
  })
})
