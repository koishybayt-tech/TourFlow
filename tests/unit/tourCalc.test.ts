import { describe, expect, it } from 'vitest'
import { calcTour, canPublish, departureDeadlines, tourScenarios, type CalcTour } from '../../shared/domain/tourCalc'

// GRAND TOUR from the prototype (reference/prototype_source.dc.html, atours[0]).
const grandTour: CalcTour = {
  seats: 15,
  price: 1_290_000,
  rates: { EUR: 545, USD: 505, CHF: 585 },
  flights: [
    { ticket: 260, baggage: 0, currency: 'EUR' },
    { ticket: 60, baggage: 25, currency: 'EUR' },
    { ticket: 70, baggage: 25, currency: 'EUR' },
    { ticket: 80, baggage: 30, currency: 'EUR' },
    { ticket: 260, baggage: 0, currency: 'EUR' },
  ],
  stays: [
    { total: 1920, currency: 'EUR' },
    { total: 2240, currency: 'EUR' },
    { total: 2400, currency: 'EUR' },
    { total: 1440, currency: 'CHF' },
    { total: 1920, currency: 'EUR' },
  ],
  costs: [
    { plan: 600_000, fact: null, unit: 'KZT', per: 'group' },
    { plan: 300_000, fact: null, unit: 'KZT', per: 'group' },
    { plan: 800, fact: null, unit: 'EUR', per: 'group' },
    { plan: 90, fact: null, unit: 'EUR', per: 'tourist' },
    { plan: 100_000, fact: null, unit: 'KZT', per: 'group' },
    { plan: 5, fact: null, unit: 'PERCENT', per: 'group' },
  ],
}

describe('tourCalc', () => {
  it('GRAND TOUR: ~998 thousand ₸ per tourist and break-even at 10', () => {
    const r = calcTour(grandTour)
    expect(r.variable).toBe(515_025)
    expect(r.fixed).toBe(7_245_000)
    expect(r.costPer).toBe(998_025)
    expect(r.breakEven).toBe(10)
    expect(r.profit).toBe(1_290_000 * 15 - r.cost)
    expect(r.suggestPrice).toBe(1_250_000)
  })

  it('does not suggest a price when flight or stay prices are missing', () => {
    const t = { ...grandTour, flights: [...grandTour.flights, { ticket: 0, baggage: 0, currency: 'EUR' as const }] }
    expect(calcTour(t).suggestPrice).toBeNull()
  })

  it('break-even is null when price does not cover variable cost', () => {
    expect(calcTour({ ...grandTour, price: 500_000 }).breakEven).toBeNull()
  })

  it('fact mode uses fact values where present', () => {
    const t = { ...grandTour, costs: grandTour.costs.map((c, i) => (i === 0 ? { ...c, fact: 700_000 } : c)) }
    expect(calcTour(t, 15, 'fact').fixed - calcTour(t, 15, 'plan').fixed).toBe(Math.round(100_000 * 1.05))
  })

  it('builds 40/60/80/100% and break-even scenarios', () => {
    const s = tourScenarios(grandTour)
    expect(s.map(x => x.n)).toEqual([6, 9, 12, 15, 10])
    expect(s[4]!.result.profit).toBeGreaterThanOrEqual(0)
    expect(s[0]!.result.profit).toBeLessThan(0)
  })

  it('publish requires name, dates, price and checked days', () => {
    const base = { name: 'Тур', startDate: '2027-01-01', endDate: '2027-01-05', price: 1, days: [{ availabilityChecked: true }] }
    expect(canPublish(base).ok).toBe(true)
    expect(canPublish({ ...base, days: [{ availabilityChecked: false }] }).missing).toContain('доступность всех дней программы')
    expect(canPublish({ ...base, price: 0, name: '' }).missing).toEqual(['название', 'цена'])
  })

  it('departure deadlines: −45 / −30 / −7 days', () => {
    const d = departureDeadlines(new Date('2027-07-28T00:00:00Z'))
    expect(d.flightDeadline.toISOString().slice(0, 10)).toBe('2027-06-13')
    expect(d.payDeadline.toISOString().slice(0, 10)).toBe('2027-06-28')
    expect(d.briefingAt.toISOString().slice(0, 10)).toBe('2027-07-21')
  })
})
