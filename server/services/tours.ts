import type { Prisma } from '../generated/prisma/client'
import { calcTour, type CalcTour } from '#shared/domain/tourCalc'
import type { TourSave } from '#shared/schemas/tours'
import type { AuthContext } from '../utils/auth'

export const TOUR_INCLUDE = {
  days: { orderBy: { order: 'asc' } },
  flights: { orderBy: { order: 'asc' } },
  stays: { orderBy: { order: 'asc' } },
  costs: { orderBy: { order: 'asc' } },
  departure: { include: { _count: { select: { participants: true } } } },
} satisfies Prisma.TourInclude

type TourFull = Prisma.TourGetPayload<{ include: typeof TOUR_INCLUDE }>

const n = (d: Prisma.Decimal | null | undefined) => (d === null || d === undefined ? null : Number(d))
const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null)

/** JSON shape used by the editor (decimals → numbers, dates → YYYY-MM-DD). */
export function tourDto(t: TourFull) {
  return {
    id: t.id, slug: t.slug, name: t.name, flags: t.flags, countries: t.countries, route: t.route,
    startDate: iso(t.startDate), endDate: iso(t.endDate), seats: t.seats, price: t.price, prepay: t.prepay,
    riseDate: iso(t.riseDate), riseAmount: t.riseAmount, payRule: t.payRule, description: t.description, coverKey: t.coverKey,
    status: t.status, included: t.included, extra: t.extra, rates: t.rates as { EUR: number, USD: number, CHF: number },
    ratesFixedAt: iso(t.ratesFixedAt), pricesCheckedAt: iso(t.pricesCheckedAt), posts: t.posts as { kind: string, url: string }[], instagramText: t.instagramText,
    updatedAt: t.updatedAt,
    days: t.days.map(d => ({ city: d.city, items: d.items, description: d.description, transfer: d.transfer, mediaKeys: d.mediaKeys, availabilityChecked: d.availabilityChecked })),
    flights: t.flights.map(f => ({ from: f.from, to: f.to, departAt: f.departAt?.toISOString().slice(0, 16) ?? null, airline: f.airline, ticket: n(f.ticket), baggage: n(f.baggage), currency: f.currency, link: f.link })),
    stays: t.stays.map(s => ({ city: s.city, name: s.name, checkIn: iso(s.checkIn), checkOut: iso(s.checkOut), rooms: s.rooms, guests: s.guests, total: n(s.total), currency: s.currency, link: s.link, note: s.note })),
    costs: t.costs.map(c => ({ category: c.category, plan: n(c.plan), fact: n(c.fact), unit: c.unit as 'KZT' | 'EUR' | 'USD' | 'CHF' | 'PERCENT', per: c.per as 'tourist' | 'group' })),
    departure: t.departure ? { id: t.departure.id, sold: t.departure._count.participants, minSeats: t.departure.minSeats } : null,
  }
}
export type TourDto = ReturnType<typeof tourDto>

export function calcInput(t: Pick<TourDto, 'seats' | 'price' | 'rates' | 'flights' | 'stays' | 'costs'>): CalcTour {
  return {
    seats: t.seats, price: t.price, rates: t.rates,
    flights: t.flights.map(f => ({ ticket: f.ticket ?? null, baggage: f.baggage ?? null, currency: f.currency })),
    stays: t.stays.map(s => ({ total: s.total ?? null, currency: s.currency })),
    costs: t.costs.map(c => ({ plan: c.plan ?? null, fact: c.fact ?? null, unit: c.unit, per: c.per })),
  }
}

export function tourCalc(t: TourDto) {
  return calcTour(calcInput(t))
}

const d = (s: string | null | undefined) => (s ? new Date(`${s.slice(0, 10)}T00:00:00Z`) : null)

