import { z } from 'zod'

export const searchSchema = z.object({
  from: z.string().default('Алматы'),
  country: z.string().min(2),
  dateFrom: z.string().min(10, 'Укажите даты вылета'),
  dateTo: z.string().min(10, 'Укажите даты вылета'),
  nightsFrom: z.number().int().min(1).max(30),
  nightsTo: z.number().int().min(1).max(30),
  adults: z.number().int().min(1).max(9),
  childAges: z.array(z.number().int().min(0).max(17)).max(4),
  meal: z.string().nullable().optional(),
  stars: z.number().int().min(1).max(5).nullable().optional(),
  operator: z.string().nullable().optional(),
  priceMax: z.number().int().nullable().optional(),
})

export const offerSchema = z.object({
  operatorId: z.string().min(1, 'Выберите туроператора'),
  hotel: z.string().trim().min(2, 'Укажите отель'),
  stars: z.number().int().min(0).max(5),
  resort: z.string().trim().min(2, 'Укажите курорт'),
  fromDate: z.string().min(10, 'Укажите даты'),
  toDate: z.string().min(10, 'Укажите даты'),
  meal: z.string().trim().min(1, 'Укажите питание'),
  room: z.string().trim().min(1, 'Укажите номер'),
  flight: z.boolean(),
  transfer: z.boolean(),
  insurance: z.boolean(),
  net: z.number().int().min(0),
  price: z.number().int().min(1, 'Укажите цену клиенту'),
  note: z.string().optional(),
  source: z.enum(['manual', 'import', 'tourvisor', 'search']).default('manual'),
  externalRef: z.string().nullable().optional(),
}).refine(o => o.price >= o.net, { message: 'Цена клиенту не может быть ниже нетто', path: ['price'] })
  .refine(o => o.toDate > o.fromDate, { message: 'Дата выезда должна быть позже заезда', path: ['toDate'] })

export const bookingSchema = z.object({
  offerId: z.string(),
  number: z.string().trim().optional(),
  paymentDeadline: z.string().min(10, 'Укажите дедлайн оплаты оператору'),
  comment: z.string().trim().optional(),
})

export const operatorSchema = z.object({
  name: z.string().trim().min(2, 'Укажите название'),
  paymentTerms: z.string().trim().min(2, 'Опишите условия оплаты'),
  commissionPct: z.number().min(0).max(50),
  contact: z.string().trim().optional(),
})
