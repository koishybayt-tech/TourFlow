import { z } from 'zod'
import { can } from '#shared/permissions'
import { almatyDate } from '#shared/utils/dates'
import { paidByDeal } from '../../services/payments'

/**
 * Calendar events (docs/02_FEATURES.md §13): manual events + automatic ones from departures,
 * tasks, client payment deadlines and operator deadlines.
 */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'calendar')
  const q = queryOf(event, z.object({ from: z.string(), to: z.string(), who: z.string().optional() }))
  const from = new Date(`${q.from}T00:00:00+05:00`)
  const to = new Date(`${q.to}T23:59:59+05:00`)
  const who = q.who && q.who !== 'all' ? q.who : null
  const scope = dealScope(ctx)
  const at9 = (d: Date) => almatyDate(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 9)

  const [events, departures, tasks] = await Promise.all([
    ctx.db.event.findMany({ where: { startAt: { gte: from, lte: to }, ...(who ? { assigneeId: who } : {}) }, include: { assignee: { include: { user: { select: { name: true } } } }, deal: { select: { id: true, number: true, client: { select: { name: true } } } } }, orderBy: { startAt: 'asc' } }),
    can(ctx.role, 'departures') ? ctx.db.departure.findMany({ where: { OR: [{ startDate: { gte: from, lte: to } }, { briefingAt: { gte: from, lte: to } }, { flightDeadline: { gte: from, lte: to } }] } }) : [],
    ctx.db.task.findMany({ where: { dueAt: { gte: from, lte: to }, status: { not: 'DONE' }, isSystem: false, ...(who ? { assigneeId: who } : ctx.role === 'OWNER' ? {} : { assigneeId: ctx.memberId }) }, include: { assignee: { include: { user: { select: { name: true } } } } } }),
  ])
  const out: { id: string, kind: 'event' | 'auto', type: string, title: string, startAt: Date, endAt: Date | null, place: string | null, who: string | null, link: string | null, sub: string | null }[] = []
  for (const e of events) out.push({ id: e.id, kind: 'event', type: e.type, title: e.title, startAt: e.startAt, endAt: e.endAt, place: e.place, who: e.assignee?.user.name ?? null, link: e.deal ? `/deals/${e.deal.id}` : e.departureId ? `/departures/${e.departureId}` : null, sub: e.description })
  for (const d of departures) {
    if (d.startDate >= from && d.startDate <= to) out.push({ id: `dep-${d.id}`, kind: 'auto', type: 'flight', title: `Вылет: ${d.name}`, startAt: at9(d.startDate), endAt: null, place: null, who: null, link: `/departures/${d.id}`, sub: null })
    if (d.briefingAt >= from && d.briefingAt <= to) out.push({ id: `brief-${d.id}`, kind: 'auto', type: 'briefing', title: `Брифинг группы: ${d.name}`, startAt: almatyDate(d.briefingAt.getUTCFullYear(), d.briefingAt.getUTCMonth(), d.briefingAt.getUTCDate(), 19), endAt: null, place: 'Офис', who: null, link: `/departures/${d.id}`, sub: null })
    if (d.flightDeadline >= from && d.flightDeadline <= to) out.push({ id: `fl-${d.id}`, kind: 'auto', type: 'task', title: `Купить авиабилеты: ${d.name}`, startAt: at9(d.flightDeadline), endAt: null, place: null, who: null, link: `/departures/${d.id}`, sub: 'дедлайн' })
  }
  for (const t of tasks) out.push({ id: `task-${t.id}`, kind: 'auto', type: 'task', title: t.title, startAt: t.dueAt!, endAt: null, place: null, who: t.assignee?.user.name ?? null, link: `/tasks?task=${t.id}`, sub: null })
  if (can(ctx.role, 'payments')) {
    const deals = await ctx.db.deal.findMany({ where: { deletedAt: null, lostAt: null, wonAt: null, price: { gt: 0 }, fullPayDeadline: { gte: from, lte: to }, ...scope, ...(who ? { managerId: who } : {}) }, include: { client: { select: { name: true } } } })
    const paid = await paidByDeal(ctx.db, deals.map(d => d.id))
    for (const d of deals) {
      const debt = d.price - (paid[d.id] ?? 0)
      if (debt > 0) out.push({ id: `pay-${d.id}`, kind: 'auto', type: 'pay', title: `Доплата: ${d.client.name}`, startAt: at9(d.fullPayDeadline!), endAt: null, place: null, who: null, link: `/deals/${d.id}`, sub: `${debt.toLocaleString('ru-RU')} ₸ · №${d.number}` })
    }
    const bookings = await ctx.db.operatorBooking.findMany({ where: { status: { in: ['REQUEST', 'CONFIRMED'] }, paymentDeadline: { gte: from, lte: to }, deal: scope }, include: { operator: { select: { name: true } }, deal: { select: { id: true, number: true } } } })
    for (const b of bookings) out.push({ id: `op-${b.id}`, kind: 'auto', type: 'pay', title: `Оплата оператору: ${b.operator.name}`, startAt: at9(b.paymentDeadline), endAt: null, place: null, who: null, link: `/deals/${b.deal.id}`, sub: `${b.number ?? ''} · №${b.deal.number}` })
  }
  return out.sort((a, b) => +a.startAt - +b.startAt)
})
