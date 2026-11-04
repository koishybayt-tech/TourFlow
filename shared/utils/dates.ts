/** Date helpers. Business time zone is Asia/Almaty (UTC+5, no DST). */

export const ALMATY_OFFSET_MIN = 5 * 60

const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
const MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

/** Wall-clock parts of a moment in Almaty. */
export function almatyParts(d: Date | string | number) {
  const t = new Date(new Date(d).getTime() + ALMATY_OFFSET_MIN * 60_000)
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate(), hh: t.getUTCHours(), mm: t.getUTCMinutes(), dow: t.getUTCDay() }
}

/** UTC instant for an Almaty wall-clock time. Month is 0-based. */
export function almatyDate(y: number, m: number, d: number, hh = 0, mm = 0): Date {
  return new Date(Date.UTC(y, m, d, hh, mm) - ALMATY_OFFSET_MIN * 60_000)
}

export function startOfAlmatyDay(d: Date | string | number = new Date()): Date {
  const p = almatyParts(d)
  return almatyDate(p.y, p.m, p.d)
}

/** Calendar date (stored as @db.Date, UTC midnight) → its day parts. */
function dateOnlyParts(d: Date | string) {
  const t = new Date(d)
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate() }
}

const pad = (n: number) => String(n).padStart(2, '0')

/** 22.10.2026 */
export function formatDate(d: Date | string | null | undefined, opts: { dateOnly?: boolean } = {}): string {
  if (!d) return ''
  const p = opts.dateOnly ? dateOnlyParts(d) : almatyParts(d)
  return `${pad(p.d)}.${pad(p.m + 1)}.${p.y}`
}

/** 22.10 14:25 */
export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return ''
  const p = almatyParts(d)
  return `${pad(p.d)}.${pad(p.m + 1)}.${p.y} ${pad(p.hh)}:${pad(p.mm)}`
}

export function formatTime(d: Date | string | null | undefined): string {
  if (!d) return ''
  const p = almatyParts(d)
  return `${pad(p.hh)}:${pad(p.mm)}`
}

/** «14 ноября» */
export function formatDayMonth(d: Date | string, opts: { dateOnly?: boolean } = {}): string {
  const p = opts.dateOnly ? dateOnlyParts(d) : almatyParts(d)
  return `${p.d} ${MONTHS_GEN[p.m]}`
}

/** «14–21 ноября», «30 октября – 2 ноября», with year when it is not the current one. */
export function formatRange(start: Date | string, end: Date | string, opts: { dateOnly?: boolean, withYear?: boolean } = { dateOnly: true }): string {
  const a = opts.dateOnly ? dateOnlyParts(start) : almatyParts(start)
  const b = opts.dateOnly ? dateOnlyParts(end) : almatyParts(end)
  const year = opts.withYear ? ` ${b.y}` : ''
  if (a.y === b.y && a.m === b.m) return a.d === b.d ? `${a.d} ${MONTHS_GEN[a.m]}${year}` : `${a.d}–${b.d} ${MONTHS_GEN[a.m]}${year}`
  return `${a.d} ${MONTHS_GEN[a.m]} – ${b.d} ${MONTHS_GEN[b.m]}${year}`
}

/** «Ноябрь 2026» */
export function formatMonth(d: Date | string, opts: { dateOnly?: boolean } = { dateOnly: true }): string {
  const p = opts.dateOnly ? dateOnlyParts(d) : almatyParts(d)
  return `${MONTHS_NOM[p.m]} ${p.y}`
}

export function daysBetween(a: Date | string, b: Date | string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000)
}

/** «Сегодня», «Завтра», «Вчера» or 22.10 for due dates. */
export function relativeDay(d: Date | string | null | undefined, now: Date = new Date()): string {
  if (!d) return ''
  const diff = daysBetween(startOfAlmatyDay(now), startOfAlmatyDay(d))
  if (diff === 0) return 'Сегодня'
  if (diff === 1) return 'Завтра'
  if (diff === -1) return 'Вчера'
  const p = almatyParts(d)
  return `${pad(p.d)}.${pad(p.m + 1)}`
}

/** Calendar date as YYYY-MM-DD in Almaty. */
export function isoDay(d: Date | string): string {
  const p = almatyParts(d)
  return `${p.y}-${pad(p.m + 1)}-${pad(p.d)}`
}
