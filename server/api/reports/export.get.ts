import { z } from 'zod'
import { buildReport } from '../../services/reports'
import { TAB_TITLES, reportWorkbook, type ReportTab } from '../../services/reportExport'

/** Excel export of one report tab or all tabs («Скачать все»). */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'reports')
  const q = queryOf(event, z.object({ tab: z.enum(['summary', 'funnel', 'sources', 'managers', 'departures', 'debts', 'lost', 'all']).default('all'), period: z.enum(['month', 'quarter', 'year', 'all']).default('month'), pipeline: z.enum(['GROUP', 'PACKAGE', 'BASE']).optional(), manager: z.string().optional() }))
  const r = await buildReport(ctx.db, { period: q.period, pipeline: q.pipeline ?? null, managerId: q.manager ?? null })
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: ctx.organizationId }, select: { name: true } })
  const tabs = q.tab === 'all' ? (Object.keys(TAB_TITLES) as ReportTab[]) : [q.tab]
  const wb = reportWorkbook(r, org.name, tabs)
  return sendWorkbook(event, wb, `Отчёт ${q.tab === 'all' ? 'полный' : TAB_TITLES[q.tab]} — ${r.label}.xlsx`)
})
