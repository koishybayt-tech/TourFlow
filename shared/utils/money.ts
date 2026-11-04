const NBSP_THIN = ' '

/** 1290000 → "1 290 000 ₸" (regular spaces between thousands, as in the spec). */
export function formatMoney(value: number | null | undefined, opts: { currency?: string, sign?: boolean } = {}): string {
  const n = Math.round(Number(value) || 0)
  const abs = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  const sign = n < 0 ? '−' : opts.sign && n > 0 ? '+' : ''
  return `${sign}${abs}${NBSP_THIN}${opts.currency ?? '₸'}`
}

/** Parses "1 290 000 ₸" or "1290000" into an integer. */
export function parseMoney(input: string | number | null | undefined): number {
  if (typeof input === 'number') return Math.round(input)
  const digits = String(input ?? '').replace(/[^\d-]/g, '')
  return Number(digits) || 0
}
