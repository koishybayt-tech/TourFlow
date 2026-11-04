import { can } from '#shared/permissions'
import { departuresAtRisk } from '../services/departures'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event)
  const [unread, overdue, risk, notifications] = await Promise.all([
    can(ctx.role, 'inbox') ? ctx.db.conversation.count({ where: { unread: true } }) : 0,
    ctx.db.task.count({ where: { assigneeId: ctx.memberId, status: { not: 'DONE' }, dueAt: { lt: new Date() } } }),
    can(ctx.role, 'departures') ? departuresAtRisk(ctx.db).then(r => r.length) : 0,
    ctx.db.notification.count({ where: { memberId: ctx.memberId, readAt: null } }),
  ])
  return { inbox: unread, tasks: overdue, departures: risk, notifications }
})
