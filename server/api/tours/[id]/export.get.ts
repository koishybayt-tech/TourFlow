import { toKzt, tourScenarios } from '#shared/domain/tourCalc'
import { formatDate } from '#shared/utils/dates'
import { TOUR_INCLUDE, calcInput, tourCalc, tourDto } from '../../../services/tours'

/** Tour finance to Excel: summary, scenarios, flights, stays, costs. Owner only. */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'tours.finance')
  const t = await ctx.db.tour.findFirst({ where: { id: getRouterParam(event, 'id')!, deletedAt: null }, include: TOUR_INCLUDE })
  if (!t) notFound('Тур')
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: ctx.organizationId }, select: { name: true } })
  const dto = tourDto(t)
  const c = tourCalc(dto)
  const rates = dto.rates
  const sub = `${org.name} · ${dto.startDate ?? '—'} – ${dto.endDate ?? '—'} · курсы EUR ${rates.EUR}, USD ${rates.USD}, CHF ${rates.CHF}${dto.ratesFixedAt ? ` на ${dto.ratesFixedAt}` : ''} · выгружено ${formatDate(new Date())}`
  const wb = newWorkbook()

  const s1 = sheetWithTitle(wb, 'Сводка', `${t.name} — финансы тура`, sub, [{ header: 'Показатель', key: 'k', width: 34 }, { header: 'Значение', key: 'v', width: 22, money: true }])
  addRows(s1, [
    { k: 'Мест в группе', v: t.seats }, { k: 'Цена продажи', v: t.price }, { k: 'Переменные на туриста', v: c.variable }, { k: 'Постоянные на группу', v: c.fixed },
    { k: 'Себестоимость на туриста (полная группа)', v: c.costPer }, { k: 'Себестоимость группы', v: c.cost }, { k: 'Выручка', v: c.revenue },
    { k: 'Прибыль группы', v: c.profit }, { k: 'Рентабельность, %', v: c.margin }, { k: 'Безубыточность, чел.', v: c.breakEven ?? '—' }, { k: 'Рекомендуемая цена (+25%)', v: c.suggestPrice ?? '—' },
  ])
  s1.getCell('B5').numFmt = '0'
  s1.getCell('B13').numFmt = '0'
  s1.getCell('B14').numFmt = '0'

  const s2 = sheetWithTitle(wb, 'Сценарии', 'Сценарии наполнения', sub, [
    { header: 'Сценарий', key: 'l', width: 20 }, { header: 'Туристов', key: 'n', width: 10 }, { header: 'Выручка', key: 'r', width: 16, money: true },
    { header: 'Себестоимость', key: 'c', width: 16, money: true }, { header: 'Прибыль', key: 'p', width: 16, money: true }, { header: 'Рентабельность, %', key: 'm', width: 18 },
  ])
  addRows(s2, tourScenarios(calcInput(dto)).map(s => ({ l: s.label, n: s.n, r: s.result.revenue, c: s.result.cost, p: s.result.profit, m: s.result.margin })))

  const s3 = sheetWithTitle(wb, 'Перелёты', 'Перелёты', sub, [
    { header: 'Откуда', key: 'from', width: 16 }, { header: 'Куда', key: 'to', width: 16 }, { header: 'Дата', key: 'at', width: 18 }, { header: 'Авиакомпания', key: 'al', width: 16 },
    { header: 'Билет', key: 't', width: 10 }, { header: 'Багаж', key: 'b', width: 10 }, { header: 'Валюта', key: 'cur', width: 8 }, { header: 'На туриста, ₸', key: 'kzt', width: 16, money: true },
  ])
  addRows(s3, dto.flights.map(f => ({ from: f.from, to: f.to, at: f.departAt?.replace('T', ' ') ?? '', al: f.airline ?? '', t: f.ticket ?? 0, b: f.baggage ?? 0, cur: f.currency, kzt: Math.round(toKzt(f.ticket, f.currency, rates) + toKzt(f.baggage, f.currency, rates)) })), { totalRow: { from: 'Итого на туриста', kzt: c.flights } })

  const s4 = sheetWithTitle(wb, 'Проживание', 'Проживание', sub, [
    { header: 'Город', key: 'city', width: 16 }, { header: 'Отель', key: 'name', width: 32 }, { header: 'Заезд', key: 'in', width: 12 }, { header: 'Выезд', key: 'out', width: 12 },
    { header: 'Номеров', key: 'rooms', width: 10 }, { header: 'Стоимость', key: 'total', width: 12 }, { header: 'Валюта', key: 'cur', width: 8 }, { header: 'Итого, ₸', key: 'kzt', width: 16, money: true },
  ])
  addRows(s4, dto.stays.map(s => ({ city: s.city, name: s.name, in: s.checkIn ?? '', out: s.checkOut ?? '', rooms: s.rooms, total: s.total ?? 0, cur: s.currency, kzt: Math.round(toKzt(s.total, s.currency, rates)) })), { totalRow: { city: 'Итого на группу', kzt: c.stays } })

  const s5 = sheetWithTitle(wb, 'Расходы', 'Прочие расходы (план / факт)', sub, [
    { header: 'Статья', key: 'cat', width: 30 }, { header: 'План', key: 'plan', width: 12 }, { header: 'Факт', key: 'fact', width: 12 }, { header: 'Единица', key: 'unit', width: 10 }, { header: 'На кого', key: 'per', width: 12 },
  ])
  addRows(s5, dto.costs.map(x => ({ cat: x.category, plan: x.plan ?? '', fact: x.fact ?? '', unit: x.unit === 'PERCENT' ? '%' : x.unit, per: x.per === 'tourist' ? 'на туриста' : 'на группу' })))
  return sendWorkbook(event, wb, `${t.name} — финансы.xlsx`)
})
