import { z } from 'zod'
import { can } from '#shared/permissions'
import { formatRange } from '#shared/utils/dates'
import { formatPhone } from '#shared/utils/phone'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event)
  const { q } = queryOf(event, z.object({ q: z.string().default('') }))
  const term = q.trim()
  if (term.length < 2) return { clients: [], deals: [], departures: [] }
  const digits = term.replace(/\D/g, '')
  const phoneFilter = digits.length >= 3 ? [{ phone: { contains: digits.slice(-10) } }] : []
  const numberFilter = /^\d{1,6}$/.test(term) ? [{ number: Number(term) }] : []
  const scope = dealScope(ctx)

  const [clients, deals, departures] = await Promise.all([
    can(ctx.role, 'clients')
      ? ctx.db.client.findMany({ where: { deletedAt: null, OR: [{ name: { contains: term, mode: 'insensitive' } }, { fullName: { contains: term, mode: 'insensitive' } }, ...phoneFilter] }, take: 6, orderBy: { updatedAt: 'desc' } })
      : [],
    ctx.db.deal.findMany({
      where: { deletedAt: null, ...scope, OR: [{ title: { contains: term, mode: 'insensitive' } }, { client: { name: { contains: term, mode: 'insensitive' } } }, { client: { phone: { contains: digits.slice(-10) || '—' } } }, ...numberFilter] },
      include: { client: { select: { name: true } }, stage: { select: { name: true } } },
      take: 6,
      orderBy: { updatedAt: 'desc' },
    }),
    can(ctx.role, 'departures')
      ? ctx.db.departure.findMany({ where: { name: { contains: term, mode: 'insensitive' } }, take: 4, orderBy: { startDate: 'asc' } })
      : [],
  ])
  return {
    clients: clients.map(c => ({ id: c.id, label: c.name, suffix: formatPhone(c.phone), to: `/clients/${c.id}` })),
    deals: deals.map(d => ({ id: d.id, label: `№${d.number} · ${d.client.name}`, suffix: `${d.title} · ${d.lostAt ? 'Отказ' : d.wonAt ? 'Завершена' : d.stage.name}`, to: `/deals/${d.id}` })),
    departures: departures.map(d => ({ id: d.id, label: d.name, suffix: formatRange(d.startDate, d.endDate), to: `/departures/${d.id}` })),
  }
})
