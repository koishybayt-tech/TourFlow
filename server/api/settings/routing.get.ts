import { formatRange } from '#shared/utils/dates'
import { loadRouting } from '../../services/routing'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'settings')
  const [{ settings }, departures, org] = await Promise.all([
    loadRouting(ctx.organizationId),
    ctx.db.departure.findMany({ where: { startDate: { gte: new Date() } }, orderBy: { startDate: 'asc' } }),
    prisma.organization.findUniqueOrThrow({ where: { id: ctx.organizationId }, select: { phone: true } }),
  ])
  return {
    settings: { ...settings, channels: { WHATSAPP: 'auto', INSTAGRAM: 'auto', SITE: 'auto', ...settings.channels } },
    departures: departures.map(d => ({ id: d.id, label: `${d.name} · ${formatRange(d.startDate, d.endDate)}` })),
    whatsappPhone: org.phone,
  }
})
