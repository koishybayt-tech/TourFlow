import { describe, expect, it } from 'vitest'
import { isReceiptRecommended, type ReceiptContext } from '../../shared/domain/receipts'

const pkg: ReceiptContext = { pipeline: 'PACKAGE', hotelChosen: true, visa: false, hasChildren: false }
const visaGroup: ReceiptContext = { pipeline: 'GROUP', hotelChosen: false, visa: true, hasChildren: true }

describe('receipts', () => {
  it('passport receipt is for everyone', () => {
    expect(isReceiptRecommended('all', pkg)).toBe(true)
    expect(isReceiptRecommended('all', visaGroup)).toBe(true)
  })
  it('package-only receipts', () => {
    expect(isReceiptRecommended('pkg', pkg)).toBe(true)
    expect(isReceiptRecommended('pkg', visaGroup)).toBe(false)
  })
  it('hotel receipts need a chosen hotel', () => {
    expect(isReceiptRecommended('hotel', pkg)).toBe(true)
    expect(isReceiptRecommended('hotel', { ...pkg, hotelChosen: false })).toBe(false)
  })
  it('visa and kids', () => {
    expect(isReceiptRecommended('visa', visaGroup)).toBe(true)
    expect(isReceiptRecommended('kids', visaGroup)).toBe(true)
    expect(isReceiptRecommended('kids', pkg)).toBe(false)
  })
})
