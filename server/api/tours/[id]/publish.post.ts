import { canPublish, departureDeadlines } from '#shared/domain/tourCalc'
import type { RoutingSettings } from '#shared/domain/routing'
import { TOUR_INCLUDE, tourCalc, tourDto } from '../../../services/tours'

/** Publishing creates (or updates) the departure and a WhatsApp tag link for routing. */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'tours')
  const t = await ctx.db.tour.findFirst({ where: { id: getRouterParam(event, 'id')!, deletedAt: null }, include: TOUR_INCLUDE })
  if (!t) notFound('Тур')
  const check = canPublish(t)
  if (!check.ok) throw createError({ statusCode: 422, statusMessage: `Перед публикацией заполните: ${check.missing.join(', ')}` })
  const c = tourCalc(tourDto(t))
  const deadlines = departureDeadlines(t.startDate!)
  const visa = t.countries.some(x => !['Казахстан', 'Турция', 'ОАЭ', 'Грузия', 'Узбекистан', 'Кыргызстан'].includes(x))
  const data = { name: t.name, route: t.route, startDate: t.startDate!, endDate: t.endDate!, maxSeats: t.seats, price: t.price, minSeats: Math.max(1, Math.min(t.seats, c.breakEven ?? 1)), ...deadlines }
  const dep = t.departure
    ? await ctx.db.departure.update({ where: { id: t.departure.id }, data })
    : await ctx.db.departure.create({ data: { ...data, organizationId: ctx.organizationId, tourId: t.id, type: t.countries.includes('Казахстан') ? 'Внутри РК' : 'Авторский', visa } })
  await ctx.db.tour.update({ where: { id: t.id }, data: { status: 'PUBLISHED' } })
  // Tag link so that «Забронировать в WhatsApp» lands in the group pipeline on this departure.
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: ctx.organizationId }, select: { routing: true } })
  const routing = (org.routing ?? {}) as Partial<RoutingSettings>
  const tag = `T-${t.slug.slice(0, 16)}`
  const links = (routing.links ?? []).filter(l => l.tag !== tag)
  links.push({ tag, label: `Хочу в тур «${t.name}»`, pipeline: 'GROUP', departureId: dep.id })
  await prisma.organization.update({ where: { id: ctx.organizationId }, data: { routing: { ...routing, links } as object } })
  await audit({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'tour.publish', entity: 'Tour', entityId: t.id })
  return { ok: true, departureId: dep.id }
})
