import { can } from '#shared/permissions'
import { dealPatchSchema } from '#shared/schemas/deals'
import { formatMoney } from '#shared/utils/money'
import { formatRange } from '#shared/utils/dates'
import { accessibleDeal } from '../../../services/access'
import { autoAdvance, logDeal } from '../../../services/deals'

const LABELS: Record<string, string> = { title: 'Запрос', dates: 'Даты', people: 'Человек', budget: 'Бюджет', visaHistory: 'Визовая история', price: 'Стоимость', fullPayDeadline: 'Срок полной оплаты' }

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'deals')
  const deal = await accessibleDeal(ctx, getRouterParam(event, 'id')!)
  const p = await body(event, dealPatchSchema)
  const data: Record<string, unknown> = {}
  const changes: string[] = []
  for (const key of ['title', 'dates', 'people', 'budget', 'visaHistory'] as const) {
    if (p[key] !== undefined && p[key] !== deal[key]) {
      data[key] = p[key]
      changes.push(`${LABELS[key]}: ${p[key] ?? '—'}`)
    }
  }
  if (p.price !== undefined && p.price !== deal.price) {
    if (!can(ctx.role, 'payments')) throw createError({ statusCode: 403, statusMessage: 'Недостаточно прав' })
    data.price = p.price
    changes.push(`Стоимость: ${formatMoney(p.price)}`)
  }
  if (p.fullPayDeadline !== undefined) {
    data.fullPayDeadline = dateOnly(p.fullPayDeadline)
    changes.push(`Срок полной оплаты: ${p.fullPayDeadline ?? '—'}`)
  }
  if (p.departureId !== undefined && p.departureId !== deal.departureId) {
    const dep = p.departureId ? await ctx.db.departure.findFirst({ where: { id: p.departureId } }) : null
    if (p.departureId && !dep) notFound('Выезд')
    data.departureId = dep?.id ?? null
    if (dep) {
      data.price = dep.price * (p.people ?? deal.people)
      data.dates = formatRange(dep.startDate, dep.endDate)
      data.fullPayDeadline = dep.payDeadline
      data.title = deal.title && deal.title !== 'Новый запрос' ? deal.title : dep.name
      changes.push(`Выезд: ${dep.name}, ${formatRange(dep.startDate, dep.endDate)} · ${formatMoney(dep.price * (p.people ?? deal.people))}`)
    }
    else changes.push('Выезд снят')
    // Seats: the deal is a participant of its departure.
    await ctx.db.participant.deleteMany({ where: { dealId: deal.id } })
    if (dep) {
      const client = await ctx.db.client.findFirstOrThrow({ where: { id: deal.clientId } })
      await ctx.db.participant.create({ data: { organizationId: ctx.organizationId, departureId: dep.id, dealId: deal.id, name: client.name } })
    }
  }
  else if (p.people !== undefined && deal.departureId && p.people !== deal.people) {
    const dep = await ctx.db.departure.findFirst({ where: { id: deal.departureId } })
    if (dep) data.price = dep.price * p.people
  }
  const stage = await ctx.db.stage.findFirstOrThrow({ where: { id: deal.stageId }, include: { requirements: true } })
  const label = (id: string) => stage.requirements.find(r => r.id === id)?.label ?? 'Требование'
  if (p.reqChecks) {
    const next = { ...(deal.reqChecks as object), ...p.reqChecks }
    data.reqChecks = next
    for (const [id, v] of Object.entries(p.reqChecks)) changes.push(`${v ? '✓' : '✗'} ${label(id)}`)
  }
  if (p.reqComments) {
    data.reqComments = { ...(deal.reqComments as object), ...p.reqComments }
    for (const [id, v] of Object.entries(p.reqComments)) changes.push(`${label(id)}: ${v}`)
  }
  if (p.reqValues) {
    data.reqValues = { ...(deal.reqValues as object), ...p.reqValues }
    for (const [id, v] of Object.entries(p.reqValues)) changes.push(`${label(id)}: ${v}`)
  }
  if (!Object.keys(data).length) return { ok: true, advanced: null }
  await ctx.db.deal.update({ where: { id: deal.id }, data })
  if (changes.length) await logDeal(ctx, deal.id, 'edit', changes.join(' · '))
  const advanced = await autoAdvance(ctx, deal.id)
  return { ok: true, advanced }
})
