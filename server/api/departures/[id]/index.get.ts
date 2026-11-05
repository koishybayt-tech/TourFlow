import { NOVISA_STEPS, VISA_STEPS } from '#shared/domain/dealStatus'
import { formatRange } from '#shared/utils/dates'
import { can } from '#shared/permissions'
import { departureParticipants } from '../../../services/departures'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'departures')
  const d = await ctx.db.departure.findFirst({ where: { id: getRouterParam(event, 'id')! }, include: { guide: true, tour: { select: { id: true, slug: true, status: true } } } })
  if (!d) notFound('Выезд')
  const parts = (await departureParticipants(ctx.db, [d.id]))[d.id] ?? []
  const steps = d.visa ? VISA_STEPS : NOVISA_STEPS
  const members = await ctx.db.member.findMany({ include: { user: { select: { name: true } } } })
  const tasks = await ctx.db.task.findMany({ where: { departureId: d.id }, include: { assignee: { include: { user: { select: { name: true } } } } }, orderBy: [{ status: 'asc' }, { dueAt: 'asc' }] })
  const showMoney = can(ctx.role, 'payments')
  return {
    id: d.id, name: d.name, route: d.route, dates: formatRange(d.startDate, d.endDate), startDate: d.startDate, endDate: d.endDate, type: d.type, visa: d.visa,
    minSeats: d.minSeats, maxSeats: d.maxSeats, price: d.price, flightDeadline: d.flightDeadline, payDeadline: d.payDeadline, briefingAt: d.briefingAt,
    flightTaskDone: d.flightTaskDone, hotelTaskDone: d.hotelTaskDone, tour: d.tour,
    guide: d.guide ? { id: d.guide.id, name: d.guide.fullName, languages: d.guide.languages, rate: d.guide.rate } : null,
    steps,
    participants: parts.map(p => ({ ...p, stepLabel: steps[p.step] ?? '', paid: showMoney ? p.paid : null, manager: members.find(m => m.id === p.managerId)?.user.name ?? null })),
    tasks: tasks.map(t => ({ id: t.id, title: t.title, status: t.status, dueAt: t.dueAt, assignee: t.assignee?.user.name ?? null })),
  }
})
