import { z } from 'zod'

/** Fields of a tour offer extracted from text, a link or a screenshot (docs/02_FEATURES.md §9.2). */
export const OfferDraftSchema = z.object({
  operator: z.string().nullable().describe('Туроператор, например Anex Tour, FUN&SUN, Pegas Touristik, Kompas'),
  hotel: z.string().nullable().describe('Название отеля без звёзд'),
  stars: z.number().int().min(0).max(5).nullable(),
  resort: z.string().nullable().describe('Страна и курорт, например «Турция, Кемер»'),
  fromDate: z.string().nullable().describe('Дата заезда YYYY-MM-DD'),
  toDate: z.string().nullable().describe('Дата выезда YYYY-MM-DD'),
  nights: z.number().int().nullable(),
  meal: z.string().nullable().describe('Питание по-русски: Всё включено, Завтраки, Полупансион…'),
  room: z.string().nullable(),
  price: z.number().int().nullable().describe('Цена за весь состав в тенге'),
  flight: z.boolean().nullable(),
  transfer: z.boolean().nullable(),
  insurance: z.boolean().nullable(),
})
export type OfferDraft = z.infer<typeof OfferDraftSchema>

const MEALS: [RegExp, string][] = [
  [/(ultra\s*all|uai|ультра)/i, 'Ультра всё включено'],
  [/(all\s*inclusive|\bai\b|вс[её]\s*включено)/i, 'Всё включено'],
  [/(half\s*board|\bhb\b|полупансион)/i, 'Полупансион'],
  [/(full\s*board|\bfb\b|полный\s*пансион)/i, 'Полный пансион'],
  [/(bed\s*&?\s*breakfast|\bbb\b|завтрак)/i, 'Завтраки'],
  [/(room\s*only|\bro\b|без\s*питания)/i, 'Без питания'],
]
const OPERATORS = ['Anex Tour', 'FUN&SUN', 'Pegas Touristik', 'Kompas', 'Coral Travel', 'Tez Tour', 'Selfie Travel', 'Join UP']

function toIso(d: string, fallbackYear: number): string | null {
  const m = d.match(/(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?/)
  if (!m) return null
  const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : fallbackYear
  return `${y}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`
}

/** Best-effort parsing of an offer copied from an operator site or messenger. */
export function parseOfferText(text: string, now = new Date()): OfferDraft {
  const t = text.replace(/ /g, ' ')
  const stars = t.match(/(\d)\s*(?:\*|★|звезд|звёзд)/i)
  const dates = [...t.matchAll(/\b\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?\b/g)].map(m => m[0])
  const nights = t.match(/(\d{1,2})\s*(?:ноч|night|н\.)/i)
  const prices = [...t.matchAll(/(\d[\d\s]{4,})\s*(?:₸|тг|kzt|тенге)/gi)].map(m => Number(m[1]!.replace(/\s/g, '')))
  const fromDate = dates[0] ? toIso(dates[0], now.getFullYear()) : null
  let toDate = dates[1] ? toIso(dates[1], now.getFullYear()) : null
  if (fromDate && !toDate && nights) toDate = new Date(+new Date(`${fromDate}T00:00:00Z`) + Number(nights[1]) * 86_400_000).toISOString().slice(0, 10)
  const hotelLine = t.split('\n').map(s => s.trim()).find(l => /(\d\s*\*|hotel|resort|отель|otel)/i.test(l))
  const hotel = hotelLine ? hotelLine.replace(/\d\s*(\*|★)+.*$/, '').replace(/^(отель|hotel)\s*/i, '').trim() || null : null
  return {
    operator: OPERATORS.find(o => new RegExp(`(^|[^\\p{L}])${o.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*')}($|[^\\p{L}])`, 'iu').test(t)) ?? null,
    hotel,
    stars: stars ? Number(stars[1]) : null,
    resort: (t.match(/(Турция|ОАЭ|Египет|Таиланд|Вьетнам|Мальдивы|Шри-Ланка|Грузия)[,\s]+([А-ЯЁ][А-ЯЁа-яё-]+)/) ?? []).slice(1, 3).join(', ') || null,
    fromDate,
    toDate,
    nights: nights ? Number(nights[1]) : null,
    meal: MEALS.find(([re]) => re.test(t))?.[1] ?? null,
    room: (t.match(/(standard|superior|deluxe|family|suite|стандарт|делюкс|семейный)[^\n,]*/i) ?? [null])[0]?.trim() ?? null,
    price: prices.length ? Math.max(...prices) : null,
    flight: /(перел[её]т|авиа|flight)/i.test(t) ? true : null,
    transfer: /трансфер|transfer/i.test(t) ? true : null,
    insurance: /страхов|insurance/i.test(t) ? true : null,
  }
}
