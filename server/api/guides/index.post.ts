import { z } from 'zod'

export const guideSchema = z.object({
  fullName: z.string().trim().min(2, 'Укажите ФИО'),
  birthDate: z.string().nullable().optional(),
  sex: z.string().default('муж.'),
  languages: z.array(z.string()).min(1, 'Укажите языки'),
  experienceYears: z.number().int().min(0),
  agencies: z.string().optional(),
  rate: z.number().int().min(0),
  rating: z.number().min(0).max(5).nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'guides')
  const g = await body(event, guideSchema)
  const row = await ctx.db.guide.create({ data: { organizationId: ctx.organizationId, ...g, birthDate: dateOnly(g.birthDate), rating: g.rating ?? null } })
  return { id: row.id }
})