/** Replaces the tour and its nested lists (autosave sends the whole editor state). */
export async function saveTour(ctx: AuthContext, id: string, t: TourSave) {
  await prisma.$transaction(async (tx) => {
    await tx.tour.update({
      where: { id },
      data: {
        name: t.name, flags: t.flags ?? null, countries: t.countries, route: t.route, startDate: d(t.startDate), endDate: d(t.endDate),
        seats: t.seats, price: t.price, prepay: t.prepay, riseDate: d(t.riseDate), riseAmount: t.riseAmount ?? null, payRule: t.payRule ?? null,
        description: t.description, coverKey: t.coverKey ?? null, included: t.included, extra: t.extra, rates: t.rates,
        ratesFixedAt: d(t.ratesFixedAt), pricesCheckedAt: d(t.pricesCheckedAt), posts: t.posts, instagramText: t.instagramText ?? null,
      },
    })
    await tx.tourDay.deleteMany({ where: { tourId: id } })
    await tx.tourFlight.deleteMany({ where: { tourId: id } })
    await tx.tourStay.deleteMany({ where: { tourId: id } })
    await tx.tourCost.deleteMany({ where: { tourId: id } })
    if (t.days.length) await tx.tourDay.createMany({ data: t.days.map((x, i) => ({ tourId: id, order: i, city: x.city, items: x.items, description: x.description, transfer: x.transfer ?? null, mediaKeys: x.mediaKeys, availabilityChecked: x.availabilityChecked })) })
    if (t.flights.length) await tx.tourFlight.createMany({ data: t.flights.map((x, i) => ({ tourId: id, order: i, from: x.from, to: x.to, departAt: x.departAt ? new Date(`${x.departAt}:00+05:00`) : null, airline: x.airline ?? null, ticket: x.ticket ?? null, baggage: x.baggage ?? null, currency: x.currency, link: x.link ?? null })) })
    if (t.stays.length) await tx.tourStay.createMany({ data: t.stays.map((x, i) => ({ tourId: id, order: i, city: x.city, name: x.name, checkIn: d(x.checkIn), checkOut: d(x.checkOut), rooms: x.rooms, guests: x.guests, total: x.total ?? null, currency: x.currency, link: x.link ?? null, note: x.note ?? null })) })
    if (t.costs.length) await tx.tourCost.createMany({ data: t.costs.map((x, i) => ({ tourId: id, order: i, category: x.category, plan: x.plan ?? null, fact: x.fact ?? null, unit: x.unit, per: x.per })) })
  })
  void ctx
}

const TRANSLIT: Record<string, string> = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ы: 'y', э: 'e', ю: 'yu', я: 'ya', ә: 'a', ғ: 'g', қ: 'k', ң: 'n', ө: 'o', ұ: 'u', ү: 'u', һ: 'h', і: 'i' }
export function slugify(s: string): string {
  return s.toLowerCase().split('').map(c => TRANSLIT[c] ?? c).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'tour'
}

export async function uniqueSlug(db: AuthContext['db'], base: string, exceptId?: string) {
  let slug = slugify(base)
  for (let i = 2; await db.tour.findFirst({ where: { slug, ...(exceptId ? { id: { not: exceptId } } : {}) } }); i++) slug = `${slugify(base)}-${i}`
  return slug
}

/** Instagram post text from the tour (editable afterwards). */
export function instagramText(t: TourDto): string {
  const dates = t.startDate && t.endDate ? `${t.startDate.split('-').reverse().slice(0, 2).join('.')}–${t.endDate.split('-').reverse().slice(0, 2).join('.')}` : 'даты уточняются'
  const days = t.days.map((x, i) => `День ${i + 1} · ${x.city}: ${x.items.slice(0, 3).join(', ')}`).join('\n')
  const price = t.price ? `${String(t.price).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₸` : 'по запросу'
  return `${t.flags ?? ''} ${t.name}\n${t.route}\n📅 ${dates} · ${t.seats} мест\n\n${t.description}\n\n${days}\n\n✅ Включено: ${t.included.join(', ')}\n➕ Дополнительно: ${t.extra.join(', ')}\n\n💰 ${price}, предоплата ${String(t.prepay).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₸\nЗапись — по ссылке в шапке профиля 👆`.trim()
}
