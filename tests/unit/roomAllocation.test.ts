import { describe, expect, it } from 'vitest'
import { allocateRooms, describeRooms } from '../../shared/domain/roomAllocation'

describe('roomAllocation', () => {
  it('3 adults + 1 child fit one room', () => {
    const r = allocateRooms(3, [7])
    expect(r).toEqual([{ adults: 3, children: [7] }])
    expect(describeRooms(r)).toBe('1 номер: 3 взр. + 1 реб. (7 лет)')
  })

  it('2 adults + 3 children need two rooms', () => {
    const r = allocateRooms(2, [3, 6, 10])
    expect(r).toHaveLength(2)
    expect(r.every(x => x.adults >= 1 && x.adults + x.children.length <= 4)).toBe(true)
  })

  it('4 adults need two rooms (max 3 adults)', () => {
    expect(allocateRooms(4, []).map(x => x.adults)).toEqual([2, 2])
  })

  it('1 adult with 4 children is impossible', () => {
    expect(() => allocateRooms(1, [1, 2, 3, 4])).toThrow()
  })

  it('plural forms of age', () => {
    expect(describeRooms(allocateRooms(2, [1, 3]))).toBe('1 номер: 2 взр. + 2 реб. (1 год, 3 года)')
  })
})
