/**
 * Client receipts: when a receipt template is recommended for a deal (docs/02_FEATURES.md §8).
 */

export type ReceiptCondition = 'all' | 'pkg' | 'hotel' | 'visa' | 'kids'

export const RECEIPT_CONDITION_LABELS: Record<ReceiptCondition, string> = {
  all: 'Все заявки',
  pkg: 'Пакетные туры',
  hotel: 'Выбран отель',
  visa: 'Визовые туры',
  kids: 'Есть дети',
}

export interface ReceiptContext {
  pipeline: 'GROUP' | 'PACKAGE' | 'BASE'
  /** A hotel is chosen: chosen offer in a package deal. */
  hotelChosen: boolean
  /** Visa tour: group deal on a departure with visa. */
  visa: boolean
  hasChildren: boolean
}

export function isReceiptRecommended(condition: ReceiptCondition | string | null | undefined, ctx: ReceiptContext): boolean {
  switch (condition) {
    case 'all':
    case null:
    case undefined:
      return true
    case 'pkg':
      return ctx.pipeline === 'PACKAGE'
    case 'hotel':
      return ctx.hotelChosen
    case 'visa':
      return ctx.visa
    case 'kids':
      return ctx.hasChildren
    default:
      return false
  }
}
