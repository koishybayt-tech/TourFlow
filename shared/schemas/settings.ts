import { z } from 'zod'

export const modulesSchema = z.object({
  group: z.boolean(),
  package: z.boolean(),
  tickets: z.boolean(),
  team: z.boolean(),
  migration: z.boolean(),
})

export const inviteSchema = z.object({
  email: z.email('Укажите корректный email'),
  role: z.enum(['OWNER', 'MANAGER', 'CALLCENTER', 'GUIDE']),
})

export const memberPatchSchema = z.object({
  role: z.enum(['OWNER', 'MANAGER', 'CALLCENTER', 'GUIDE']).optional(),
  onVacation: z.boolean().optional(),
  signRight: z.boolean().optional(),
  active: z.boolean().optional(),
})

export const acceptInviteSchema = z.object({
  token: z.string().min(10),
  name: z.string().trim().min(2, 'Укажите имя'),
  password: z.string().min(8, 'Пароль — минимум 8 символов'),
})

export const companySchema = z.object({
  name: z.string().trim().min(2, 'Укажите название'),
  bin: z.string().trim().regex(/^\d{12}$/, 'БИН — 12 цифр'),
  director: z.string().trim().min(2, 'Укажите директора'),
  legalAddress: z.string().trim(),
  bank: z.string().trim(),
  iik: z.string().trim().refine(v => v === '' || /^KZ[0-9A-Z]{18}$/.test(v), 'ИИК — KZ и 18 символов'),
  bik: z.string().trim(),
  license: z.string().trim().optional(),
  phone: z.string().trim(),
  email: z.string().trim(),
  instagram: z.string().trim().optional(),
  refundRule: z.string().trim().min(5, 'Опишите правило возврата'),
  refundHoldPct: z.number().int().min(0).max(100),
})
