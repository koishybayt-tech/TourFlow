import { describe, expect, it } from 'vitest'
import { parseOfferText } from '../../shared/domain/offerImport'

describe('offer text import', () => {
  it('parses a typical operator offer', () => {
    const text = `FUN&SUN
Coral Beach Resort 5*
Египет, Шарм-эль-Шейх
02.11.2026 – 09.11.2026, 7 ночей
Sea View, All Inclusive
Перелёт, трансфер, страховка
Итого: 980 000 ₸`
    const r = parseOfferText(text, new Date('2026-10-22'))
    expect(r).toMatchObject({ operator: 'FUN&SUN', hotel: 'Coral Beach Resort', stars: 5, resort: 'Египет, Шарм-эль-Шейх', fromDate: '2026-11-02', toDate: '2026-11-09', nights: 7, meal: 'Всё включено', price: 980000, flight: true, transfer: true, insurance: true })
  })
  it('derives end date from nights', () => {
    const r = parseOfferText('Отель Rixos Premium 5* 15.01 на 7 ночей, завтраки, 1 250 000 тг', new Date('2026-10-22'))
    expect(r.fromDate).toBe('2026-01-15')
    expect(r.toDate).toBe('2026-01-22')
    expect(r.meal).toBe('Завтраки')
  })
})
