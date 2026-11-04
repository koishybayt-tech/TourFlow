/**
 * Room allocation for package tour search (docs/02_FEATURES.md §9.1).
 * Up to 3 adults and 4 people per room; children are placed with adults.
 */

export interface Room {
  adults: number
  children: number[]
}

export const MAX_ADULTS_PER_ROOM = 3
export const MAX_PEOPLE_PER_ROOM = 4

export function allocateRooms(adults: number, childAges: number[]): Room[] {
  if (adults < 1) throw new Error('Нужен хотя бы один взрослый')
  const total = adults + childAges.length
  // Minimal rooms satisfying both limits, but never more rooms than adults (each room needs an adult).
  const rooms = Math.max(Math.ceil(adults / MAX_ADULTS_PER_ROOM), Math.ceil(total / MAX_PEOPLE_PER_ROOM))
  if (rooms > adults) throw new Error('Слишком много детей: в каждом номере должен быть взрослый')

  const result: Room[] = Array.from({ length: rooms }, () => ({ adults: 0, children: [] }))
  // Spread adults evenly.
  for (let i = 0; i < adults; i++) result[i % rooms]!.adults++
  // Children go to the room with the most free places.
  for (const age of childAges) {
    const room = result
      .filter(r => r.adults + r.children.length < MAX_PEOPLE_PER_ROOM)
      .sort((a, b) => (a.adults + a.children.length) - (b.adults + b.children.length))[0]
    if (!room) throw new Error('Не удалось разместить детей')
    room.children.push(age)
  }
  return result
}

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}

/** «1 номер: 3 взр. + 1 реб. (7 лет)» */
export function describeRooms(rooms: Room[]): string {
  return rooms.map((r, i) => {
    const kids = r.children.length
      ? ` + ${r.children.length} реб. (${r.children.map(a => `${a} ${plural(a, 'год', 'года', 'лет')}`).join(', ')})`
      : ''
    const prefix = rooms.length === 1 ? '1 номер' : `Номер ${i + 1}`
    return `${prefix}: ${r.adults} взр.${kids}`
  }).join('; ')
}
