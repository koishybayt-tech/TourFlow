import { describe, expect, it } from 'vitest'
import { formatMoney, parseMoney } from '../../shared/utils/money'
import { formatPhone, normalizePhone } from '../../shared/utils/phone'

describe('phone', () => {
  it('normalizes to +7 and 10 digits', () => {
    expect(normalizePhone('+7 701 234 56 78')).toBe('+77012345678')
    expect(normalizePhone('87012345678')).toBe('+77012345678')
    expect(normalizePhone('7012345678')).toBe('+77012345678')
    expect(normalizePhone('12345')).toBeNull()
  })
  it('formats', () => {
    expect(formatPhone('87012345678')).toBe('+7 701 234 56 78')
  })
})

describe('money', () => {
  it('formats with spaces and ₸', () => {
    expect(formatMoney(1_290_000)).toBe('1 290 000 ₸')
    expect(formatMoney(-50_000)).toBe('−50 000 ₸')
  })
  it('parses', () => {
    expect(parseMoney('1 290 000 ₸')).toBe(1_290_000)
  })
})
