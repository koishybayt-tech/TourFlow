/** Report periods. */
export type Period = 'month' | 'quarter' | 'year' | 'all'

export function periodRange(period: Period, now = new Date()): { from: Date | null, to: Date, label: string } {
  const y = now.getFullYear()
  const m = now.getMonth()
  if (period === 'month') return { from: new Date(y, m, 1), to: now, label: new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(now) }
  if (period === 'quarter') return { from: new Date(y, Math.floor(m / 3) * 3, 1), to: now, label: `${Math.floor(m / 3) + 1} квартал ${y}` }
  if (period === 'year') return { from: new Date(y, 0, 1), to: now, label: `${y} год` }
  return { from: null, to: now, label: 'всё время' }
}
