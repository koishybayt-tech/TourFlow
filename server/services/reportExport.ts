import type ExcelJS from 'exceljs'
import { formatDate } from '#shared/utils/dates'
import { PIPELINE_LABELS } from '#shared/domain/types'
import type { Report } from './reports'
import { addRows, newWorkbook, sheetWithTitle } from '../utils/xlsx'

export type ReportTab = 'summary' | 'funnel' | 'sources' | 'managers' | 'departures' | 'debts' | 'lost'
export const TAB_TITLES: Record<ReportTab, string> = { summary: 'Сводка', funnel: 'Воронка', sources: 'Источники', managers: 'Менеджеры', departures: 'Выезды', debts: 'Долги', lost: 'Отказы' }

/** Builds an Excel workbook for one tab or all tabs. */
export function reportWorkbook(r: Report, company: string, tabs: ReportTab[]): ExcelJS.Workbook {
  const wb = newWorkbook()
  const sub = `${company} · период: ${r.label} · выгружено ${formatDate(new Date())}`
  for (const tab of tabs) {
    const title = `Отчёт «${TAB_TITLES[tab]}»`
    if (tab === 'summary') {
      const ws = sheetWithTitle(wb, 'Сводка', title, sub, [{ header: 'Показатель', key: 'k', width: 30 }, { header: 'Значение', key: 'v', width: 20, money: true }])
      const k = r.kpis
      addRows(ws, [
        { k: 'Обращения', v: k.leads }, { k: 'Продажи', v: k.sales }, { k: 'Конверсия, %', v: k.conversion }, { k: 'Поступления', v: k.income },
        { k: 'Средний чек', v: k.avgCheck }, { k: 'Комиссия пакетов', v: k.commission }, { k: 'Дебиторка', v: k.receivable }, { k: 'Возвраты', v: k.refunds }, { k: 'Отказы', v: k.lost },
      ])
      for (const row of [5, 6, 7, 13]) ws.getCell(`B${row}`).numFmt = '0'
    }
    if (tab === 'funnel') {
      const ws = sheetWithTitle(wb, 'Воронка', title, sub, [{ header: 'Воронка', key: 'p', width: 18 }, { header: 'Этап', key: 's', width: 28 }, { header: 'Дошли', key: 'n', width: 10 }, { header: 'От входа, %', key: 'pct', width: 14 }])
      addRows(ws, r.funnel.flatMap(f => f.stages.map(s => ({ p: PIPELINE_LABELS[f.pipeline], s: s.name, n: s.reached, pct: f.total ? Math.round((s.reached / f.total) * 100) : 0 }))))
    }
    if (tab === 'sources') {
      const ws = sheetWithTitle(wb, 'Источники', title, sub, [{ header: 'Источник', key: 'source', width: 18 }, { header: 'Обращения', key: 'leads', width: 12 }, { header: 'Продажи', key: 'won', width: 12 }, { header: 'Конверсия, %', key: 'conversion', width: 14 }, { header: 'Выручка', key: 'revenue', width: 16, money: true }])
      addRows(ws, r.sources)
    }
    if (tab === 'managers') {
      const ws = sheetWithTitle(wb, 'Менеджеры', title, sub, [{ header: 'Менеджер', key: 'manager', width: 22 }, { header: 'Обращения', key: 'leads', width: 12 }, { header: 'В работе', key: 'active', width: 10 }, { header: 'Продажи', key: 'won', width: 10 }, { header: 'Конверсия, %', key: 'conversion', width: 14 }, { header: 'Выручка', key: 'revenue', width: 16, money: true }, { header: 'Поступления', key: 'income', width: 16, money: true }, { header: 'Просрочено задач', key: 'overdue', width: 16 }])
      addRows(ws, r.managers)
    }
    if (tab === 'departures') {
      const ws = sheetWithTitle(wb, 'Выезды', title, sub, [{ header: 'Выезд', key: 'name', width: 28 }, { header: 'Даты', key: 'dates', width: 22 }, { header: 'Мест', key: 'seats', width: 8 }, { header: 'Продано', key: 'sold', width: 10 }, { header: 'Готовы', key: 'ready', width: 10 }, { header: 'Заполненность, %', key: 'fill', width: 16 }, { header: 'Валовая выручка', key: 'gross', width: 18, money: true }])
      addRows(ws, r.departures)
    }
    if (tab === 'debts') {
      const ws = sheetWithTitle(wb, 'Дебиторка', `${title}: клиенты`, sub, [{ header: '№', key: 'number', width: 8 }, { header: 'Клиент', key: 'client', width: 26 }, { header: 'Стоимость', key: 'price', width: 16, money: true }, { header: 'Оплачено', key: 'paid', width: 16, money: true }, { header: 'Долг', key: 'debt', width: 16, money: true }, { header: 'Срок', key: 'deadline', width: 12 }, { header: 'Менеджер', key: 'manager', width: 18 }])
      addRows(ws, r.receivables.map(x => ({ ...x, deadline: x.deadline ? formatDate(x.deadline, { dateOnly: true }) : '' })), { totalRow: { client: 'Итого', debt: r.receivables.reduce((s, x) => s + x.debt, 0) } })
      const ws2 = sheetWithTitle(wb, 'Кредиторка', `${title}: туроператоры`, sub, [{ header: '№', key: 'number', width: 8 }, { header: 'Клиент', key: 'client', width: 24 }, { header: 'Оператор', key: 'operator', width: 18 }, { header: 'Бронь', key: 'bookingNo', width: 14 }, { header: 'Нетто', key: 'net', width: 16, money: true }, { header: 'Долг', key: 'debt', width: 16, money: true }, { header: 'Оплатить до', key: 'deadline', width: 14 }])
      addRows(ws2, r.payables.map(x => ({ ...x, deadline: formatDate(x.deadline, { dateOnly: true }) })), { totalRow: { client: 'Итого', debt: r.payables.reduce((s, x) => s + x.debt, 0) } })
    }
    if (tab === 'lost') {
      const ws = sheetWithTitle(wb, 'Отказы', title, sub, [{ header: 'Причина', key: 'reason', width: 30 }, { header: 'Заявок', key: 'count', width: 10 }, { header: 'Сумма', key: 'sum', width: 16, money: true }])
      addRows(ws, r.reasons)
    }
  }
  return wb
}
