import type { Channel } from '../generated/prisma/client'
import { normalizePhone } from '#shared/utils/phone'
import type { AuthContext } from '../utils/auth'

/** Finds a client by normalized phone (main or extra) or creates one. */
export async function findOrCreateClient(db: AuthContext['db'], organizationId: string, phoneRaw: string, name: string, source: Channel) {
  const phone = normalizePhone(phoneRaw)
  if (!phone) throw createError({ statusCode: 422, statusMessage: 'Телефон клиента: +7 и 10 цифр' })
  const existing = await findClientByPhone(db, phone)
  if (existing) return { client: existing, created: false }
  const client = await db.client.create({ data: { organizationId, name, phone, source } })
  return { client, created: true }
}

export async function findClientByPhone(db: AuthContext['db'], phone: string) {
  return db.client.findFirst({ where: { deletedAt: null, OR: [{ phone }, { extraPhones: { has: phone } }] } })
}

/** First name + first letter of the surname, lowercased: «Ерболат Касымов» and «Ерболат К.» match. */
export function nameKey(name: string): string | null {
  const parts = name.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter(Boolean)
  if (parts.length < 2) return null
  return `${parts[0]} ${parts[1]![0]}`
}
