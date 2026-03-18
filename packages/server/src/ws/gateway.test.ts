import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

// Mock prisma before any imports that use it
vi.mock('../db/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn()
    }
  }
}))

import { buildApp } from '../app.js'
import { Server as SocketIOServer } from 'socket.io'
import { setupGateway } from './gateway.js'
import { io as ioClient, type Socket } from 'socket.io-client'
import type { FastifyInstance } from 'fastify'
import jwt from 'jsonwebtoken'

const TEST_PORT = 3099
const JWT_SECRET = 'dev-secret'

function makeToken(payload: object): string {
  return jwt.sign(payload, JWT_SECRET)
}

function connectSocket(opts: {
  cookie?: string
  timeout?: number
}): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(`http://localhost:${TEST_PORT}`, {
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
    await connectSocket({ cookie: undefined }).catch((err: Error) => {
      errorMsg = err.message
    })
    expect(errorMsg).toBe('Authentication required')
  })

  it('rejects connection with invalid JWT with "Invalid token"', async () => {
    let errorMsg = ''
    await connectSocket({ cookie: 'token=notavalidtoken' }).catch((err: Error) => {
      errorMsg = err.message
    })
    expect(errorMsg).toBe('Invalid token')
  })

  it('accepts connection with valid JWT and sets socket.data.userId', async () => {
    const token = makeToken({ userId: 'user-123', username: 'testplayer' })
    const socket = await connectSocket({ cookie: `token=${token}` })
    expect(socket.connected).toBe(true)
    socket.disconnect()
  })
})
