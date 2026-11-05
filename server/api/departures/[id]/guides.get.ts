import { guideFit } from '#shared/domain/guides'

/** Guide candidates for a departure: availability by dates and route language. */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'guides')
  const dep = await ctx.db.departure.findFirst({ where: { id: getRouterParam(event, 'id')! } })
  if (!dep) notFound('Выезд')
  const guides = await ctx.db.guide.findMany({ include: { departures: { where: { id: { not: dep.id } }, select: { startDate: true, endDate: true, name: true } } } })
  const ORDER = { 'Лучший выбор': 0, 'Подходит': 1, 'С оговорками': 2, 'Недоступен': 3 }
  return guides.map((g) => {
    const r = guideFit({ languages: g.languages, rating: g.rating ? Number(g.rating) : null, busy: g.departures.map(d => ({ start: d.startDate, end: d.endDate })) }, { start: dep.startDate, end: dep.endDate, route: `${dep.name} ${dep.route ?? ''}`, domestic: dep.type === 'Внутри РК' })
    return { id: g.id, fullName: g.fullName, languages: g.languages, rate: g.rate, rating: g.rating ? Number(g.rating) : null, experienceYears: g.experienceYears, ...r, current: dep.guideId === g.id }
  }).sort((a, b) => ORDER[a.fit] - ORDER[b.fit] || (b.rating ?? 0) - (a.rating ?? 0))
})
