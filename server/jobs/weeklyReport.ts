import { formatMoney } from '#shared/utils/money'
import { buildReport } from '../services/reports'
import { reportWorkbook, TAB_TITLES, type ReportTab } from '../services/reportExport'
import { sendTelegram } from '../providers/notify/telegram'
import { scopedDb } from '../utils/db'
import { prisma } from '../utils/prisma'
import { createTransport } from 'nodemailer'

/** Monday morning: owners get the week summary by email (with Excel) and in Telegram. */
export async function runWeeklyReport() {
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true } })
  const transport = createTransport(process.env.SMTP_URL || 'smtp://localhost:1025')
  for (const org of orgs) {
    const r = await buildReport(scopedDb(org.id), { period: 'month' })
    const k = r.kpis
    const text = `Tourflow · ${org.name} · ${r.label}\nОбращения: ${k.leads} · продажи: ${k.sales} (${k.conversion}%)\nПоступления: ${formatMoney(k.income)} · средний чек: ${formatMoney(k.avgCheck)}\nДебиторка: ${formatMoney(k.receivable)} · отказы: ${k.lost}`
    const wb = reportWorkbook(r, org.name, Object.keys(TAB_TITLES) as ReportTab[])
    const xlsx = Buffer.from(await wb.xlsx.writeBuffer())
    const owners = await prisma.member.findMany({ where: { organizationId: org.id, role: 'OWNER', active: true }, include: { user: true } })
    for (const o of owners) {
      await transport.sendMail({ from: process.env.MAIL_FROM || 'Tourflow <no-reply@tourflow.local>', to: o.user.email, subject: `Еженедельный отчёт — ${org.name}`, text, attachments: [{ filename: `Отчёт — ${r.label}.xlsx`, content: xlsx }] }).catch(e => console.error('weekly mail failed', e.message))
      await sendTelegram(o.user.telegramChatId, text, '/reports')
    }
  }
  return { orgs: orgs.length }
}
