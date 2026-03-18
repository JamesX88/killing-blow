import type { FastifyInstance } from 'fastify'
import argon2 from 'argon2'
import { z } from 'zod'
import { prisma } from '../db/prisma.js'

const registerSchema = z.object({
  username: z.string().min(1, 'This field is required.'),
  password: z.string().min(8, 'Password must be at least 8 characters.')
})

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
})

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days in ms
}

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/register', async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0].message })
    }
    const { username, password } = parsed.data

    const existing = await prisma.user.findUnique({ where: { username } })
    if (existing) {
      return reply.status(409).send({ error: 'That username is already taken. Try a different one.' })
    }

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id })
    const user = await prisma.user.create({ data: { username, passwordHash } })

    const token = await reply.jwtSign({ userId: user.id, username: user.username })
    reply
      .setCookie('token', token, COOKIE_OPTIONS)
      .send({ id: user.id, username: user.username })
  })

  fastify.post('/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'This field is required.' })
    }
    const { username, password } = parsed.data

    const user = await prisma.user.findUnique({ where: { username } })
    if (!user || !user.passwordHash) {
      return reply.status(401).send({ error: 'Incorrect username or password.' })
    }

    let valid = false
    try {
      valid = await argon2.verify(user.passwordHash, password)
    } catch {
      // Treat invalid hash format as invalid credentials
      valid = false
    }
    if (!valid) {
      return reply.status(401).send({ error: 'Incorrect username or password.' })
    }

    const token = await reply.jwtSign({ userId: user.id, username: user.username })
    reply
      .setCookie('token', token, COOKIE_OPTIONS)
      .send({ id: user.id, username: user.username, killCount: user.killCount })
  })

  fastify.get('/me', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, killCount: true, kbRank: true }
    })
    if (!user) return reply.status(404).send({ error: 'User not found' })
    return user
  })
}
