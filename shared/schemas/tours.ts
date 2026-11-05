import { z } from 'zod'

const num = z.number().nullable().optional()
const date = z.string().nullable().optional()
const cur = z.enum(['KZT', 'EUR', 'USD', 'CHF'])

export const tourSaveSchema = z.object({
  name: z.string().trim().max(120),
  flags: z.string().nullable().optional(),
  countries: z.array(z.string()),
  route: z.string(),
  startDate: date,
  endDate: date,
  seats: z.number().int().min(1).max(200),
  price: z.number().int().min(0),
  prepay: z.number().int().min(0),
  riseDate: date,
  riseAmount: z.number().int().nullable().optional(),
  payRule: z.string().nullable().optional(),
  description: z.string(),
  coverKey: z.string().nullable().optional(),
  included: z.array(z.string()),
  extra: z.array(z.string()),
  rates: z.object({ EUR: z.number(), USD: z.number(), CHF: z.number() }),
  ratesFixedAt: date,
  pricesCheckedAt: date,
  posts: z.array(z.object({ kind: z.string(), url: z.string() })),
  instagramText: z.string().nullable().optional(),
  days: z.array(z.object({ city: z.string(), items: z.array(z.string()), description: z.string(), transfer: z.string().nullable().optional(), mediaKeys: z.array(z.string()).default([]), availabilityChecked: z.boolean() })),
  flights: z.array(z.object({ from: z.string(), to: z.string(), departAt: z.string().nullable().optional(), airline: z.string().nullable().optional(), ticket: num, baggage: num, currency: cur, link: z.string().nullable().optional() })),
  stays: z.array(z.object({ city: z.string(), name: z.string(), checkIn: date, checkOut: date, rooms: z.number().int().min(0), guests: z.number().int().min(0), total: num, currency: cur, link: z.string().nullable().optional(), note: z.string().nullable().optional() })),
  costs: z.array(z.object({ category: z.string(), plan: num, fact: num, unit: z.enum(['KZT', 'EUR', 'USD', 'CHF', 'PERCENT']), per: z.enum(['tourist', 'group']) })),
})
export type TourSave = z.infer<typeof tourSaveSchema>
