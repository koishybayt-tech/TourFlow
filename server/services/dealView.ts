import { isRequirementDone, stageProgress, type RequirementDef } from '#shared/domain/dealStatus'
import { isReceiptRecommended } from '#shared/domain/receipts'
import { can } from '#shared/permissions'
import { formatRange } from '#shared/utils/dates'
import type { AuthContext } from '../utils/auth'
import { decryptPii, maskIin, maskPassport } from '../utils/crypto'
import { dealSnapshot, loadStages } from './deals'

/** Which deal page block fixes a requirement (for «Осталось…» links). */
export function requirementSection(r: RequirementDef): string {
  switch (r.type) {
    case 'CLIENT':
    case 'TRAVELERS': return 'client'
    case 'FIELD':
    case 'DEPARTURE': return 'tour'
    case 'PAY': return 'pay'
    case 'SIGN': return 'contract'
    case 'EVENT': return 'visa'
    case 'DOC': return r.config.docType === 'Виза' ? 'visa' : 'docs'
    default: return 'status'
  }
}

/** Everything the deal page needs in one payload. */
export async function dealView(ctx: AuthContext, id: string) {
  const showMoney = can(ctx.role, 'payments')
  const showDocs = can(ctx.role, 'documents')
  const deal = await ctx.db.deal.findFirstOrThrow({
    where: { id },
    include: {
      client: true,
      stage: true,
      direction: { select: { id: true, name: true } },
      manager: { include: { user: { select: { name: true } } } },
      departure: { include: { guide: { select: { fullName: true } } } },
      travelers: { orderBy: { order: 'asc' } },
      payments: { orderBy: { paidAt: 'asc' } },
      documents: { orderBy: { createdAt: 'desc' } },
      contracts: { include: { signatures: true, template: { select: { name: true, kind: true } } }, orderBy: { createdAt: 'desc' } },
      notes: { orderBy: { createdAt: 'desc' } },
      calendar: { orderBy: { startAt: 'asc' }, include: { assignee: { include: { user: { select: { name: true } } } } } },
      offers: { include: { operator: { select: { name: true, commissionPct: true } } }, orderBy: { createdAt: 'asc' } },
      bookings: { include: { operator: { select: { name: true } }, payments: true, offer: { select: { hotel: true } } }, orderBy: { createdAt: 'desc' } },
      conversations: { include: { messages: { orderBy: { sentAt: 'desc' }, take: 3 } } },
    },
  })

  const stages = await loadStages(ctx.db, deal.pipeline)
  const { forStage } = await dealSnapshot(ctx.db, id)
  const current = stages.find(s => s.id === deal.stageId)!
  const snap = forStage(current.id)
  const progress = stageProgress(current, snap)

  const paid = deal.payments.reduce((s, p) => s + p.amount, 0)
  const lastEvents = await ctx.db.dealEvent.findMany({ where: { dealId: id }, orderBy: { at: 'desc' }, take: 5 })
  const eventsCount = await ctx.db.dealEvent.count({ where: { dealId: id } })
  const otherDeals = await ctx.db.deal.findMany({
    where: { clientId: deal.clientId, id: { not: id }, deletedAt: null },
    include: { stage: { select: { name: true } }, payments: { select: { amount: true } } },
    orderBy: { createdAt: 'desc' },
  })
  const tasks = await ctx.db.task.findMany({
    where: { dealId: id },
    include: { assignee: { include: { user: { select: { name: true } } } }, stage: { select: { name: true } } },
    orderBy: [{ status: 'asc' }, { dueAt: 'asc' }],
  })
  const departures = deal.pipeline === 'GROUP'
    ? await ctx.db.departure.findMany({ where: { OR: [{ startDate: { gte: new Date() } }, { id: deal.departureId ?? '-' }] }, orderBy: { startDate: 'asc' } })
    : []
  const conv = deal.conversations[0] ?? (await ctx.db.conversation.findFirst({ where: { clientPhone: deal.client.phone }, include: { messages: { orderBy: { sentAt: 'desc' }, take: 3 } } }))
  const receiptTemplates = showDocs ? await ctx.db.documentTemplate.findMany({ where: { kind: 'receipt', enabled: true }, orderBy: { name: 'asc' } }) : []
  const chosenOffer = deal.offers.find(o => o.status === 'CHOSEN')
  const receiptCtx = {
    pipeline: deal.pipeline,
    hotelChosen: !!chosenOffer,
    visa: !!deal.departure?.visa,
    hasChildren: deal.travelers.some(t => t.isChild),
  }
  const tripEnd = deal.departure?.endDate ?? chosenOffer?.toDate ?? null
  const sixMonthsAfter = tripEnd ? new Date(tripEnd.getTime() + 183 * 86_400_000) : null

  const reqView = (r: RequirementDef) => ({
    id: r.id,
    type: r.type,
    label: r.label,
    required: r.required,
    config: r.config,
    done: isRequirementDone(r, snap),
    section: requirementSection(r),
  })

  return {
    deal: {
      id: deal.id,
      number: deal.number,
      pipeline: deal.pipeline,
      title: deal.title,
      dates: deal.dates,
      people: deal.people,
      budget: deal.budget,
      visaHistory: deal.visaHistory,
      price: deal.price,
      fullPayDeadline: deal.fullPayDeadline,
      source: deal.source,
      createdAt: deal.createdAt,
      wonAt: deal.wonAt,
      lostAt: deal.lostAt,
      lostReason: deal.lostReason,
      lostComment: deal.lostComment,
      managerId: deal.managerId,
      manager: deal.manager?.user.name ?? null,
      direction: deal.direction,
      reqChecks: deal.reqChecks as Record<string, boolean>,
      reqComments: deal.reqComments as Record<string, string>,
      reqValues: deal.reqValues as Record<string, string>,
    },
    client: {
      id: deal.client.id,
      name: deal.client.name,
      phone: deal.client.phone,
      email: deal.client.email,
      fullName: deal.client.fullName,
      iinMasked: maskIin(decryptPii(deal.client.iinEnc)),
      hasIin: !!deal.client.iinEnc,
      birthDate: deal.client.birthDate,
      address: deal.client.address,
      pdConsentAt: deal.client.pdConsentAt,
    },
    travelers: deal.travelers.map(t => ({
      id: t.id,
      fullNameLatin: t.fullNameLatin,
      passportMasked: maskPassport(decryptPii(t.passportNoEnc)),
      hasPassport: !!t.passportNoEnc,
      passportExpiry: t.passportExpiry,
      expiryWarn: !!(t.passportExpiry && sixMonthsAfter && t.passportExpiry < sixMonthsAfter),
      birthDate: t.birthDate,
      isChild: t.isChild,
      childAge: t.childAge,
      visaStatus: t.visaStatus,
    })),
    departure: deal.departure
      ? { id: deal.departure.id, name: deal.departure.name, dates: formatRange(deal.departure.startDate, deal.departure.endDate), price: deal.departure.price, visa: deal.departure.visa, guide: deal.departure.guide?.fullName ?? null, payDeadline: deal.departure.payDeadline }
      : null,
    departures: departures.map(d => ({ id: d.id, label: `${d.name} · ${formatRange(d.startDate, d.endDate)}`, price: d.price })),
    stages: stages.map(s => ({ id: s.id, name: s.name, order: s.order, description: s.description, requirements: s.requirements.map(reqView) })),
    status: {
      stageId: current.id,
      stageName: current.name,
      order: current.order,
      total: stages.length,
      description: current.description,
      requirements: current.requirements.map(reqView),
      doneCount: progress.doneCount,
      totalCount: progress.totalCount,
      openTasks: progress.openTasks,
      complete: progress.complete,
      isLast: current.order === stages.length - 1,
    },
    money: showMoney
      ? {
          price: deal.price,
          paid,
          debt: Math.max(0, deal.price - paid),
          payments: deal.payments.map(p => ({ id: p.id, amount: p.amount, type: p.type, method: p.method, comment: p.comment, paidAt: p.paidAt })),
          deadline: deal.fullPayDeadline ?? deal.departure?.payDeadline ?? null,
        }
      : null,
    contracts: showDocs
      ? deal.contracts.map(c => ({
          id: c.id, number: c.number, kind: c.kind, template: c.template.name, status: c.status, createdAt: c.createdAt, annulledAt: c.annulledAt,
          emptyFields: c.emptyFields, fileKey: c.fileKey,
          signatures: c.signatures.map(s => ({ id: s.id, side: s.side, token: s.token, signerName: s.signerName, method: s.method, signedAt: s.signedAt })),
        }))
      : [],
    receipts: receiptTemplates.map(t => {
      const contract = deal.contracts.find(c => c.templateId === t.id && !c.annulledAt)
      return { id: t.id, name: t.name, short: t.short, condition: t.condition, recommended: isReceiptRecommended(t.condition, receiptCtx), contractId: contract?.id ?? null, status: contract?.status ?? null }
    }),
    documents: showDocs ? deal.documents.map(d => ({ id: d.id, type: d.type, name: d.name, size: d.size, createdAt: d.createdAt })) : [],
    calendar: deal.calendar.map(e => ({ id: e.id, type: e.type, title: e.title, startAt: e.startAt, place: e.place, who: e.assignee?.user.name ?? null })),
    tasks: tasks.map(t => ({
      id: t.id, title: t.title, status: t.status, priority: t.priority, dueAt: t.dueAt, isSystem: t.isSystem,
      assignee: t.assignee?.user.name ?? null, stage: t.stage?.name ?? null, stageId: t.stageId,
    })),
    offers: deal.offers.map(o => ({
      id: o.id, operatorId: o.operatorId, operator: o.operator.name, commissionPct: Number(o.operator.commissionPct), hotel: o.hotel, stars: o.stars, resort: o.resort,
      fromDate: o.fromDate, toDate: o.toDate, meal: o.meal, room: o.room, flight: o.flight, transfer: o.transfer, insurance: o.insurance,
      net: showMoney ? o.net : null, price: o.price, status: o.status, note: o.note, source: o.source, externalRef: o.externalRef,
    })),
    bookings: deal.bookings.map(b => ({
      id: b.id, offerId: b.offerId, operator: b.operator.name, hotel: b.offer.hotel, number: b.number, status: b.status, comment: b.comment,
      createdAt: b.createdAt, confirmedAt: b.confirmedAt, paymentDeadline: b.paymentDeadline, net: showMoney ? b.net : null,
      paid: showMoney ? b.payments.reduce((s, p) => s + p.amount, 0) : null, cancelReason: b.cancelReason, penalty: b.penalty,
      payments: showMoney ? b.payments.map(p => ({ id: p.id, amount: p.amount, method: p.method, paidAt: p.paidAt })) : [],
    })),
    chat: conv ? { id: conv.id, channel: conv.channel, messages: [...conv.messages].reverse().map(m => ({ id: m.id, direction: m.direction, text: m.text, sentAt: m.sentAt })) } : null,
    otherDeals: otherDeals.map(d => ({
      id: d.id, number: d.number, title: d.title, status: d.lostAt ? 'lost' : d.wonAt ? 'won' : 'active',
      stage: d.lostAt ? 'Отказ' : d.wonAt ? 'Успешно' : d.stage.name, price: showMoney ? d.price : null, paid: showMoney ? d.payments.reduce((s, p) => s + p.amount, 0) : null,
    })),
    notes: deal.notes.map(n => ({ id: n.id, text: n.text, author: n.authorLabel, createdAt: n.createdAt })),
    history: lastEvents.map(e => ({ id: e.id, at: e.at, text: e.text, actor: e.actorLabel, kind: e.kind })),
    historyCount: eventsCount,
  }
}
