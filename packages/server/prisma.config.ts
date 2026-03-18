import { defineConfig } from 'prisma/config'

export default defineConfig({
  datasourceUrl: process.env.DATABASE_URL ?? 'postgresql://killingblow:killingblow@localhost:5432/killingblow_dev',
})
