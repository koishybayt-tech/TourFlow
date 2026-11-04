import type { Channel, Pipeline } from '../generated/prisma/client'
import { autoAdvanceTarget, stageProgress, type DealSnapshot, type RequirementDef, type StageDef } from '#shared/domain/dealStatus'
import { CHANNEL_LABELS } from '#shared/domain/types'
import { formatRange, startOfAlmatyDay } from '#shared/utils/dates'
import type { AuthContext } from '../utils/auth'
import { prisma } from '../utils/prisma'
import { publish } from '../utils/live'

type Actor = Pick<AuthContext, 'organizationId' | 'memberId' | 'name' | 'db'> | { organizationId: string, memberId: null, name: 'Система', db: AuthContext['db'] }

/** Next sequential deal number inside the organization (atomic). */
export async function nextDealNumber(organizationId: string): Promise<number> {
  const org = await prisma.organization.update({ where: { id: organizationId }, data: { dealCounter: { increment: 1 } }, select: { dealCounter: true } })
  return org.dealCounter
}

export async function logDeal(actor: Actor, dealId: string, kind: string, text: string, data?: Record<string, unknown>) {
  await actor.db.dealEvent.create({
    data: { organizationId: actor.organizationId, dealId, actorId: actor.memberId, actorLabel: actor.name, kind, text, data: data as object | undefined },
  })
}

export async function notify(organizationId: string, memberId: string | null | undefined, title: string, body: string, link?: string) {
  if (!memberId) return
  const n = await prisma.notification.create({ data: { organizationId, memberId, title, body, link } })
  publish(organizationId, { type: 'notification', memberId, id: n.id, title, body, link })
}

export async function loadStages(db: AuthContext['db'], pipeline: Pipeline): Promise<(StageDef & { pipeline: Pipeline })[]> {
  const stages = await db.stage.findMany({ where: { pipeline }, include: { requirements: { orderBy: { order: 'asc' } } }, orderBy: { order: 'asc' } })
  return stages.map(s => ({
    id: s.id,
    name: s.name,
    order: s.order,
    pipeline: s.pipeline,
    description: s.description,
    requirements: s.requirements.map(r => ({ id: r.id, type: r.type, label: r.label, required: r.required, config: (r.config ?? {}) as RequirementDef['config'] })),
  }))
}

/** Builds the data snapshot used by the stage regulation logic. */
export async function dealSnapshot(db: AuthContext['db'], dealId: string) {
  const deal = await db.deal.findFirstOrThrow({
    where: { id: dealId },
    include: {
      client: { select: { fullName: true, iinEnc: true, address: true } },
      payments: { select: { amount: true } },
      travelers: { select: { passportNoEnc: true } },
      documents: { select: { type: true } },
      contracts: { where: { annulledAt: null, kind: 'contract' }, select: { status: true } },
      calendar: { select: { type: true } },
      tasks: { where: { isSystem: false, status: { not: 'DONE' }, stageId: { not: null } }, select: { id: true, title: true, stageId: true } },
    },
  })
  const base: Omit<DealSnapshot, 'openStageTasks'> = {
    people: deal.people,
    price: deal.price,
    paid: deal.payments.reduce((s, p) => s + p.amount, 0),
    dates: deal.dates,
    budget: deal.budget,
    visaHistory: deal.visaHistory,
    departureId: deal.departureId,
    travelersCount: deal.travelers.length,
    travelersWithPassport: deal.travelers.filter(t => !!t.passportNoEnc).length,
    docTypes: deal.documents.map(d => d.type),
    signed: deal.contracts.some(c => c.status === 'SIGNED' || c.status === 'PAPER'),
    client: { fullName: deal.client.fullName, iin: !!deal.client.iinEnc, address: deal.client.address },
    eventTypes: deal.calendar.map(e => e.type),
    reqChecks: (deal.reqChecks ?? {}) as Record<string, boolean>,
    reqComments: (deal.reqComments ?? {}) as Record<string, string>,
    reqValues: (deal.reqValues ?? {}) as Record<string, string>,
  }
  const forStage = (stageId: string): DealSnapshot => ({ ...base, openStageTasks: deal.tasks.filter(t => t.stageId === stageId).map(t => ({ id: t.id, title: t.title })) })
  return { deal, base, forStage }
}

