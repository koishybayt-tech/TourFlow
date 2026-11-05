import { z } from 'zod'

export const EVENT_TYPES = { meeting: 'Встреча', call: 'Звонок', visa: 'Визовая запись', flight: 'Вылет', pay: 'Оплата', task: 'Задача', briefing: 'Брифинг' } as const

export const eventSchema = z.object({
  type: z.enum(['meeting', 'call', 'visa', 'flight', 'pay', 'task', 'briefing']),
  title: z.string().trim().min(2, 'Назовите событие'),
  description: z.string().trim().optional(),
  startAt: z.string().min(10, 'Укажите дату и время'),
  endAt: z.string().nullable().optional(),
  place: z.string().trim().optional(),
  assigneeId: z.string().nullable().optional(),
  dealId: z.string().nullable().optional(),
  departureId: z.string().nullable().optional(),
  remind: z.string().nullable().optional(),
  force: z.boolean().optional(),
})
