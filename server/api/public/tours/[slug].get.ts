import { formatRange } from '#shared/utils/dates'
import { waLink } from '#shared/domain/routing'

/** Public tour page data — no finances. */
export default defineEventHandler(async (event) => {
  const t = await prisma.tour.findFirst({
    where: { slug: getRouterParam(event, 'slug')!, deletedAt: null, status: { in: ['PUBLISHED', 'CLOSED'] } },
    include: { days: { orderBy: { order: 'asc' } }, departure: { include: { _count: { select: { participants: true } } } }, organization: { select: { name: true, phone: true, instagram: true } } },
  })
  if (!t) throw createError({ statusCode: 404, statusMessage: 'Тур не найден' })
  const nights = t.startDate && t.endDate ? Math.round((+t.endDate - +t.startDate) / 86_400_000) : null
  const free = t.departure ? Math.max(0, t.departure.maxSeats - t.departure._count.participants) : t.seats
  const dates = t.startDate && t.endDate ? formatRange(t.startDate, t.endDate, { dateOnly: true, withYear: true }) : ''
  return {
    slug: t.slug, name: t.name, flags: t.flags, countries: t.countries, route: t.route, dates, days: nights !== null ? nights + 1 : t.days.length, nights,
    price: t.price, prepay: t.prepay, riseDate: t.riseDate, riseAmount: t.riseAmount, payRule: t.payRule, description: t.description, coverKey: t.coverKey,
    included: t.included, extra: t.extra, free, closed: t.status === 'CLOSED' || free === 0,
    program: t.days.map(d => ({ city: d.city, items: d.items, description: d.description, transfer: d.transfer, media: d.mediaKeys })),
    org: { name: t.organization.name, instagram: t.organization.instagram },
    whatsapp: waLink(t.organization.phone, `Здравствуйте! Хочу забронировать тур «${t.name}»${dates ? `, ${dates}` : ''}`, `T-${t.slug.slice(0, 16)}`),
  }
})
