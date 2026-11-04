export { formatMoney, parseMoney } from '#shared/utils/money'
export { formatPhone, normalizePhone } from '#shared/utils/phone'
export { formatDate, formatDateTime, formatTime, formatRange, formatDayMonth, formatMonth, relativeDay, isoDay, startOfAlmatyDay, daysBetween } from '#shared/utils/dates'
export { PIPELINE_LABELS, CHANNEL_LABELS } from '#shared/domain/types'
export { ROLE_LABELS } from '#shared/permissions'

export function initials(name: string | null | undefined): string {
  return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('')
}

export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}