function dueForStage(order: number): Date {
  // Early stages are answered today, later ones get a few days.
  const days = order <= 1 ? 0 : order <= 3 ? 1 : 3
  return new Date(startOfAlmatyDay().getTime() + days * 86_400_000 + 18 * 3_600_000)
}

/** Opens the system task of a stage (idempotent). */
export async function openSystemTask(actor: Actor, deal: { id: string, managerId: string | null }, stage: StageDef) {
  const existing = await actor.db.task.findFirst({ where: { dealId: deal.id, stageId: stage.id, isSystem: true, status: { not: 'DONE' } } })
  if (existing) return existing
  return actor.db.task.create({
    data: {
      organizationId: actor.organizationId,
      title: `Этап «${stage.name}»: выполнить регламент`,
      description: stage.description,
      status: 'TODO',
      priority: stage.order <= 1 ? 'HIGH' : 'MEDIUM',
      dueAt: dueForStage(stage.order),
      assigneeId: deal.managerId,
      authorId: null,
      dealId: deal.id,
      stageId: stage.id,
      isSystem: true,
      log: [{ at: new Date().toISOString(), text: `Создана автоматически при переходе на этап «${stage.name}»`, actor: 'Система' }],
    },
  })
}

/** Closes open system tasks of a stage. */
export async function closeSystemTasks(actor: Actor, dealId: string, stageId: string, text = 'Закрыта автоматически: этап завершён') {
  const tasks = await actor.db.task.findMany({ where: { dealId, stageId, isSystem: true, status: { not: 'DONE' } } })
  for (const t of tasks) {
    const log = [...((t.log ?? []) as object[]), { at: new Date().toISOString(), text, actor: 'Система' }]
    await actor.db.task.update({ where: { id: t.id }, data: { status: 'DONE', completedAt: new Date(), result: 'Этап завершён', log } })
  }
}

/**
 * Moves a deal to another stage of its pipeline: closes the old system task, opens the new one,
 * writes history. `auto` marks automatic transitions.
 */
export async function moveToStage(actor: Actor, dealId: string, toOrder: number, opts: { auto?: boolean, reason?: string } = {}) {
  const deal = await actor.db.deal.findFirstOrThrow({ where: { id: dealId }, include: { stage: true } })
  const stages = await loadStages(actor.db, deal.pipeline)
  const target = stages.find(s => s.order === toOrder)
  if (!target || target.id === deal.stageId) return deal
  await closeSystemTasks(actor, dealId, deal.stageId, opts.auto ? 'Закрыта автоматически: этап завершён' : `Закрыта: этап изменён вручную (${actor.name})`)
  await actor.db.deal.update({ where: { id: dealId }, data: { stageId: target.id } })
  await openSystemTask(actor, deal, target)
  const text = `Этап: ${deal.stage.name} → ${target.name}${opts.auto ? ' (автоматически)' : ''}${opts.reason ? ` · ${opts.reason}` : ''}`
  await logDeal(actor, dealId, 'stage', text, { from: deal.stage.order, to: target.order, auto: !!opts.auto })
  return { ...deal, stageId: target.id }
}

export interface AdvanceResult {
  moved: boolean
  from: string
  to: string
}

/**
 * Auto-advance (docs/02_FEATURES.md §5.1): called after every deal mutation.
 * Idempotent — does nothing when the current stage is not complete.
 */
