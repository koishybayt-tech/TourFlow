import { z } from 'zod'
import { normalizePhone } from '../utils/phone'

const pipeline = z.enum(['GROUP', 'PACKAGE', 'BASE'])

export const dealCreateSchema = z.object({
  clientId: z.string().optional(),
  newClient: z.object({
    name: z.string().trim().min(2, 'Укажите имя клиента'),
    phone: z.string().refine(v => !!normalizePhone(v), 'Телефон: +7 и 10 цифр'),
  }).optional(),
  pipeline,
  title: z.string().trim().min(2, 'Опишите запрос'),
  departureId: z.string().nullable().optional(),
  people: z.number().int().min(1).max(99).optional(),
}).refine(v => v.clientId || v.newClient, 'Выберите клиента или добавьте нового')

export const dealPatchSchema = z.object({
  title: z.string().trim().min(1).optional(),
  dates: z.string().trim().nullable().optional(),
  people: z.number().int().min(1).max(99).optional(),
  budget: z.string().trim().nullable().optional(),
  visaHistory: z.string().trim().nullable().optional(),
  price: z.number().int().min(0).optional(),
  departureId: z.string().nullable().optional(),
  fullPayDeadline: z.string().nullable().optional(),
  reqChecks: z.record(z.string(), z.boolean()).optional(),
  reqComments: z.record(z.string(), z.string()).optional(),
  reqValues: z.record(z.string(), z.string()).optional(),
})

export const stageMoveSchema = z.object({ order: z.number().int().min(0), reason: z.string().trim().optional() })
export const lostSchema = z.object({ reason: z.string().min(1, 'Выберите причину'), comment: z.string().trim().optional() })
export const pipelineChangeSchema = z.object({ pipeline, order: z.number().int().min(0), departureId: z.string().nullable().optional(), reason: z.string().trim().min(2, 'Укажите причину') })

export const paymentSchema = z.object({
  amount: z.number().int().positive('Сумма должна быть больше нуля'),
  type: z.string().min(1),
  method: z.string().min(1),
  paidAt: z.string().optional(),
  comment: z.string().trim().optional(),
})

export const refundSchema = z.object({
  kind: z.enum(['refund', 'transfer', 'replace']),
  amount: z.number().int().min(0),
  hold: z.number().int().min(0),
  method: z.string().optional(),
  comment: z.string().trim().optional(),
  toDepartureId: z.string().nullable().optional(),
  replaceName: z.string().trim().optional(),
})

export const travelerSchema = z.object({
  fullNameLatin: z.string().trim().min(2, 'ФИО латиницей, как в паспорте').transform(v => v.toUpperCase()),
  passportNo: z.string().trim().optional(),
  passportExpiry: z.string().nullable().optional(),
  birthDate: z.string().nullable().optional(),
  isChild: z.boolean().optional(),
  childAge: z.number().int().min(0).max(17).nullable().optional(),
  visaStatus: z.string().trim().nullable().optional(),
})

export const taskCreateSchema = z.object({
  title: z.string().trim().min(2, 'Назовите задачу'),
  description: z.string().trim().optional(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
  dueAt: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  dealId: z.string().nullable().optional(),
  departureId: z.string().nullable().optional(),
  stageId: z.string().nullable().optional(),
  subtasks: z.array(z.object({ t: z.string(), done: z.boolean() })).optional(),
})

export const taskPatchSchema = taskCreateSchema.partial().omit({ dealId: true, departureId: true })

export const taskActionSchema = z.object({ action: z.enum(['start', 'complete', 'reopen']), result: z.string().trim().optional() })
