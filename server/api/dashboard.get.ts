import { can } from '#shared/permissions'
import { startOfAlmatyDay } from '#shared/utils/dates'
import { paidByDeal } from '../services/payments'

/** «Мой день» (docs/02_FEATURES.md §2). */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event)
  const today = startOfAlmatyDay()
  const tomorrow = new Date(today.getTime() + 86_400_000)
  const week = new Date(today.getTime() + 7 * 86_400_000)
  const twoWeeks = new Date(today.getTime() + 14 * 86_400_000)
  const scope = dealScope(ctx)
  const activeDeal = { deletedAt: null, lostAt: null, wonAt: null, ...scope }

  const [myTasks, overdueCount, waiting, waitingCount, events, newDeals, newDealsCount] = await Promise.all([
    ctx.db.task.findMany({
      where: { assigneeId: ctx.memberId, status: { not: 'DONE' }, dueAt: { lt: tomorrow } },
      include: { deal: { select: { id: true, number: true, client: { select: { name: true } } } } },
      orderBy: [{ dueAt: 'asc' }],
      take: 12,
    }),
    ctx.db.task.count({ where: { assigneeId: ctx.memberId, status: { not: 'DONE' }, dueAt: { lt: today } } }),
    can(ctx.role, 'inbox')
      ? ctx.db.conversation.findMany({ where: { unread: true }, include: { messages: { orderBy: { sentAt: 'desc' }, take: 1 } }, orderBy: { lastMessageAt: 'desc' }, take: 6 })
      : [],
    can(ctx.role, 'inbox') ? ctx.db.conversation.count({ where: { unread: true } }) : 0,
    ctx.db.event.findMany({
      where: { startAt: { gte: today, lt: tomorrow }, ...(ctx.role === 'OWNER' ? {} : { OR: [{ assigneeId: ctx.memberId }, { assigneeId: null }] }) },
      include: { assignee: { include: { user: { select: { name: true } } } }, deal: { select: { id: true, number: true } } },
      orderBy: { startAt: 'asc' },
    }),
    ctx.db.deal.findMany({ where: { ...activeDeal, stage: { order: 0 } }, include: { client: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 5 }),
    ctx.db.deal.count({ where: { ...activeDeal, stage: { order: 0 } } }),
  ])

  // Payments and departures for the coming weeks.
  const showMoney = can(ctx.role, 'payments')
  const dueDeals = showMoney
    ? await ctx.db.deal.findMany({ where: { ...activeDeal, price: { gt: 0 }, fullPayDeadline: { lt: twoWeeks } }, include: { client: { select: { name: true } } }, orderBy: { fullPayDeadline: 'asc' } })
    : []
  const paid = await paidByDeal(ctx.db, dueDeals.map(d => d.id))
  const clientPayments = dueDeals
    .map(d => ({ dealId: d.id, number: d.number, client: d.client.name, title: d.title, deadline: d.fullPayDeadline, debt: d.price - (paid[d.id] ?? 0) }))
    .filter(x => x.debt > 0)

  const operatorPayments = showMoney && can(ctx.role, 'package')
    ? (await ctx.db.operatorBooking.findMany({
        where: { status: { in: ['REQUEST', 'CONFIRMED'] }, paymentDeadline: { lt: week }, deal: scope },
        include: { operator: { select: { name: true } }, payments: { select: { amount: true } }, deal: { select: { id: true, number: true, client: { select: { name: true } } } } },
        orderBy: { paymentDeadline: 'asc' },
      })).map(b => ({ dealId: b.deal.id, number: b.deal.number, client: b.deal.client.name, operator: b.operator.name, bookingNo: b.number, deadline: b.paymentDeadline, debt: b.net - b.payments.reduce((s, p) => s + p.amount, 0) })).filter(x => x.debt > 0)
    : []

  const departures = can(ctx.role, 'departures')
    ? await ctx.db.departure.findMany({ where: { startDate: { gte: today, lt: twoWeeks } }, include: { _count: { select: { participants: true } } }, orderBy: { startDate: 'asc' } })
    : []

  const weekPayments = clientPayments.filter(p => p.deadline && p.deadline < week).length + operatorPayments.length

  return {
    focus: { waiting: waitingCount, tasksToday: myTasks.length, overdue: overdueCount, paymentsWeek: weekPayments, newDeals: newDealsCount },
    tasks: myTasks.map(t => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, dueAt: t.dueAt, isSystem: t.isSystem, deal: t.deal ? { id: t.deal.id, number: t.deal.number, client: t.deal.client.name } : null })),
    waiting: waiting.map(c => ({ id: c.id, name: c.clientName, channel: c.channel, text: c.messages[0]?.text ?? '', at: c.lastMessageAt, dealId: c.dealId })),
    events: events.map(e => ({ id: e.id, type: e.type, title: e.title, startAt: e.startAt, place: e.place, who: e.assignee?.user.name ?? null, deal: e.deal })),
    newDeals: newDeals.map(d => ({ id: d.id, number: d.number, client: d.client.name, title: d.title, source: d.source, createdAt: d.createdAt })),
    clientPayments,
    operatorPayments,
    departures: departures.map(d => ({ id: d.id, name: d.name, startDate: d.startDate, endDate: d.endDate, participants: d._count.participants, maxSeats: d.maxSeats })),
  }
})
