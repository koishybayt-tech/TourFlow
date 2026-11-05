/**
 * Package tour search across operators (docs/02_FEATURES.md §9.1).
 * Mock by default; Tourvisor adapter is enabled with TOUR_SEARCH_PROVIDER=real and TOURVISOR_TOKEN.
 * Search is asynchronous: start() returns an id, poll() returns accumulated results and progress.
 */
export interface SearchQuery {
  from: string
  country: string
  dateFrom: string
  dateTo: string
  nightsFrom: number
  nightsTo: number
  adults: number
  childAges: number[]
  meal?: string | null
  stars?: number | null
  operator?: string | null
  priceMax?: number | null
}

export interface OperatorOffer {
  operator: string
  date: string
  nights: number
  meal: string
  room: string
  price: number
  commissionPct: number
  flight: boolean
  transfer: boolean
  insurance: boolean
  deeplink: string | null
  externalRef: string
}

export interface HotelResult {
  hotel: string
  stars: number
  resort: string
  rating: number
  offers: OperatorOffer[]
}

export interface PollResult {
  status: 'running' | 'done'
  progress: number
  operatorsDone: string[]
  hotels: HotelResult[]
}

export interface TourSearchProvider {
  name: string
  start(q: SearchQuery): Promise<string>
  poll(id: string): Promise<PollResult>
}

// ── Mock ──────────────────────────────────────────────────────────
const HOTELS: Record<string, { hotel: string, stars: number, resort: string, rating: number, base: number }[]> = {
  Турция: [
    { hotel: 'Rixos Premium Belek', stars: 5, resort: 'Белек', rating: 4.8, base: 520_000 },
    { hotel: 'Delphin Imperial', stars: 5, resort: 'Лара', rating: 4.7, base: 430_000 },
    { hotel: 'Limak Lara', stars: 5, resort: 'Лара', rating: 4.6, base: 395_000 },
    { hotel: 'Crystal Sunset Luxury', stars: 5, resort: 'Сиде', rating: 4.5, base: 330_000 },
    { hotel: 'Club Marco Polo', stars: 4, resort: 'Кемер', rating: 4.2, base: 245_000 },
    { hotel: 'Akka Alinda', stars: 5, resort: 'Кемер', rating: 4.6, base: 360_000 },
  ],
  ОАЭ: [
    { hotel: 'Atlantis The Palm', stars: 5, resort: 'Пальма Джумейра', rating: 4.8, base: 780_000 },
    { hotel: 'Rixos The Palm', stars: 5, resort: 'Пальма Джумейра', rating: 4.6, base: 610_000 },
    { hotel: 'Hilton Dubai Jumeirah', stars: 5, resort: 'Джумейра', rating: 4.5, base: 520_000 },
    { hotel: 'Rove Downtown', stars: 3, resort: 'Даунтаун', rating: 4.3, base: 260_000 },
  ],
  Египет: [
    { hotel: 'Coral Beach Resort', stars: 5, resort: 'Шарм-эль-Шейх', rating: 4.5, base: 300_000 },
    { hotel: 'Rixos Sharm', stars: 5, resort: 'Шарм-эль-Шейх', rating: 4.7, base: 410_000 },
    { hotel: 'Reef Hotel', stars: 4, resort: 'Шарм-эль-Шейх', rating: 4.1, base: 230_000 },
    { hotel: 'Steigenberger Aqua Magic', stars: 5, resort: 'Хургада', rating: 4.6, base: 340_000 },
  ],
}
const OPS = [
  { name: 'Anex Tour', com: 10, k: 1.0, delay: 600 },
  { name: 'FUN&SUN', com: 11, k: 1.04, delay: 1300 },
  { name: 'Pegas Touristik', com: 9, k: 0.97, delay: 2000 },
  { name: 'Kompas', com: 10, k: 1.02, delay: 2700 },
]
const MEALS: Record<number, string[]> = { 5: ['Всё включено', 'Ультра всё включено'], 4: ['Всё включено', 'Полупансион'], 3: ['Завтраки'] }

function hash(s: string) {
  let h = 2166136261
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return Math.abs(h)
}

const searches = new Map<string, { q: SearchQuery, startedAt: number }>()

