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

export const directionSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, 'Укажите название направления'),
  keywords: z.array(z.string().trim().min(1)),
  managerIds: z.array(z.string()),
  mode: z.enum(['single', 'round']),
  backupId: z.string().nullable(),
})

export const directionsSchema = z.object({
  directions: z.array(directionSchema),
  defaultManagerId: z.string().nullable(),
})

const pipelineEnum = z.enum(['GROUP', 'PACKAGE', 'BASE'])

export const routingSchema = z.object({
  channels: z.object({ WHATSAPP: z.union([z.literal('auto'), pipelineEnum]), INSTAGRAM: z.union([z.literal('auto'), pipelineEnum]), SITE: z.union([z.literal('auto'), pipelineEnum]) }),
  fallback: z.union([z.literal('queue'), pipelineEnum]),
  keywords: z.object({ GROUP: z.array(z.string()), PACKAGE: z.array(z.string()), BASE: z.array(z.string()) }),
  links: z.array(z.object({
    tag: z.string().trim().regex(/^[A-Za-z0-9_-]{1,24}$/, 'Метка: латиница, цифры, - и _'),
    label: z.string().trim().min(1, 'Укажите текст ссылки'),
    pipeline: pipelineEnum,
    departureId: z.string().nullable().optional(),
  })),
})

export const routingTestSchema = z.object({
  text: z.string().trim().min(1, 'Введите текст обращения'),
  channel: z.enum(['WHATSAPP', 'INSTAGRAM', 'SITE']),
})
