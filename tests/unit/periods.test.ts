import { describe, expect, it } from 'vitest'
import { periodRange } from '../../shared/domain/periods'

describe('report periods', () => {
  it('month, quarter, year, all', () => {
    const now = new Date(2026, 10, 5)
    expect(periodRange('month', now).from).toEqual(new Date(2026, 10, 1))
    expect(periodRange('quarter', now).from).toEqual(new Date(2026, 9, 1))
    expect(periodRange('year', now).from).toEqual(new Date(2026, 0, 1))
    expect(periodRange('all', now).from).toBeNull()
  })
})