function mockOffers(q: SearchQuery, opName: string, k: number, com: number): HotelResult[] {
  const hotels = HOTELS[q.country] ?? HOTELS['Турция']!
  const pax = q.adults + q.childAges.length * 0.6
  const out: HotelResult[] = []
  for (const h of hotels) {
    if (q.stars && h.stars < q.stars) continue
    const offers: OperatorOffer[] = []
    for (let n = q.nightsFrom; n <= q.nightsTo; n += Math.max(1, Math.ceil((q.nightsTo - q.nightsFrom) / 2) || 1)) {
      const r = hash(`${h.hotel}${opName}${n}`)
      if (r % 5 === 0) continue
      const meal = MEALS[h.stars]![r % MEALS[h.stars]!.length]!
      if (q.meal && q.meal !== 'Любое' && meal !== q.meal) continue
      const dayShift = r % Math.max(1, (+new Date(q.dateTo) - +new Date(q.dateFrom)) / 86_400_000)
      const date = new Date(+new Date(`${q.dateFrom}T00:00:00Z`) + dayShift * 86_400_000).toISOString().slice(0, 10)
      const price = Math.round((h.base * (n / 7) * pax * k * (0.92 + (r % 17) / 100)) / 1000) * 1000
      if (q.priceMax && price > q.priceMax) continue
      offers.push({ operator: opName, date, nights: n, meal, room: h.stars >= 5 ? 'Deluxe Sea View' : 'Standard', price, commissionPct: com, flight: true, transfer: r % 7 !== 0, insurance: true, deeplink: `https://example-operator.kz/${encodeURIComponent(opName)}/${hash(h.hotel)}`, externalRef: `${opName}-${r % 100000}` })
    }
    if (offers.length) out.push({ hotel: h.hotel, stars: h.stars, resort: `${q.country}, ${h.resort}`, rating: h.rating, offers })
  }
  return out
}

const mock: TourSearchProvider = {
  name: 'mock',
  async start(q) {
    const id = crypto.randomUUID()
    searches.set(id, { q, startedAt: Date.now() })
    return id
  },
  async poll(id) {
    const s = searches.get(id)
    if (!s) throw createError({ statusCode: 404, statusMessage: 'Поиск устарел — запустите заново' })
    const elapsed = Date.now() - s.startedAt
    const ops = OPS.filter(o => !s.q.operator || s.q.operator === 'all' || o.name === s.q.operator)
    const done = ops.filter(o => o.delay <= elapsed)
    const byHotel = new Map<string, HotelResult>()
    for (const o of done) {
      for (const h of mockOffers(s.q, o.name, o.k, o.com)) {
        const cur = byHotel.get(h.hotel)
        if (cur) cur.offers.push(...h.offers)
        else byHotel.set(h.hotel, h)
      }
    }
    const hotels = [...byHotel.values()].map(h => ({ ...h, offers: h.offers.sort((a, b) => a.price - b.price) })).sort((a, b) => a.offers[0]!.price - b.offers[0]!.price)
    return { status: done.length === ops.length ? 'done' : 'running', progress: Math.round((done.length / ops.length) * 100), operatorsDone: done.map(o => o.name), hotels }
  },
}

// ── Tourvisor (structure only; enabled with a real token) ─────────
// Docs: Tourvisor XML/JSON API for agencies — search.php (start) → result.php (poll) with requestid.
const tourvisor: TourSearchProvider = {
  name: 'tourvisor',
  async start(q) {
    const token = process.env.TOURVISOR_TOKEN
    if (!token) throw createError({ statusCode: 503, statusMessage: 'Tourvisor не подключён: укажите TOURVISOR_TOKEN' })
    const res = await $fetch<{ result?: { requestid?: string } }>('https://tourvisor.ru/xml/search.php', {
      query: { authlogin: '', authpass: '', format: 'json', departure: q.from, country: q.country, datefrom: q.dateFrom, dateto: q.dateTo, nightsfrom: q.nightsFrom, nightsto: q.nightsTo, adults: q.adults, child: q.childAges.length, childage1: q.childAges[0], childage2: q.childAges[1], childage3: q.childAges[2], stars: q.stars ?? undefined, pricemax: q.priceMax ?? undefined },
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.result?.requestid) throw createError({ statusCode: 502, statusMessage: 'Tourvisor не принял запрос' })
    return res.result.requestid
  },
  async poll() {
    throw createError({ statusCode: 501, statusMessage: 'Разбор ответа Tourvisor подключается вместе с реальным токеном' })
  },
}

export function tourSearch(): TourSearchProvider {
  return process.env.TOUR_SEARCH_PROVIDER === 'real' ? tourvisor : mock
}
