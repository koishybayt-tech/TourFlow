/**
 * Tour constructor finance (docs/02_FEATURES.md §11.1). All results in KZT, rounded to whole tenge.
 *
 * variable = (Σ flights: ticket+baggage + Σ per-tourist costs) × (1 + Σ%)
 * fixed    = (Σ stays + Σ per-group costs) × (1 + Σ%)
 * cost(n)  = variable·n + fixed;  costPer = cost/n
 * breakEven = ceil(fixed / (price − variable)) when price > variable
 * suggestPrice = round(costPer(seats) × 1.25, 10 000) — only when all flight and stay prices are filled
 */

export type CurrencyCode = 'KZT' | 'EUR' | 'USD' | 'CHF'
export type Rates = Partial<Record<Exclude<CurrencyCode, 'KZT'>, number>>

export interface CalcFlight { ticket: number | null, baggage: number | null, currency: CurrencyCode }
export interface CalcStay { total: number | null, currency: CurrencyCode }
export interface CalcCost { plan: number | null, fact: number | null, unit: CurrencyCode | 'PERCENT', per: 'tourist' | 'group' }

export interface CalcTour {
  seats: number
  price: number
  rates: Rates
  flights: CalcFlight[]
  stays: CalcStay[]
  costs: CalcCost[]
}

export interface TourCalcResult {
  n: number
  flights: number
  stays: number
  touristCosts: number
  groupCosts: number
  percent: number
  variable: number
  fixed: number
  cost: number
  costPer: number
  revenue: number
  profit: number
  profitPer: number
  /** Whole percent. */
  margin: number
  breakEven: number | null
  suggestPrice: number | null
}

export function toKzt(amount: number | null | undefined, currency: CurrencyCode, rates: Rates): number {
  const a = Number(amount) || 0
  if (currency === 'KZT') return a
  return a * (Number(rates[currency]) || 0)
}

export function pricesComplete(t: Pick<CalcTour, 'flights' | 'stays'>): boolean {
  return t.flights.every(f => Number(f.ticket) > 0) && t.stays.every(s => Number(s.total) > 0)
}

export function calcTour(t: CalcTour, n?: number, mode: 'plan' | 'fact' = 'plan'): TourCalcResult {
  const count = Math.max(1, Math.round(n ?? t.seats ?? 1))
  const val = (c: CalcCost) => (mode === 'fact' && c.fact !== null && c.fact !== undefined ? c.fact : c.plan) ?? 0

  const flights = t.flights.reduce((s, f) => s + toKzt(f.ticket, f.currency, t.rates) + toKzt(f.baggage, f.currency, t.rates), 0)
  const stays = t.stays.reduce((s, x) => s + toKzt(x.total, x.currency, t.rates), 0)
  const touristCosts = t.costs.filter(c => c.per === 'tourist' && c.unit !== 'PERCENT').reduce((s, c) => s + toKzt(val(c), c.unit as CurrencyCode, t.rates), 0)
  const groupCosts = t.costs.filter(c => c.per === 'group' && c.unit !== 'PERCENT').reduce((s, c) => s + toKzt(val(c), c.unit as CurrencyCode, t.rates), 0)
  const percent = t.costs.filter(c => c.unit === 'PERCENT').reduce((s, c) => s + (Number(val(c)) || 0), 0) / 100

  const variable = Math.round((flights + touristCosts) * (1 + percent))
  const fixed = Math.round((stays + groupCosts) * (1 + percent))
  const cost = variable * count + fixed
  const costPer = Math.round(cost / count)
  const price = Number(t.price) || 0
  const revenue = price * count
  const profit = revenue - cost

  const seatsCost = variable * Math.max(1, t.seats) + fixed
  const seatsCostPer = seatsCost / Math.max(1, t.seats)

  return {
    n: count,
    flights: Math.round(flights),
    stays: Math.round(stays),
    touristCosts: Math.round(touristCosts),
    groupCosts: Math.round(groupCosts),
    percent,
    variable,
    fixed,
    cost,
    costPer,
    revenue,
    profit,
    profitPer: price - costPer,
    margin: revenue ? Math.round((profit / revenue) * 100) : 0,
    breakEven: price > variable ? Math.ceil(fixed / (price - variable)) : null,
    suggestPrice: pricesComplete(t) ? Math.round((seatsCostPer * 1.25) / 10_000) * 10_000 : null,
  }
}

export interface Scenario {
  label: string
  n: number
  result: TourCalcResult
}

/** Scenarios at 40/60/80/100% of seats and at break-even. */
export function tourScenarios(t: CalcTour, mode: 'plan' | 'fact' = 'plan'): Scenario[] {
  const out: Scenario[] = [0.4, 0.6, 0.8, 1].map((p) => {
    const n = Math.max(1, Math.round(t.seats * p))
    return { label: `${Math.round(p * 100)}% мест`, n, result: calcTour(t, n, mode) }
  })
  const be = calcTour(t, t.seats, mode).breakEven
  if (be) out.push({ label: 'Безубыточность', n: be, result: calcTour(t, be, mode) })
  return out
}

/** Departure deadlines on publish: tickets −45 d, full payment −30 d, briefing −7 d. */
export function departureDeadlines(start: Date) {
  const shift = (days: number) => new Date(start.getTime() - days * 86_400_000)
  return { flightDeadline: shift(45), payDeadline: shift(30), briefingAt: shift(7) }
}

export interface PublishCheck {
  ok: boolean
  missing: string[]
}

export function canPublish(t: { name?: string | null, startDate?: Date | string | null, endDate?: Date | string | null, price?: number | null, days: { availabilityChecked: boolean }[] }): PublishCheck {
  const missing: string[] = []
  if (!t.name?.trim()) missing.push('название')
  if (!t.startDate || !t.endDate) missing.push('даты')
  if (!t.price || t.price <= 0) missing.push('цена')
  if (!t.days.length) missing.push('программа')
  else if (t.days.some(d => !d.availabilityChecked)) missing.push('доступность всех дней программы')
  return { ok: missing.length === 0, missing }
}
