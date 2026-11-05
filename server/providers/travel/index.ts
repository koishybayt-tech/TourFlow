/**
 * Flights and hotels search across several sources (docs/02_FEATURES.md §15).
 * The list of real sources comes from the expert; until then — mock sources with stable pseudo-random prices.
 */
export interface FlightQuery { from: string, to: string, depart: string, ret?: string | null, pax: number, cabin: 'Эконом' | 'Бизнес' }
export interface HotelQuery { city: string, checkIn: string, checkOut: string, guests: number }
export interface FlightResult { source: string, airline: string, flightNo: string, depart: string, arrive: string, stops: number, price: number, link: string }
export interface HotelResultRow { source: string, hotel: string, stars: number, rating: number, nights: number, price: number, link: string }

const SOURCES = ['Aviata', 'Chocotravel', 'Kayak', 'Booking.com', 'Ostrovok']
const AIRLINES = [['Air Astana', 'KC'], ['FlyArystan', 'FS'], ['Turkish Airlines', 'TK'], ['Pegasus', 'PC'], ['flydubai', 'FZ']]

function h(s: string) {
  let x = 2166136261
  for (const c of s) x = Math.imul(x ^ c.charCodeAt(0), 16777619)
  return Math.abs(x)
}

export function searchFlights(q: FlightQuery): FlightResult[] {
  const out: FlightResult[] = []
  for (const src of SOURCES.slice(0, 3)) {
    for (const [name, code] of AIRLINES) {
      const r = h(`${src}${name}${q.from}${q.to}${q.depart}`)
      if (r % 4 === 0) continue
      const hour = 6 + (r % 16)
      const dur = 3 + (r % 5)
      const base = (q.cabin === 'Бизнес' ? 3.2 : 1) * (95_000 + (r % 140_000)) * (q.ret ? 1.8 : 1)
      out.push({ source: src, airline: name!, flightNo: `${code} ${100 + (r % 800)}`, depart: `${q.depart}T${String(hour).padStart(2, '0')}:${r % 2 ? '30' : '05'}`, arrive: `${q.depart}T${String((hour + dur) % 24).padStart(2, '0')}:${r % 3 ? '45' : '20'}`, stops: r % 3 === 0 ? 1 : 0, price: Math.round((base * q.pax) / 100) * 100, link: `https://example-${src.toLowerCase()}.kz/flight/${r}` })
    }
  }
  return out.sort((a, b) => a.price - b.price)
}

export function searchHotels(q: HotelQuery): HotelResultRow[] {
  const nights = Math.max(1, Math.round((+new Date(q.checkOut) - +new Date(q.checkIn)) / 86_400_000))
  const names = ['Grand Palace', 'City Center Inn', 'Riverside Suites', 'Old Town Boutique', 'Airport Comfort', 'Harbour View']
  const out: HotelResultRow[] = []
  for (const src of SOURCES.slice(3)) {
    for (const n of names) {
      const r = h(`${src}${n}${q.city}${q.checkIn}`)
      if (r % 5 === 0) continue
      const stars = 3 + (r % 3)
      out.push({ source: src, hotel: `${n} ${q.city}`, stars, rating: Math.round((7 + (r % 30) / 10) * 10) / 10, nights, price: Math.round((stars * 9_000 + (r % 25_000)) * nights * Math.max(1, q.guests / 2) / 100) * 100, link: `https://example-${src.toLowerCase().replace(/\W/g, '')}.com/hotel/${r}` })
    }
  }
  return out.sort((a, b) => a.price - b.price)
}

/** Cheapest current price for a watch (the mock drifts slowly over days). */
export function currentPrice(kind: 'flight' | 'hotel', query: Record<string, unknown>): number {
  const day = Math.floor(Date.now() / 86_400_000)
  const list = kind === 'flight' ? searchFlights(query as unknown as FlightQuery) : searchHotels(query as unknown as HotelQuery)
  const min = list[0]?.price ?? 0
  const drift = 1 + ((h(`${JSON.stringify(query)}${day}`) % 21) - 10) / 100
  return Math.round((min * drift) / 100) * 100
}