export async function autoAdvance(actor: Actor, dealId: string): Promise<AdvanceResult | null> {
  const { deal, forStage } = await dealSnapshot(actor.db, dealId)
  if (deal.lostAt || deal.wonAt || deal.deletedAt) return null
  const stages = await loadStages(actor.db, deal.pipeline)
  const current = stages.find(s => s.id === deal.stageId)
  if (!current) return null
  const targetOrder = autoAdvanceTarget(stages, current.order, s => forStage(s.id))
  if (targetOrder === current.order) return null
  // Move stage by stage so history and system tasks stay consistent.
  for (const s of stages.filter(x => x.order > current.order && x.order <= targetOrder)) {
    await moveToStage(actor, dealId, s.order, { auto: true })
  }
  const to = stages.find(s => s.order === targetOrder)!
  await notify(actor.organizationId, deal.managerId, 'Статус обновлён автоматически', `Заявка №${deal.number}: ${current.name} → ${to.name}`, `/deals/${dealId}`)
  publish(actor.organizationId, { type: 'deal', dealId })
  return { moved: true, from: current.name, to: to.name }
}

/** Progress of the current stage for the deal page and kanban. */
export async function currentProgress(db: AuthContext['db'], dealId: string) {
  const { deal, forStage } = await dealSnapshot(db, dealId)
  const stages = await loadStages(db, deal.pipeline)
  const stage = stages.find(s => s.id === deal.stageId)!
  return { stage, stages, progress: stageProgress(stage, forStage(stage.id)), snapshot: forStage(stage.id) }
}

export interface CreateDealInput {
  clientId: string
  pipeline: Pipeline
  title: string
  source: Channel
  directionId?: string | null
  managerId?: string | null
  departureId?: string | null
  people?: number
  dates?: string | null
  visaHistory?: string | null
  budget?: string | null
  price?: number
  sourceText?: string
}

export async function createDeal(actor: Actor, input: CreateDealInput) {
  const stages = await loadStages(actor.db, input.pipeline)
  const first = stages[0]
  if (!first) throw createError({ statusCode: 422, statusMessage: 'В воронке нет этапов' })
  let price = input.price ?? 0
  let dates = input.dates ?? null
  if (input.departureId) {
    const dep = await actor.db.departure.findFirst({ where: { id: input.departureId } })
    if (dep) {
      price = dep.price * (input.people ?? 1)
      // The departure's real dates win over free-text dates from the lead.
      dates = formatRange(dep.startDate, dep.endDate)
    }
  }
  const number = await nextDealNumber(actor.organizationId)
  const deal = await actor.db.deal.create({
    data: {
      organizationId: actor.organizationId,
      number,
      clientId: input.clientId,
      pipeline: input.pipeline,
      stageId: first.id,
      directionId: input.directionId ?? null,
      managerId: input.managerId ?? null,
      source: input.source,
      title: input.title,
      dates,
      people: input.people ?? 1,
      budget: input.budget ?? null,
      visaHistory: input.visaHistory ?? null,
      price,
      departureId: input.departureId ?? null,
    },
  })
  await logDeal(actor, deal.id, 'system', input.sourceText ?? `Заявка создана (${CHANNEL_LABELS[input.source]})`)
  if (deal.managerId) {
    const m = await actor.db.member.findFirst({ where: { id: deal.managerId }, include: { user: { select: { name: true } } } })
    await logDeal(actor, deal.id, 'system', `Ответственный: ${m?.user.name ?? '—'}`)
    if (deal.managerId !== actor.memberId) {
      await notify(actor.organizationId, deal.managerId, 'Новая заявка назначена', `№${number} · ${input.title}`, `/deals/${deal.id}`)
    }
  }
  await openSystemTask(actor, deal, first)
  if (input.departureId) {
    // A group deal on a departure takes seats for its travelers once they are added; until then the client is a participant.
    const client = await actor.db.client.findFirst({ where: { id: input.clientId } })
    await actor.db.participant.create({ data: { organizationId: actor.organizationId, departureId: input.departureId, dealId: deal.id, name: client?.name ?? input.title } })
  }
  await autoAdvance(actor, deal.id)
  publish(actor.organizationId, { type: 'deal', dealId: deal.id })
  return deal
}
