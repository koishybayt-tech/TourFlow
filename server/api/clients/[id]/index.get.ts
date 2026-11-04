import { stageProgress } from '#shared/domain/dealStatus'
import { can } from '#shared/permissions'
import { accessibleClient } from '../../../services/access'
import { dealSnapshot, loadStages } from '../../../services/deals'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'clients')
  const client = await accessibleClient(ctx, getRouterParam(event, 'id')!)
  const showMoney = can(ctx.role, 'payments')
  const deals = await ctx.db.deal.findMany({
    where: { clientId: client.id, deletedAt: null },
    include: {
      stage: { select: { name: true, order: true } },
      payments: { orderBy: { paidAt: 'desc' } },
      documents: { orderBy: { createdAt: 'desc' } },
      travelers: { orderBy: { order: 'asc' } },
      events: { orderBy: { at: 'desc' } },
      manager: { include: { user: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  })
  const paidOf = (d: (typeof deals)[number]) => d.payments.reduce((s, p) => s + p.amount, 0)
  const won = deals.filter(d => d.wonAt)
  const active = deals.filter(d => !d.wonAt && !d.lostAt)
  const lost = deals.filter(d => d.lostAt)

  const activeCards = []
  for (const d of active) {
    const stages = await loadStages(ctx.db, d.pipeline)
    const { forStage } = await dealSnapshot(ctx.db, d.id)
    const stage = stages.find(s => s.id === d.stageId)!
    const p = stageProgress(stage, forStage(stage.id))
    activeCards.push({
      id: d.id, number: d.number, title: d.title, dates: d.dates, pipeline: d.pipeline,
      stage: stage.name, stageIndex: stage.order, stagesCount: stages.length, done: p.doneCount, total: p.totalCount,
      next: p.missing[0]?.label ?? (p.openTasks[0] ? `Задача: ${p.openTasks[0].title}` : null),
      price: showMoney ? d.price : null, paid: showMoney ? paidOf(d) : null, debt: showMoney ? Math.max(0, d.price - paidOf(d)) : null,
      manager: d.manager?.user.name ?? null,
    })
  }

  const conversations = await ctx.db.conversation.findMany({
    where: { OR: [{ clientPhone: client.phone }, ...client.extraPhones.map(p => ({ clientPhone: p })), { dealId: { in: deals.map(d => d.id) } }] },
    include: { messages: { orderBy: { sentAt: 'asc' } } },
  })
  const firstContact = [client.createdAt, ...deals.map(d => d.createdAt)].sort((a, b) => +a - +b)[0]
  const lastContact = [...deals.flatMap(d => d.events.map(e => e.at)), ...conversations.map(c => c.lastMessageAt)].sort((a, b) => +b - +a)[0] ?? firstContact
  const manager = client.managerId ? await ctx.db.member.findFirst({ where: { id: client.managerId }, include: { user: { select: { name: true } } } }) : null

  const travelers = new Map<string, { name: string, passport: string | null, expiry: Date | null, isChild: boolean }>()
  for (const d of deals) {
    for (const t of d.travelers) {
      if (!travelers.has(t.fullNameLatin)) travelers.set(t.fullNameLatin, { name: t.fullNameLatin, passport: maskPassport(decryptPii(t.passportNoEnc)), expiry: t.passportExpiry, isChild: t.isChild })
    }
  }
  const contractFields = [client.fullName, client.iinEnc, client.birthDate, client.email, client.address]

  return {
    client: {
      id: client.id, name: client.name, phone: client.phone, extraPhones: client.extraPhones, email: client.email,
      fullName: client.fullName, iinMasked: maskIin(decryptPii(client.iinEnc)), hasIin: !!client.iinEnc, birthDate: client.birthDate, address: client.address,
      source: client.source, tags: client.tags, note: client.note, pdConsentAt: client.pdConsentAt, managerId: client.managerId, manager: manager?.user.name ?? null,
      firstContact, lastContact, contractFilled: contractFields.filter(Boolean).length, contractTotal: contractFields.length,
      badges: [won.length >= 2 ? 'Постоянный' : won.length === 1 ? 'Был в поездке' : 'Новый'],
    },
    stats: {
      paid: showMoney ? deals.reduce((s, d) => s + paidOf(d), 0) : null,
      trips: won.length,
      active: active.length,
      avgCheck: showMoney && won.length ? Math.round(won.reduce((s, d) => s + d.price, 0) / won.length) : null,
      debt: showMoney ? active.reduce((s, d) => s + Math.max(0, d.price - paidOf(d)), 0) : null,
      lost: lost.length,
    },
    activeDeals: activeCards,
    deals: deals.map(d => ({
      id: d.id, number: d.number, title: d.title, dates: d.dates, pipeline: d.pipeline, createdAt: d.createdAt,
      status: d.lostAt ? 'lost' : d.wonAt ? 'won' : 'active', stage: d.lostAt ? `Отказ: ${d.lostReason}` : d.wonAt ? 'Завершена' : d.stage.name,
      price: showMoney ? d.price : null, paid: showMoney ? paidOf(d) : null, manager: d.manager?.user.name ?? null,
    })),
    timeline: deals.flatMap(d => d.events.map(e => ({ id: e.id, at: e.at, text: e.text, kind: e.kind, actor: e.actorLabel, deal: { id: d.id, number: d.number } }))).sort((a, b) => +b.at - +a.at),
    travelers: [...travelers.values()],
    messages: conversations.flatMap(c => c.messages.map(m => ({ id: m.id, channel: c.channel, direction: m.direction, text: m.text, sentAt: m.sentAt }))).sort((a, b) => +a.sentAt - +b.sentAt),
    payments: showMoney ? deals.flatMap(d => d.payments.map(p => ({ id: p.id, amount: p.amount, type: p.type, method: p.method, paidAt: p.paidAt, deal: { id: d.id, number: d.number } }))) : [],
    documents: can(ctx.role, 'documents') ? deals.flatMap(d => d.documents.map(x => ({ id: x.id, name: x.name, type: x.type, createdAt: x.createdAt, deal: { id: d.id, number: d.number } }))) : [],
  }
})
