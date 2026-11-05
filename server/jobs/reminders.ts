import { formatDateTime } from '#shared/utils/dates'
import { messaging } from '../providers/messaging'
import { notify } from '../services/deals'
import { prisma } from '../utils/prisma'

const LEAD: Record<string, number> = { 'За 15 минут в Telegram': 15, 'За 1 час в Telegram': 60, 'Клиенту в WhatsApp за 1 день': 24 * 60 }

/** Event reminders: staff in-app + Telegram, client in WhatsApp. Runs every 5 minutes. */
export async function runReminders(now = new Date()) {
  const horizon = new Date(+now + 24 * 60 * 60_000 + 5 * 60_000)
  const events = await prisma.event.findMany({
    where: { remind: { not: null }, remindedAt: null, startAt: { gt: now, lte: horizon } },
    include: { deal: { include: { client: true } } },
  })
  let sent = 0
  for (const e of events) {
    const lead = LEAD[e.remind!] ?? 60
    if (+e.startAt - lead * 60_000 > +now) continue
    if (e.remind!.startsWith('Клиенту') && e.deal) {
      await messaging().send({ channel: 'WHATSAPP', to: e.deal.client.phone, text: `Напоминаем: ${e.title}, ${formatDateTime(e.startAt)}${e.place ? `, ${e.place}` : ''}. Demo Travel` }).catch(() => null)
    }
    await notify(e.organizationId, e.assigneeId, 'Напоминание', `${formatDateTime(e.startAt).slice(11)} · ${e.title}`, e.dealId ? `/deals/${e.dealId}` : '/calendar')
    await prisma.event.update({ where: { id: e.id }, data: { remindedAt: now } })
    sent++
  }
  return { sent }
}
