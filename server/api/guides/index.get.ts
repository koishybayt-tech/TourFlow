import { formatRange } from '#shared/utils/dates'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'guides')
  const [guides, unassigned] = await Promise.all([
    ctx.db.guide.findMany({ include: { departures: { where: { endDate: { gte: new Date() } }, orderBy: { startDate: 'asc' } } }, orderBy: { fullName: 'asc' } }),
    ctx.db.departure.count({ where: { guideId: null, startDate: { gte: new Date() } } }),
  ])
  return {
    unassigned,
    guides: guides.map(g => ({
      id: g.id, fullName: g.fullName, age: g.birthDate ? Math.floor((Date.now() - +g.birthDate) / (365.25 * 86_400_000)) : null, sex: g.sex, languages: g.languages,
      experienceYears: g.experienceYears, agencies: g.agencies, rate: g.rate, rating: g.rating ? Number(g.rating) : null, reviewsCount: g.reviewsCount,
      departures: g.departures.map(d => ({ id: d.id, name: d.name, dates: formatRange(d.startDate, d.endDate) })),
    })),
  }
})
