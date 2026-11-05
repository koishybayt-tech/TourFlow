import { participantReady, participantStep } from '#shared/domain/dealStatus'
import type { ScopedDb } from '../utils/db'

export interface ParticipantView {
  id: string
  name: string
  dealId: string | null
  step: number
  ready: boolean
  paid: number
  passportNote: string | null
  managerId: string | null
}

/** Participants with their step computed from the linked deal stage (or the stored step if there is no deal). */
export async function departureParticipants(db: ScopedDb, departureIds: string[]) {
  const deps = await db.departure.findMany({
    where: { id: { in: departureIds } },
    include: {
      participants: {
        include: { deal: { select: { id: true, managerId: true, wonAt: true, lostAt: true, stage: { select: { order: true } }, payments: { select: { amount: true } }, people: true } } },
        orderBy: { name: 'asc' },
      },
    },
  })
  const out: Record<string, ParticipantView[]> = {}
  for (const d of deps) {
    out[d.id] = d.participants
      .filter(p => !p.deal?.lostAt)
      .map((p) => {
        const step = p.deal ? participantStep(p.deal.stage.order, d.visa, !!p.deal.wonAt) : p.step
        const paid = p.deal ? Math.round(p.deal.payments.reduce((s, x) => s + x.amount, 0) / Math.max(1, p.deal.people)) : p.paid
        return { id: p.id, name: p.name, dealId: p.dealId, step, ready: participantReady(step, d.visa), paid, passportNote: p.passportNote, managerId: p.deal?.managerId ?? null }
      })
  }
  return out
}

/** Upcoming departures (within `days`) where fewer participants are ready than the minimum. */
export async function departuresAtRisk(db: ScopedDb, days = 21) {
  const now = new Date()
  const deps = await db.departure.findMany({
    where: { startDate: { gte: new Date(now.getTime() - 86_400_000), lte: new Date(now.getTime() + days * 86_400_000) } },
    orderBy: { startDate: 'asc' },
  })
  if (!deps.length) return []
  const parts = await departureParticipants(db, deps.map(d => d.id))
  return deps
    .map(d => ({ ...d, ready: parts[d.id]!.filter(p => p.ready).length, total: parts[d.id]!.length }))
    .filter(d => d.ready < d.minSeats)
}

/**
 * Departure automation (docs/02_FEATURES.md §11.3): when the minimum is ready — task «Купить авиабилеты»,
 * when everyone is ready — «Забронировать гостиницу». Idempotent via flags on the departure.
 */
export async function checkDepartureRules(db: ScopedDb, organizationId: string, departureId: string) {
  const dep = await db.departure.findFirst({ where: { id: departureId } })
  if (!dep) return
  const parts = (await departureParticipants(db, [dep.id]))[dep.id] ?? []
  const ready = parts.filter(p => p.ready).length
  const owner = await db.member.findFirst({ where: { role: 'OWNER', active: true } })
  const make = (title: string, description: string, dueAt: Date) => db.task.create({
    data: { organizationId, title, description, priority: 'HIGH', dueAt, assigneeId: owner?.id ?? null, departureId: dep.id, log: [{ at: new Date().toISOString(), text: 'Создана автоматически по правилу выезда', actor: 'Система' }] },
  })
  if (!dep.flightTaskDone && ready >= dep.minSeats) {
    await make(`${dep.name}: купить авиабилеты`, `Готовы ${ready} из ${dep.minSeats} минимальных — группа набрана, можно покупать билеты.`, dep.flightDeadline)
    await db.departure.update({ where: { id: dep.id }, data: { flightTaskDone: true } })
  }
  if (!dep.hotelTaskDone && parts.length > 0 && ready === parts.length && ready >= dep.minSeats) {
    await make(`${dep.name}: забронировать гостиницу`, `Готовы все ${ready} участников.`, dep.payDeadline)
    await db.departure.update({ where: { id: dep.id }, data: { hotelTaskDone: true } })
  }
}
