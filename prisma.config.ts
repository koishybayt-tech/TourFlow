import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // A placeholder keeps `prisma generate` working in Docker builds without a database.
    url: process.env.DATABASE_URL || 'postgresql://tourflow:tourflow@localhost:5432/tourflow',
  },
})
