/**
 * Document templates (docs/02_FEATURES.md §7.1): variables `{Any_Name}` bound to deal fields.
 */

export interface TemplateField {
  key: string
  label: string
  group: 'Клиент' | 'Поездка' | 'Оплата' | 'Договор' | 'Компания'
  /** Lowercased hints for auto-binding by placeholder name. */
  hints: string[]
  example: string
}

export const TEMPLATE_FIELDS: TemplateField[] = [
  { key: 'client.fullName', label: 'ФИО клиента', group: 'Клиент', hints: ['client_fio', 'фио', 'fio', 'client_name', 'турист'], example: 'Нурланова Айгерим Бериковна' },
  { key: 'client.iin', label: 'ИИН клиента', group: 'Клиент', hints: ['iin', 'иин'], example: '900315400123' },
  { key: 'client.birthDate', label: 'Дата рождения клиента', group: 'Клиент', hints: ['birth', 'рожд'], example: '15.03.1990' },
  { key: 'client.address', label: 'Адрес клиента', group: 'Клиент', hints: ['address', 'адрес'], example: 'г. Алматы, мкр. Самал-2, д. 58' },
  { key: 'client.phone', label: 'Телефон клиента', group: 'Клиент', hints: ['phone', 'телефон'], example: '+7 701 234 56 78' },
  { key: 'client.email', label: 'Email клиента', group: 'Клиент', hints: ['email', 'почт'], example: 'aigerim.n@mail.kz' },
  { key: 'trip.name', label: 'Тур', group: 'Поездка', hints: ['tour_name', 'тур', 'tour'], example: 'Будапешт — Вена' },
  { key: 'trip.dates', label: 'Даты поездки', group: 'Поездка', hints: ['tour_dates', 'даты', 'dates'], example: '14–21 ноября 2026' },
  { key: 'trip.people', label: 'Количество туристов', group: 'Поездка', hints: ['tourists_count', 'count', 'количеств'], example: '2' },
  { key: 'trip.travelers', label: 'Список туристов с паспортами', group: 'Поездка', hints: ['tourists_list', 'список', 'travelers'], example: 'NURLANOVA AIGERIM (N12345678)' },
  { key: 'trip.guide', label: 'Гид', group: 'Поездка', hints: ['guide', 'гид'], example: 'Асхат Ермеков' },
  { key: 'trip.hotel', label: 'Отель', group: 'Поездка', hints: ['hotel', 'отел'], example: 'Coral Beach Resort 5★' },
  { key: 'trip.operator', label: 'Туроператор', group: 'Поездка', hints: ['operator', 'оператор'], example: 'FUN&SUN' },
  { key: 'pay.total', label: 'Стоимость', group: 'Оплата', hints: ['price_total', 'стоимост', 'price', 'total'], example: '1 380 000 ₸' },
  { key: 'pay.prepay', label: 'Предоплата', group: 'Оплата', hints: ['prepay', 'предоплат'], example: '200 000 ₸' },
  { key: 'pay.paid', label: 'Оплачено', group: 'Оплата', hints: ['paid', 'оплачено', 'внесено'], example: '200 000 ₸' },
  { key: 'pay.deadline', label: 'Срок полной оплаты', group: 'Оплата', hints: ['deadline', 'full_pay', 'срок'], example: '31.10.2026' },
  { key: 'pay.refundRule', label: 'Правило возврата', group: 'Оплата', hints: ['refund', 'возврат'], example: 'до покупки авиабилетов — возврат 100%' },
  { key: 'contract.number', label: 'Номер договора', group: 'Договор', hints: ['contract_no', 'номер', 'number', 'no'], example: 'ДТ-2026-001' },
  { key: 'contract.date', label: 'Дата договора', group: 'Договор', hints: ['contract_date', 'дата', 'date'], example: '22.10.2026' },
  { key: 'contract.manager', label: 'Менеджер', group: 'Договор', hints: ['manager', 'менеджер'], example: 'Аягөз' },
  { key: 'company.name', label: 'Название компании', group: 'Компания', hints: ['company_name', 'компани', 'агентств'], example: 'ТОО «Demo Travel»' },
  { key: 'company.bin', label: 'БИН', group: 'Компания', hints: ['bin', 'бин'], example: '230540012345' },
  { key: 'company.director', label: 'Директор', group: 'Компания', hints: ['director', 'директор'], example: 'Ерлан' },
  { key: 'company.address', label: 'Адрес компании', group: 'Компания', hints: ['company_address'], example: 'г. Алматы, пр. Абая, 150' },
  { key: 'company.bank', label: 'Банк', group: 'Компания', hints: ['bank', 'банк'], example: 'АО «Kaspi Bank»' },
  { key: 'company.iik', label: 'ИИК', group: 'Компания', hints: ['iik', 'иик'], example: 'KZ12722S000012345678' },
  { key: 'company.bik', label: 'БИК', group: 'Компания', hints: ['bik', 'бик'], example: 'CASPKZKA' },
  { key: 'company.license', label: 'Лицензия', group: 'Компания', hints: ['license', 'лиценз'], example: '№ 12345' },
  { key: 'company.phone', label: 'Телефон компании', group: 'Компания', hints: ['company_phone'], example: '+7 727 300 10 20' },
]

export const FIELD_BY_KEY = Object.fromEntries(TEMPLATE_FIELDS.map(f => [f.key, f])) as Record<string, TemplateField>

export interface TemplateVariable {
  placeholder: string
  field: string | null
  count: number
}

const PLACEHOLDER_RE = /\{([^{}\s]{1,64})\}/g

/** Finds `{name}` placeholders with occurrence counts, in order of first appearance. */
export function extractPlaceholders(text: string): { placeholder: string, count: number }[] {
  const counts = new Map<string, number>()
  for (const m of text.matchAll(PLACEHOLDER_RE)) counts.set(m[1]!, (counts.get(m[1]!) ?? 0) + 1)
  return [...counts].map(([placeholder, count]) => ({ placeholder, count }))
}

/** Auto-binds a placeholder to a field: exact hint match first, then the longest hint contained in the name. */
export function autoBind(placeholder: string): string | null {
  const p = placeholder.toLowerCase()
  const exact = TEMPLATE_FIELDS.find(f => f.hints.includes(p))
  if (exact) return exact.key
  let best: { key: string, len: number } | null = null
  for (const f of TEMPLATE_FIELDS) {
    for (const h of f.hints) {
      if (h.length >= 3 && p.includes(h) && (!best || h.length > best.len)) best = { key: f.key, len: h.length }
    }
  }
  return best?.key ?? null
}

export function bindVariables(text: string, existing: TemplateVariable[] = []): TemplateVariable[] {
  const prev = new Map(existing.map(v => [v.placeholder, v.field]))
  return extractPlaceholders(text).map(({ placeholder, count }) => ({
    placeholder,
    count,
    field: prev.get(placeholder) ?? autoBind(placeholder),
  }))
}

export const BLANK = '______________'

/** Fills placeholders. Missing values become BLANK and are reported. */
export function renderTemplate(text: string, variables: TemplateVariable[], values: Record<string, string | null | undefined>): { text: string, empty: string[] } {
  const byPh = new Map(variables.map(v => [v.placeholder, v.field]))
  const empty = new Set<string>()
  const out = text.replace(PLACEHOLDER_RE, (_, ph: string) => {
    const field = byPh.get(ph)
    const v = field ? values[field] : undefined
    if (v === undefined || v === null || String(v).trim() === '') {
      empty.add(field ?? ph)
      return BLANK
    }
    return String(v)
  })
  return { text: out, empty: [...empty] }
}
