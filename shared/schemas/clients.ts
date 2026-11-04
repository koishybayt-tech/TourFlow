import { z } from 'zod'
import { normalizePhone } from '../utils/phone'

const phone = z.string().refine(v => !!normalizePhone(v), 'Телефон: +7 и 10 цифр')

export const clientCreateSchema = z.object({
  name: z.string().trim().min(2, 'Укажите имя клиента'),
  phone,
  email: z.string().trim().optional(),
  source: z.enum(['WHATSAPP', 'INSTAGRAM', 'SITE', 'MANUAL', 'CALL', 'OFFICE', 'REFERRAL']).default('MANUAL'),
})

export const clientUpdateSchema = z.object({
  name: z.string().trim().min(2, 'Укажите имя клиента').optional(),
  phone: phone.optional(),
  extraPhones: z.array(phone).optional(),
  email: z.string().trim().optional(),
  fullName: z.string().trim().optional(),
  iin: z.string().trim().refine(v => v === '' || /^\d{12}$/.test(v), 'ИИН — 12 цифр').optional(),
  birthDate: z.string().nullable().optional(),
  address: z.string().trim().optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
  note: z.string().optional(),
  managerId: z.string().nullable().optional(),
  pdConsent: z.boolean().optional(),
})
