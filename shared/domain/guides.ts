/** Guide matching for a departure (docs/02_FEATURES.md §11.3). */

const COUNTRY_LANG: Record<string, string> = {
  венгри: 'Венгерский', будапешт: 'Венгерский', австри: 'Немецкий', вена: 'Немецкий', итали: 'Итальянский', рим: 'Итальянский',
  флоренц: 'Итальянский', венец: 'Итальянский', милан: 'Итальянский', турци: 'Турецкий', стамбул: 'Турецкий', каппадок: 'Турецкий',
  испани: 'Испанский', барселон: 'Испанский', франци: 'Французский', париж: 'Французский', швейцари: 'Немецкий', женев: 'Французский',
  корея: 'Корейский', сеул: 'Корейский', китай: 'Китайский', япони: 'Японский', германи: 'Немецкий',
}

/** Local languages that help on the route; English is always a plus abroad. */
export function routeLanguages(route: string, domestic: boolean): string[] {
  if (domestic) return ['Казахский', 'Русский']
  const r = route.toLowerCase()
  const langs = new Set<string>()
  for (const [k, v] of Object.entries(COUNTRY_LANG)) if (r.includes(k)) langs.add(v)
  return [...langs]
}

export type GuideFit = 'Лучший выбор' | 'Подходит' | 'С оговорками' | 'Недоступен'

export interface GuideForMatch { languages: string[], rating: number | null, busy: { start: Date, end: Date }[] }

export function guideFit(g: GuideForMatch, dep: { start: Date, end: Date, route: string, domestic: boolean }): { fit: GuideFit, reasons: string[] } {
  const overlap = g.busy.find(b => b.start <= dep.end && b.end >= dep.start)
  if (overlap) return { fit: 'Недоступен', reasons: ['занят на другом выезде в эти даты'] }
  const need = routeLanguages(dep.route, dep.domestic)
  const local = need.filter(l => g.languages.includes(l))
  const english = g.languages.includes('Английский')
  const reasons: string[] = []
  if (local.length) reasons.push(`знает ${local.join(', ').toLowerCase()}`)
  if (!dep.domestic && english) reasons.push('английский')
  if ((g.rating ?? 0) >= 4.8) reasons.push(`рейтинг ${g.rating}`)
  if (dep.domestic) return { fit: g.languages.includes('Казахский') ? 'Лучший выбор' : 'Подходит', reasons }
  if (local.length && (g.rating ?? 0) >= 4.8) return { fit: 'Лучший выбор', reasons }
  if (local.length || english) return { fit: 'Подходит', reasons }
  return { fit: 'С оговорками', reasons: ['нет языка маршрута'] }
}
