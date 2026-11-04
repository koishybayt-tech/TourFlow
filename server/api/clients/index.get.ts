import { z } from 'zod'
import { normalizePhone } from '#shared/utils/phone'
import { nameKey } from '../../services/clients'

/** Clients list (docs/02_FEATURES.md §6): one row per person with status, last deal, totals and attention flags. */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'clients')
  const { q, filter } = queryOf(event, z.object({ q: z.string().default(''), filter: z.enum(['all', 'active', 'trips', 'debt', 'dupes']).default('all') }))
  const scope = dealScope(ctx)
  const term = q.trim()
  const digits = term.replace(/\D/g, '')
  const where: Record<string, unknown> = { deletedAt: null }
  if (scope.managerId) where.OR = [{ managerId: ctx.memberId }, { deals: { some: { managerId: ctx.memberId } } }]

  const clients = await ctx.db.client.findMany({
    where,
    include: {
      deals: {
        where: { deletedAt: null },
        include: { stage: { select: { name: true } }, payments: { select: { amount: true } }, travelers: { select: { passportExpiry: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
  const members = await ctx.db.member.findMany({ include: { user: { select: { name: true } } } })
  const memberName = (id: string | null) => members.find(m => m.id === id)?.user.name ?? null

  // Possible duplicates: same first name + surname initial, different phones.
  const byKey = new Map<string, string[]>()
  for (const c of clients) {
    const k = nameKey(c.name)
    if (k) byKey.set(k, [...(byKey.get(k) ?? []), c.id])
  }
  const soon = new Date(Date.now() + 180 * 86_400_000)

  let rows = clients.map((c) => {
    const won = c.deals.filter(d => d.wonAt)
    const active = c.deals.filter(d => !d.wonAt && !d.lostAt)
    const paid = c.deals.reduce((s, d) => s + d.payments.reduce((x, p) => x + p.amount, 0), 0)
    const debt = active.reduce((s, d) => s + Math.max(0, d.price - d.payments.reduce((x, p) => x + p.amount, 0)), 0)
    const last = c.deals[0]
    const key = nameKey(c.name)
    const dupes = key ? (byKey.get(key) ?? []).filter(id => id !== c.id) : []
    const passportSoon = c.deals.some(d => d.travelers.some(t => t.passportExpiry && t.passportExpiry < soon))
    return {
      id: c.id,
      name: c.name,
      fullName: c.fullName,
      phone: c.phone,
      status: won.length >= 2 ? 'Постоянный' : won.length === 1 ? 'Был в поездке' : 'Новый',
      dealsCount: c.deals.length,
      activeCount: active.length,
      lastDeal: last ? { id: last.id, number: last.number, title: last.title, stage: last.lostAt ? 'Отказ' : last.wonAt ? 'Завершена' : last.stage.name } : null,
      manager: memberName(c.managerId ?? last?.managerId ?? null),
      paid,
      debt,
      source: c.source,
      attention: [...(passportSoon ? ['Паспорт истекает'] : []), ...(dupes.length ? ['Возможный дубль'] : [])],
      duplicateIds: dupes,
      tripsCount: won.length,
    }
  })

  if (term) {
    const t = term.toLowerCase()
    const phone = digits.length >= 3 ? digits.slice(-10) : null
    // IIN search compares the decrypted value only when 12 digits are entered.
    const iinMatches = new Set<string>()
    if (/^\d{12}$/.test(digits)) {
      for (const c of clients) if (c.iinEnc && decryptPii(c.iinEnc) === digits) iinMatches.add(c.id)
    }
    rows = rows.filter(r => r.name.toLowerCase().includes(t) || r.fullName?.toLowerCase().includes(t) || (phone && (normalizePhone(r.phone) ?? '').includes(phone)) || iinMatches.has(r.id))
  }
  if (filter === 'active') rows = rows.filter(r => r.activeCount > 0)
  if (filter === 'trips') rows = rows.filter(r => r.tripsCount > 0)
  if (filter === 'debt') rows = rows.filter(r => r.debt > 0)
  if (filter === 'dupes') rows = rows.filter(r => r.duplicateIds.length > 0)
  return rows
})
