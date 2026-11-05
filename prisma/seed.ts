/**
 * Demo data from the prototype (reference/prototype_source.dc.html, class Component).
 * The prototype's "today" is 22.10.2026; all operational dates are shifted so that
 * this day becomes the day the seed runs. Constructor tours (2027) are not shifted.
 *
 * WARNING: the seed wipes ALL data in the database. Never run it in production.
 */
import 'dotenv/config'
import { createPrismaClient } from '../server/utils/prisma'
import { encryptPii } from '../server/utils/crypto'
import { hashUserPassword } from '../server/utils/password'
import { putFile, simplePdf } from '../server/utils/storage'
import { normalizePhone } from '../shared/utils/phone'
import { almatyDate, formatRange, startOfAlmatyDay } from '../shared/utils/dates'
import { META, PIPE, createOrgDefaults } from '../server/domain/defaults'
import type { Channel } from '../server/generated/prisma/client'

const db = createPrismaClient()

// ───────── time helpers ─────────
const ORIGIN = almatyDate(2026, 9, 22)
const SHIFT = Math.round((startOfAlmatyDay().getTime() - ORIGIN.getTime()) / 86_400_000)

/** Shifted Almaty moment: at(14, 10, '16:02') → 14.10.2026 16:02 + SHIFT days. */
function at(d: number, m: number, time = '12:00', y = 2026): Date {
  const [hh, mm] = time.split(':').map(Number)
  return almatyDate(y, m - 1, d + SHIFT, hh, mm)
}
/** Shifted calendar date for @db.Date columns. */
function day(d: number, m: number, y = 2026): Date {
  return new Date(Date.UTC(y, m - 1, d + SHIFT))
}
/** Unshifted calendar date. */
function fixed(s: string): Date {
  return new Date(`${s}T00:00:00Z`)
}
/** '08.10 16:02' → Date */
function stamp(s: string): Date {
  const [dm, time] = s.split(' ')
  const [d, m] = dm!.split('.').map(Number)
  return at(d!, m!, time || '12:00')
}
function dueFrom(label: string): Date {
  if (label === 'Сегодня') return at(22, 10, '18:00')
  if (label === 'Завтра') return at(23, 10, '18:00')
  if (label === 'Вчера') return at(21, 10, '18:00')
  const m = label.match(/(\d{2})\.(\d{2})/)
  return m ? at(Number(m[1]), Number(m[2]), '18:00') : at(22, 10, '18:00')
}

const TRANSLIT: Record<string, string> = {
  а: 'A', ә: 'A', б: 'B', в: 'V', г: 'G', ғ: 'G', д: 'D', е: 'E', ё: 'E', ж: 'ZH', з: 'Z', и: 'I', й: 'I', к: 'K', қ: 'K',
  л: 'L', м: 'M', н: 'N', ң: 'N', о: 'O', ө: 'O', п: 'P', р: 'R', с: 'S', т: 'T', у: 'U', ұ: 'U', ү: 'U', ф: 'F', х: 'KH',
  һ: 'H', ц: 'TS', ч: 'CH', ш: 'SH', щ: 'SHCH', ъ: '', ы: 'Y', і: 'I', ь: '', э: 'E', ю: 'IU', я: 'IA',
}
function latin(name: string): string {
  const parts = name.split(' ')
  const swapped = parts.length === 2 ? [parts[1], parts[0]] : parts
  return swapped.join(' ').toLowerCase().split('').map(c => TRANSLIT[c] ?? c.toUpperCase()).join('')
}

const CH: Record<string, Channel> = { WhatsApp: 'WHATSAPP', Instagram: 'INSTAGRAM', Сайт: 'SITE' }

// ───────── prototype data ─────────
interface DealSeed {
  id: string
  client: string
  phone: string
  src: string
  pipe: string
  stage: number
  title: string
  dep?: string
  people?: number
  price?: number
  manager?: string
  dates?: string
  budget?: string
  visa?: string
  won?: boolean
  lost?: string
  signedAt?: string
  cl?: { full: string, iin: string, birth: string, email: string, address: string }
  nl?: { t: string, who: string, text: string }[]
  checks?: Record<string, boolean>
  notes?: Record<string, string>
  cf?: Record<string, string>
  pays?: { date: string, type: string, amount: number, method: string, year?: number }[]
  travelers?: { name: string, pass: string, exp: string, visa: string, child?: number }[]
  docs?: { name: string, type: string, date: string }[]
  hist: { t: string, text: string, who?: string }[]
}

const DEALS: DealSeed[] = [
  { id: 'd1', signedAt: '12.10 10:40', cl: { full: 'Нурланова Айгерим Бериковна', iin: '900315400123', birth: '1990-03-15', email: 'aigerim.n@mail.kz', address: 'г. Алматы, мкр. Самал-2, д. 58, кв. 14' }, nl: [{ t: '10.10 12:20', who: 'Аягөз', text: 'Клиентка просит номер с двумя кроватями. Муж Данияр — паспорт обновить до подачи на визу.' }], client: 'Айгерим Нурланова', phone: '+7 701 234 56 78', src: 'WhatsApp', pipe: 'group', stage: 4, title: 'Будапешт — Вена', dep: 'p1', people: 2, price: 1380000, manager: 'Аягөз', budget: 'до 1 500 000 ₸', visa: 'Нет, оформляем',
    checks: { g0c: true, g2d: true }, notes: { g1c: 'Едут вдвоём с мужем, выбрали ноябрьский выезд' },
    pays: [{ date: '12.10', type: 'Предоплата', amount: 200000, method: 'Kaspi' }],
    travelers: [{ name: 'Айгерим Нурланова', pass: 'N12345678', exp: '03.2029', visa: 'запись не назначена' }, { name: 'Данияр Нурланов', pass: 'N87654321', exp: '04.2027', visa: 'запись не назначена' }],
    docs: [{ name: 'Паспорт — Айгерим Нурланова.pdf', type: 'Паспорт', date: '10.10' }, { name: 'Паспорт — Данияр Нурланов.pdf', type: 'Паспорт', date: '10.10' }],
    hist: [{ t: '08.10 16:02', text: 'Заявка создана из WhatsApp' }, { t: '08.10 16:15', text: 'Ответственный: Аягөз' }, { t: '10.10 12:30', text: 'Этап: Визовая проверка → Договор' }, { t: '12.10 11:05', text: 'Оплата 200 000 ₸ (Предоплата, Kaspi)' }, { t: '12.10 11:06', text: 'Этап: Договор → Предоплата' }] },
  { id: 'd2', client: 'Тимур Сагинтаев', phone: '+7 777 410 22 19', src: 'Instagram', pipe: 'group', stage: 1, title: 'Рим — Флоренция — Венеция', dep: 'p2', price: 890000, manager: 'Ерлан', visa: 'Шенген был в 2024', checks: { g0c: true },
    travelers: [{ name: 'Тимур Сагинтаев', pass: 'N12121212', exp: '02.2030', visa: '' }],
    hist: [{ t: '19.10 09:12', text: 'Заявка создана из Instagram' }] },
  { id: 'd3', signedAt: '04.10 17:20', cl: { full: 'Жумабекова Алия Сериковна', iin: '950722450218', birth: '1995-07-22', email: 'aliya.zh@gmail.com', address: 'г. Алматы, ул. Розыбакиева, 247, кв. 31' }, checks: { g5b: false }, client: 'Алия Жумабекова', phone: '+7 705 118 40 07', src: 'Instagram', pipe: 'group', stage: 5, title: 'Будапешт — Вена', dep: 'p1', price: 690000, manager: 'Аягөз', visa: 'Получена 20.10',
    pays: [{ date: '05.10', type: 'Предоплата', amount: 100000, method: 'Kaspi' }, { date: '18.10', type: 'Доплата', amount: 300000, method: 'Перевод на счёт' }],
    travelers: [{ name: 'Алия Жумабекова', pass: 'N55501234', exp: '11.2030', visa: 'получена, нужна проверка' }], hist: [{ t: '02.10 18:40', text: 'Заявка создана из Instagram' }] },
  { id: 'd4', client: 'Ерболат Касымов', phone: '+7 702 555 13 31', src: 'WhatsApp', pipe: 'group', stage: 6, title: 'Чарын — Кольсай — Каинды', dep: 'p3', people: 3, price: 360000, manager: 'Ерлан', visa: 'Не нужна',
    pays: [{ date: '15.10', type: 'Полная оплата', amount: 360000, method: 'Kaspi' }],
    travelers: [{ name: 'Ерболат Касымов', pass: '', exp: '', visa: 'не нужна' }, { name: 'Гаухар Касымова', pass: '', exp: '', visa: 'не нужна' }, { name: 'Айша Касымова', pass: '', exp: '', visa: 'не нужна', child: 9 }],
    hist: [{ t: '14.10 20:05', text: 'Заявка создана из WhatsApp' }] },
  { id: 'd5', client: 'Мадина Ахметова', phone: '+7 747 902 66 10', src: 'Instagram', pipe: 'group', stage: 0, title: 'Европа, весна 2027', people: 3, dates: 'Март–апрель', visa: 'Шенген был в 2025', manager: 'Аягөз', hist: [{ t: '22.10 13:41', text: 'Заявка создана из Instagram' }] },
  { id: 'd6', client: 'Санжар Оспанов', phone: '+7 708 300 45 92', src: 'Сайт', pipe: 'group', stage: 2, title: 'Стамбул — Каппадокия', dep: 'p4', people: 2, price: 1080000, manager: 'Аягөз', visa: 'Не нужна', checks: { g0c: true }, notes: { g1c: 'Медовый месяц, нужен номер с видом' }, budget: 'до 1 200 000 ₸',
    travelers: [{ name: 'Санжар Оспанов', pass: 'N78787878', exp: '03.2031', visa: 'не нужна' }, { name: 'Дина Оспанова', pass: 'N90909090', exp: '03.2031', visa: 'не нужна' }],
    hist: [{ t: '17.10 11:20', text: 'Заявка создана с формы на сайте' }] },
  { id: 'd7', client: 'Жанна Ким', phone: '+7 701 870 12 54', src: 'WhatsApp', pipe: 'group', stage: 3, title: 'Будапешт — Вена', dep: 'p1', price: 690000, manager: 'Аягөз', visa: 'Нет, оформляем', checks: { g0c: true, g2d: true }, notes: { g1c: 'Едет одна, нужна помощь с визой' }, budget: 'до 800 000 ₸',
    travelers: [{ name: 'Жанна Ким', pass: 'N33302211', exp: '06.2031', visa: 'запись не назначена' }],
    docs: [{ name: 'Паспорт — Жанна Ким.pdf', type: 'Паспорт', date: '17.10' }],
    hist: [{ t: '16.10 15:02', text: 'Заявка создана из WhatsApp' }] },
  { id: 'd8', client: 'Арман Ибраев', phone: '+7 775 641 08 33', src: 'Instagram', pipe: 'group', stage: 0, title: 'Италия, декабрь', people: 2, dates: 'Декабрь', manager: 'Ерлан', hist: [{ t: '22.10 10:17', text: 'Заявка создана из Instagram' }] },
  { id: 'd9', checks: { p2a: true }, budget: 'до 1 500 000 ₸', notes: { p1b: 'Отель 5*, завтраки или полупансион, прямой перелёт' }, client: 'Гульнара Сейткали', phone: '+7 701 442 90 18', src: 'Instagram', pipe: 'package', stage: 2, title: 'Дубай, 5*', people: 2, price: 1240000, manager: 'Аягөз', visa: 'Не нужна', hist: [{ t: '21.10 12:00', text: 'Заявка создана из Instagram' }] },
  { id: 'd10', budget: 'до 2 000 000 ₸', client: 'Нурсултан Абенов', phone: '+7 707 233 71 46', src: 'WhatsApp', pipe: 'package', stage: 1, title: 'Анталья, январь', people: 4, manager: 'Ерлан', dates: 'Январь', hist: [{ t: '20.10 19:33', text: 'Заявка создана из WhatsApp' }] },
  { id: 'd11', checks: { p2a: true }, notes: { p1b: 'Отель у моря, всё включено, без детской анимации', p2b: 'Выбрала вариант FUN&SUN, Шарм-эль-Шейх' }, cf: { p3a: 'FS-2611043' }, budget: 'до 1 000 000 ₸', client: 'Камила Есенова', phone: '+7 776 019 55 20', src: 'Сайт', pipe: 'package', stage: 3, title: 'Шарм-эль-Шейх, 7 ночей', people: 2, price: 980000, manager: 'Аягөз',
    travelers: [{ name: 'Камила Есенова', pass: 'N24682468', exp: '09.2030', visa: 'не нужна' }, { name: 'Азамат Есенов', pass: 'N13571357', exp: '01.2029', visa: 'не нужна' }],
    pays: [{ date: '19.10', type: 'Предоплата', amount: 300000, method: 'Карта' }], hist: [{ t: '18.10 14:10', text: 'Заявка создана с формы на сайте' }] },
  { id: 'd13', client: 'Айгерим Нурланова', phone: '+7 701 234 56 78', src: 'Instagram', pipe: 'group', stage: 7, won: true, title: 'Стамбул — Каппадокия (2025)', people: 2, price: 980000, manager: 'Аягөз', dates: '12–19 мая 2025', visa: 'Не нужна', signedAt: '05.04 12:10',
    pays: [{ date: '05.04', type: 'Предоплата', amount: 200000, method: 'Kaspi', year: 2025 }, { date: '20.04', type: 'Полная оплата', amount: 780000, method: 'Kaspi', year: 2025 }],
    docs: [{ name: 'Договор № ДТ-2025-041 — Айгерим Нурланова.pdf', type: 'Договор', date: '05.04' }],
    hist: [{ t: '02.04 10:15', text: 'Заявка создана из Instagram' }, { t: '22.05 09:00', text: 'Этап: Готов к выезду → Заявка успешно завершена' }] },
  { id: 'd14', client: 'Ерболат К.', phone: '+7 776 555 13 39', src: 'Instagram', pipe: 'base', stage: 0, title: 'Вопрос про Каинды', people: 1, hist: [{ t: '21.10 21:40', text: 'Заявка создана из Instagram' }] },
  { id: 'd15', client: 'Динара Ахметжанова', phone: '+7 701 660 21 87', src: 'Instagram', pipe: 'group', stage: 1, lost: 'Не устроила цена', title: 'Рим — Флоренция — Венеция', people: 2, price: 1780000, manager: 'Аягөз', hist: [{ t: '09.10 18:20', text: 'Заявка создана из Instagram' }, { t: '12.10 11:00', text: 'Закрыта с отказом: Не устроила цена', who: 'Аягөз' }] },
  { id: 'd16', client: 'Максим Ли', phone: '+7 707 118 52 63', src: 'WhatsApp', pipe: 'package', stage: 2, lost: 'Выбрал другое агентство', title: 'Пхукет, февраль', people: 2, price: 1150000, manager: 'Ерлан', dates: 'Февраль', hist: [{ t: '11.10 10:05', text: 'Заявка создана из WhatsApp' }, { t: '15.10 16:40', text: 'Закрыта с отказом: Выбрал другое агентство', who: 'Ерлан' }] },
  { id: 'd17', client: 'Бауржан Оспанов', phone: '+7 775 402 19 70', src: 'Сайт', pipe: 'group', stage: 0, lost: 'Не выходит на связь', title: 'Стамбул — Каппадокия', people: 1, manager: 'Аягөз', hist: [{ t: '13.10 09:30', text: 'Заявка создана с формы на сайте' }, { t: '20.10 12:00', text: 'Закрыта с отказом: Не выходит на связь', who: 'Аягөз' }] },
  { id: 'd12', client: 'Ольга Петрова', phone: '+7 701 300 77 41', src: 'WhatsApp', pipe: 'base', stage: 1, title: 'Консультация по шенгену', manager: 'Ерлан', checks: { b0a: true }, hist: [{ t: '21.10 16:45', text: 'Заявка создана из WhatsApp' }] },
]

const DEPARTURES = [
  { id: 'p1', name: 'Будапешт — Вена', route: 'Будапешт (3 дня) → Сентендре → Вена (3 дня)', start: day(14, 11), end: day(21, 11), type: 'Авторский', visa: true, min: 4, max: 15, guide: 'g1', price: 690000, flight: day(30, 10), pay: day(31, 10), brief: day(7, 11) },
  { id: 'p3', name: 'Чарын — Кольсай — Каинды', route: 'Алматы → Чарынский каньон → Кольсайские озёра → Каинды', start: day(1, 11), end: day(3, 11), type: 'Внутри РК', visa: false, min: 6, max: 15, guide: 'g3', price: 120000, flight: day(25, 10), pay: day(25, 10), brief: day(29, 10) },
  { id: 'p2', name: 'Рим — Флоренция — Венеция', route: 'Рим (3 дня) → Флоренция (2 дня) → Венеция (3 дня)', start: day(5, 12), end: day(13, 12), type: 'Авторский', visa: true, min: 4, max: 15, guide: 'g2', price: 890000, flight: day(18, 11), pay: day(20, 11), brief: day(28, 11) },
  { id: 'p4', name: 'Стамбул — Каппадокия', route: 'Стамбул (4 дня) → Каппадокия (3 дня)', start: day(16, 1, 2027), end: day(23, 1, 2027), type: 'Авторский', visa: false, min: 4, max: 15, guide: null, price: 540000, flight: day(20, 12), pay: day(20, 12), brief: day(9, 1, 2027) },
]

const PARTS = [
  { dep: 'p1', name: 'Айгерим Нурланова', st: 3, pass: 'N12345678 · до 03.2029', paid: 100000, deal: 'd1' },
  { dep: 'p1', name: 'Данияр Нурланов', st: 3, pass: 'N87654321 · до 04.2027', paid: 100000, deal: 'd1' },
  { dep: 'p1', name: 'Алия Жумабекова', st: 6, pass: 'N55501234 · до 11.2030', paid: 400000, deal: 'd3' },
  { dep: 'p1', name: 'Жанна Ким', st: 2, pass: 'N33302211 · до 06.2031', paid: 0, deal: 'd7' },
  { dep: 'p1', name: 'Ерке Садыкова', st: 7, pass: 'N10204060 · до 09.2028', paid: 690000, deal: null },
  { dep: 'p1', name: 'Руслан Ахмедов', st: 7, pass: 'N70809010 · до 01.2030', paid: 690000, deal: null },
  { dep: 'p1', name: 'Сабина Ли', st: 7, pass: 'N44556677 · до 12.2029', paid: 690000, deal: null },
  { dep: 'p1', name: 'Ринат Абилов', st: 5, pass: 'N66001122 · до 05.2032', paid: 200000, deal: null },
  { dep: 'p1', name: 'Лаура Есимова', st: 1, pass: 'N99887766 · до 08.2028', paid: 0, deal: null },
  { dep: 'p2', name: 'Тимур Сагинтаев', st: 1, pass: 'N12121212 · до 02.2030', paid: 0, deal: 'd2' },
  { dep: 'p2', name: 'Канат Омаров', st: 3, pass: 'N34343434 · до 07.2029', paid: 150000, deal: null },
  { dep: 'p2', name: 'Динара Сулейменова', st: 0, pass: 'N56565656 · до 10.2031', paid: 0, deal: null },
  { dep: 'p3', name: 'Ерболат Касымов', st: 4, pass: 'удостоверение', paid: 120000, deal: 'd4' },
  { dep: 'p3', name: 'Гаухар Касымова', st: 4, pass: 'удостоверение', paid: 120000, deal: 'd4' },
  { dep: 'p3', name: 'Айша Касымова', st: 3, pass: 'свидетельство о рождении', paid: 120000, deal: 'd4' },
  { dep: 'p4', name: 'Санжар Оспанов', st: 1, pass: 'N78787878 · до 03.2031', paid: 0, deal: 'd6' },
  { dep: 'p4', name: 'Дина Оспанова', st: 1, pass: 'N90909090 · до 03.2031', paid: 0, deal: 'd6' },
]

const GUIDES = [
  { id: 'g1', name: 'Асхат Ермеков', age: 34, sex: 'муж.', langs: ['Русский', 'Казахский', 'Английский', 'Венгерский'], years: 8, agencies: '3 агентства', rate: 450000, rating: '4.9', reviews: 27 },
  { id: 'g2', name: 'Динара Абдрахманова', age: 29, sex: 'жен.', langs: ['Русский', 'Казахский', 'Английский', 'Итальянский'], years: 5, agencies: '2 агентства', rate: 380000, rating: '4.8', reviews: 19 },
  { id: 'g3', name: 'Бауыржан Сейтжанов', age: 41, sex: 'муж.', langs: ['Русский', 'Казахский'], years: 12, agencies: '4 агентства', rate: 150000, rating: '4.7', reviews: 41 },
  { id: 'g4', name: 'Алина Пак', age: 26, sex: 'жен.', langs: ['Русский', 'Английский', 'Корейский'], years: 3, agencies: '1 агентство', rate: 250000, rating: '4.6', reviews: 8 },
  { id: 'g5', name: 'Марат Жаксылыков', age: 38, sex: 'муж.', langs: ['Русский', 'Казахский', 'Английский', 'Турецкий'], years: 10, agencies: '3 агентства', rate: 520000, rating: '4.9', reviews: 33 },
]

const CONVS = [
  { id: 'c7', name: 'Ержан Тулеуов', phone: '+7 705 220 41 18', src: 'WhatsApp', deal: null, unread: true, lead: { direction: 'Будапешт — Вена', dates: '14–21 ноября', people: '1', visa: 'Шенген был в 2025' }, msgs: [{ from: 'in', text: 'Здравствуйте! Хочу в тур Будапешт — Вена [GT-p1]', time: '14:25' }] },
  { id: 'c6', name: 'Сауле Нурпеисова', phone: '+7 701 905 33 47', src: 'Instagram', deal: null, unread: true, lead: { direction: 'Турция', dates: 'Январь', people: '3', visa: 'Не нужна' }, msgs: [{ from: 'in', text: 'Добрый день! Хотим в Турцию в январе, всё включено, отель 5 звёзд. Двое взрослых и ребёнок 6 лет.', time: '14:18' }] },
  { id: 'c9', name: 'Арсен Сеитов', phone: '+7 708 771 64 02', src: 'Instagram', deal: null, unread: true, lead: {}, msgs: [{ from: 'in', text: 'Здравствуйте, подскажите цены?', time: '13:55' }] },
  { id: 'c8', name: 'Елена Ким', phone: '+7 777 512 08 90', src: 'WhatsApp', deal: null, unread: false, lead: { people: '1' }, msgs: [{ from: 'in', text: 'Добрый день, а вы делаете только туры или можно просто купить страховку для поездки?', time: '12:02' }] },
  { id: 'c3', name: 'Нурлан Беков', phone: '+7 702 118 09 44', src: 'WhatsApp', deal: null, unread: true, lead: { direction: 'Будапешт — Вена', dates: 'Ноябрь', people: '2', visa: 'Нет' }, msgs: [{ from: 'in', text: 'Сәлеметсіз бе! Ноябрьдегі Будапешт турына орын бар ма? 2 адам боламыз.', time: '14:10' }, { from: 'out', auto: true, text: 'Здравствуйте! Это Demo Travel. Менеджер ответит в течение 15 минут. Программа тура: [ссылка на тур]', time: '14:10' }, { from: 'in', text: 'Виза жоқ, рахмет', time: '14:12' }] },
  { id: 'c2', name: 'Мадина Ахметова', phone: '+7 747 902 66 10', src: 'Instagram', deal: 'd5', unread: true, lead: { direction: 'Европа', dates: 'Март–апрель', people: '3', visa: 'Шенген был в 2025' }, msgs: [{ from: 'in', text: 'Здравствуйте! Видела ваш рилс про Будапешт. Есть что-то в Европу весной? Нас трое.', time: '13:40' }] },
  { id: 'c1', name: 'Айгерим Нурланова', phone: '+7 701 234 56 78', src: 'WhatsApp', deal: 'd1', unread: false, lead: { direction: 'Будапешт — Вена', dates: '14–21 ноября', people: '2', visa: 'Нет, оформляем' }, msgs: [{ from: 'in', text: 'Здравствуйте! Перевела предоплату за двоих, 200 000 ₸.', time: '10:58' }, { from: 'out', text: 'Спасибо, Айгерим! Оплату получили. Завтра запишем вас на подачу визы.', time: '11:05' }] },
  { id: 'c4', name: 'Тимур Сагинтаев', phone: '+7 777 410 22 19', src: 'Instagram', deal: 'd2', unread: false, lead: { direction: 'Италия', dates: '5–13 декабря', people: '1', visa: 'Шенген был в 2024' }, msgs: [{ from: 'in', text: 'Сколько стоит Италия в декабре и что входит?', time: '09:14' }, { from: 'out', text: 'Тимур, добрый день! 890 000 ₸: перелёт, отели 4*, гид, трансферы. Программу отправила выше.', time: '09:20' }] },
  { id: 'c5', name: 'Гульнара Сейткали', phone: '+7 701 442 90 18', src: 'Instagram', deal: 'd9', unread: false, lead: { direction: 'Дубай', dates: '20–25 ноября', people: '2', visa: 'Не нужна' }, msgs: [{ from: 'in', text: 'Добрый день! Хотим в Дубай 20–25 ноября, двое взрослых, отель 5 звёзд.', time: '12:00', yesterday: true }] },
]

const TASKS = [
  { text: 'Записать Айгерим и Данияра на подачу визы', deal: 'd1', dep: null, due: 'Сегодня', status: 'IN_PROGRESS', prio: 'HIGH', who: 'Аягөз', author: 'Ерлан', desc: 'Запись в визовый центр. Проверить справки с работы и выписки со счёта.', subs: [{ t: 'Собрать справки с работы', done: true }, { t: 'Выписки со счёта за 6 месяцев', done: false }, { t: 'Записать в визовый центр', done: false }], log: [{ t: '20.10 10:12', text: 'Задача создана · Ерлан' }, { t: '21.10 09:30', text: 'Статус: Новая → В работе · Аягөз' }], stage: true },
  { text: 'Проверить визу Алии: ФИО, даты, номер, паспорт', deal: 'd3', dep: null, due: 'Сегодня', status: 'TODO', prio: 'HIGH', who: 'Аягөз', author: null, desc: '', subs: [], log: [{ t: '20.10 18:02', text: 'Создана менеджером по регламенту этапа «Виза»' }], stage: true },
  { text: 'Чарын — Кольсай: готовы 2 из 6, решить по выезду', deal: null, dep: 'p3', due: 'До 25.10', status: 'IN_PROGRESS', prio: 'HIGH', who: 'Ерлан', author: null, desc: 'Варианты: добрать через партнёров, перенести или отменить с возвратом.', subs: [], log: [{ t: '19.10 09:00', text: 'Создана автоматически: риск недобора' }] },
  { text: 'Напомнить Жанне Ким подписать договор', deal: 'd7', dep: null, due: 'Вчера', status: 'DONE', prio: 'MEDIUM', who: 'Аягөз', author: 'Аягөз', desc: '', subs: [], log: [{ t: '21.10 16:20', text: 'Статус: В работе → Выполнена · Аягөз' }], result: 'Написала в WhatsApp, обещала подписать сегодня' },
  { text: 'Продлить договор аренды офиса', deal: null, dep: null, due: 'До 30.10', status: 'TODO', prio: 'LOW', who: 'Ерлан', author: 'Ерлан', desc: '', subs: [], log: [{ t: '15.10 11:00', text: 'Задача создана · Ерлан' }] },
  { text: 'Снять рилс про Будапешт для Instagram', deal: null, dep: 'p1', due: 'Завтра', status: 'IN_PROGRESS', prio: 'MEDIUM', who: 'Аягөз', author: 'Ерлан', desc: 'Короткий ролик 30–40 секунд: маршрут, отели, отзывы прошлой группы. Добавить ссылку на запись в шапку профиля.', subs: [{ t: 'Сценарий', done: true }, { t: 'Монтаж', done: false }], log: [{ t: '18.10 12:00', text: 'Задача создана · Ерлан' }] },
  { text: 'Сверить поступления Kaspi за неделю', deal: null, dep: null, due: 'Вчера', status: 'TODO', prio: 'MEDIUM', who: 'Ерлан', author: 'Ерлан', desc: '', subs: [], log: [{ t: '14.10 09:00', text: 'Повторяющаяся задача: каждый понедельник' }] },
]

const EVENTS = [
  { type: 'meeting', d: 22, m: 10, time: '16:00', title: 'Звонок: Тимур Сагинтаев — Италия', who: 'Ерлан', place: 'Телефон', remind: 'За 15 минут в Telegram', deal: 'd2', sub: 'Обсудить программу и предоплату' },
  { type: 'meeting', d: 23, m: 10, time: '15:00', title: 'Встреча с Мадиной Ахметовой', who: 'Аягөз', place: 'Офис агентства', remind: 'За 1 час в Telegram', deal: 'd5', sub: 'Подбор тура в Европу на весну, 3 человека' },
  { type: 'visa', d: 27, m: 10, time: '10:30', title: 'Подача на визу: Айгерим и Данияр Нурлановы', who: 'Аягөз', place: 'Визовый центр, Алматы', remind: 'Клиенту в WhatsApp за 1 день', deal: 'd1', sub: 'Паспорта, фото, справки с работы, выписки со счёта' },
  { type: 'visa', d: 24, m: 10, time: '12:00', title: 'Получение паспорта с визой: Алия Жумабекова', who: 'Аягөз', place: 'Визовый центр, Алматы', remind: 'Клиенту в WhatsApp за 1 день', deal: 'd3', sub: '' },
  { type: 'visa', d: 29, m: 10, time: '11:00', title: 'Подача на визу: Жанна Ким', who: 'Дана', place: 'Визовый центр, Алматы', remind: 'Клиенту в WhatsApp за 1 день', deal: 'd7', sub: '' },
  { type: 'meeting', d: 26, m: 10, time: '11:00', title: 'Планёрка: набор групп на ноябрь', who: 'Ерлан', place: 'Офис агентства', remind: 'За 15 минут в Telegram', deal: null, sub: 'Решение по выезду Чарын — Кольсай' },
]

async function wipe() {
  const tables = await db.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`
  if (tables.length) {
    await db.$executeRawUnsafe(`TRUNCATE ${tables.map(t => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`)
  }
}

async function upload(key: string, title: string) {
  try {
    await putFile(key, simplePdf(title), 'application/pdf')
  }
  catch (e) {
    console.warn(`  ! file storage unavailable, skipped ${key}: ${(e as Error).message}`)
  }
}

async function main() {
  console.log(`Seeding demo data (date shift: ${SHIFT} days)…`)
  await wipe()

  const pw = await hashUserPassword('demo1234')
  const org = await db.organization.create({
    data: {
      name: 'ТОО «Demo Travel»', bin: '230540012345', city: 'Алматы', director: 'Ерлан [Фамилия]', legalAddress: 'г. Алматы, пр. Абая, 150, офис 12',
      bank: 'АО «Kaspi Bank»', iik: 'KZ12722S000012345678', bik: 'CASPKZKA', license: '[№ лицензии турагента]', phone: '+7 727 300 10 20',
      email: 'info@demo.travel', instagram: '@demo.travel',
      refundRule: 'до покупки авиабилетов — возврат 100% предоплаты; после покупки — за вычетом фактически понесённых расходов',
      modules: { group: true, package: true, tickets: true, team: true, migration: false },
      routing: {},
      dealCounter: 17,
      contractCounter: 2,
    },
  })
  const orgId = org.id

  // Users and members
  const people = [
    { key: 'Ерлан', email: 'erlan@demo.travel', phone: '+77015552026', name: 'Ерлан', position: 'Директор', role: 'OWNER' as const, vacation: false, sign: true },
    { key: 'Аягөз', email: 'ayagoz@demo.travel', phone: '+77012223344', name: 'Аягөз', position: 'Менеджер', role: 'MANAGER' as const, vacation: false, sign: true },
    { key: 'Дана', email: 'dana@demo.travel', phone: '+77054103321', name: 'Дана', position: 'Визовый менеджер', role: 'MANAGER' as const, vacation: true, sign: false },
    { key: 'Колл-центр', email: 'callcenter@demo.travel', phone: null, name: 'Мария (колл-центр)', position: 'Оператор колл-центра', role: 'CALLCENTER' as const, vacation: false, sign: false },
  ]
  const M: Record<string, string> = {}
  for (const p of people) {
    const user = await db.user.create({ data: { email: p.email, phone: p.phone, passwordHash: pw, name: p.name, position: p.position } })
    const m = await db.member.create({ data: { organizationId: orgId, userId: user.id, role: p.role, onVacation: p.vacation, signRight: p.sign } })
    M[p.key] = m.id
  }
  await db.organization.update({ where: { id: orgId }, data: { defaultManagerId: M['Ерлан'] } })

  // Stages and templates
  const { reqIds: REQ, stageIds: STAGE, templateIds: TPL } = await createOrgDefaults(db, orgId)

  // Guides & departures
  const G: Record<string, string> = {}
  for (const g of GUIDES) {
    const r = await db.guide.create({ data: { organizationId: orgId, fullName: g.name, birthDate: new Date(Date.UTC(2026 - g.age, 5, 15)), sex: g.sex, languages: g.langs, experienceYears: g.years, agencies: g.agencies, rate: g.rate, rating: g.rating, reviewsCount: g.reviews } })
    G[g.id] = r.id
  }
  const DEP: Record<string, { id: string, start: Date, end: Date, visa: boolean }> = {}
  for (const d of DEPARTURES) {
    const r = await db.departure.create({ data: { organizationId: orgId, name: d.name, route: d.route, startDate: d.start, endDate: d.end, type: d.type, visa: d.visa, minSeats: d.min, maxSeats: d.max, price: d.price, guideId: d.guide ? G[d.guide] : null, flightDeadline: d.flight, payDeadline: d.pay, briefingAt: d.brief } })
    DEP[d.id] = { id: r.id, start: d.start, end: d.end, visa: d.visa }
  }

  // Directions & routing
  const dirs = [
    { name: 'Европа · групповые туры', kw: 'будапешт, вена, италия, рим, флоренц, венец, европ, шенген', mgrs: ['Аягөз'], backup: 'Ерлан', mode: 'single' },
    { name: 'Турция', kw: 'турци, анталь, кемер, сиде, белек, стамбул, каппадок', mgrs: ['Ерлан', 'Аягөз'], backup: 'Ерлан', mode: 'round' },
    { name: 'ОАЭ', kw: 'дубай, оаэ, абу-даби, шардж', mgrs: ['Аягөз'], backup: 'Ерлан', mode: 'single' },
    { name: 'Египет', kw: 'египет, шарм, хургад', mgrs: ['Аягөз'], backup: 'Ерлан', mode: 'single' },
    { name: 'Азия', kw: 'таиланд, пхукет, бали, вьетнам, нячанг, фукуок', mgrs: ['Ерлан'], backup: 'Аягөз', mode: 'single' },
    { name: 'Казахстан', kw: 'чарын, кольсай, каинды, бурабай, алаколь', mgrs: ['Ерлан'], backup: 'Аягөз', mode: 'single' },
    { name: 'Визы и консультации', kw: 'виза, визу, страховк, консультац', mgrs: ['Дана'], backup: 'Аягөз', mode: 'single' },
  ]
  const DIR: Record<string, string> = {}
  for (const [i, d] of dirs.entries()) {
    const r = await db.direction.create({ data: { organizationId: orgId, name: d.name, keywords: d.kw.split(',').map(s => s.trim()), managerIds: d.mgrs.map(x => M[x]!), backupId: M[d.backup], mode: d.mode, order: i } })
    DIR[d.name] = r.id
  }
  const kw = (s: string) => s.split(',').map(x => x.trim())
  await db.organization.update({
    where: { id: orgId },
    data: {
      routing: {
        channels: { WHATSAPP: 'auto', INSTAGRAM: 'auto', SITE: 'auto' },
        fallback: 'queue',
        keywords: {
          GROUP: kw('будапешт, вена, италия, рим, флоренц, венец, стамбул, каппадок, чарын, кольсай, групп, авторск'),
          PACKAGE: kw('турци, анталь, египет, шарм, хургад, дубай, оаэ, всё включено, все включено, 5 звёзд, 5 звезд, 5*, пакет'),
          BASE: kw('страховк, консультац, билет, справк'),
        },
        links: [
          { tag: 'GT-p1', label: 'Записаться на «Будапешт — Вена»', pipeline: 'GROUP', departureId: DEP.p1!.id },
          { tag: 'GT-p2', label: 'Записаться на «Рим — Флоренция — Венеция»', pipeline: 'GROUP', departureId: DEP.p2!.id },
          { tag: 'PK', label: 'Подобрать тур у туроператора', pipeline: 'PACKAGE', departureId: null },
        ],
      },
    },
  })
  const dirFor = (title: string): string | null => {
    const t = title.toLowerCase()
    for (const d of dirs) if (kw(d.kw).some(k => t.includes(k))) return DIR[d.name]!
    return null
  }

  // Operators
  const OP: Record<string, string> = {}
  for (const o of [
    { id: 'op1', name: 'Anex Tour', terms: 'Полная оплата за 14 дней до вылета', com: '10' },
    { id: 'op2', name: 'FUN&SUN', terms: 'Предоплата 30% при подтверждении, остаток за 10 дней', com: '11' },
    { id: 'op3', name: 'Pegas Touristik', terms: 'Полная оплата в течение 3 дней после подтверждения', com: '9' },
    { id: 'op4', name: 'Kompas', terms: 'Полная оплата за 7 дней до вылета', com: '10' },
  ]) {
    const r = await db.operator.create({ data: { organizationId: orgId, name: o.name, paymentTerms: o.terms, commissionPct: o.com, contact: `b2b-менеджер, +7 727 000 00 0${o.id.slice(-1)}` } })
    OP[o.id] = r.id
  }

  // Clients (one per normalized phone)
  const CLIENT: Record<string, string> = {}
  for (const d of DEALS) {
    const phone = normalizePhone(d.phone)!
    if (CLIENT[phone]) {
      continue
    }
    const created = stamp(d.hist[0]!.t)
    const isAigerim = d.client === 'Айгерим Нурланова'
    const c = await db.client.create({
      data: {
        organizationId: orgId, name: d.client, phone, source: CH[d.src]!, email: d.cl?.email ?? null, fullName: d.cl?.full ?? null,
        iinEnc: encryptPii(d.cl?.iin), birthDate: d.cl ? fixed(d.cl.birth) : null, address: d.cl?.address ?? null,
        pdConsentAt: d.cl ? created : null, managerId: d.manager ? M[d.manager] : null,
        tags: isAigerim ? ['Шенген есть', 'Путешествует с мужем', 'Предпочитает WhatsApp'] : [],
        note: isAigerim ? 'Постоянная клиентка, рекомендовала нас подругам' : null,
        createdAt: created,
      },
    })
    CLIENT[phone] = c.id
  }
  // Possible duplicate for the «Дубли» filter: same person, another phone.
  await db.client.create({ data: { organizationId: orgId, name: 'Ерболат Касымов', phone: '+77015551331', source: 'CALL', createdAt: at(10, 9) } })

  // Deals
  const DEAL: Record<string, string> = {}
  const TRAVELER: Record<string, string> = {}
  let contractNo = 0
  for (const d of DEALS) {
    const pipe = d.pipe
    const stages = STAGE[pipe]!
    const stageId = stages[Math.min(d.stage, stages.length - 1)]!
    const dep = d.dep ? DEP[d.dep] : null
    const created = stamp(d.hist[0]!.t)
    const dates = dep ? formatRange(dep.start, dep.end) : d.dates ?? null
    const reqChecks = Object.fromEntries(Object.entries(d.checks ?? {}).filter(([, v]) => v).map(([k]) => [REQ[k]!, true]))
    const reqComments = Object.fromEntries(Object.entries(d.notes ?? {}).map(([k, v]) => [REQ[k]!, v]))
    const reqValues = Object.fromEntries(Object.entries(d.cf ?? {}).map(([k, v]) => [REQ[k]!, v]))
    const lostAt = d.lost ? stamp(d.hist.at(-1)!.t) : null
    const deal = await db.deal.create({
      data: {
        organizationId: orgId, number: Number(d.id.slice(1)), clientId: CLIENT[normalizePhone(d.phone)!]!, pipeline: PIPE[pipe]!, stageId,
        directionId: dirFor(d.title), managerId: d.manager ? M[d.manager] : null, source: CH[d.src]!, title: d.title, dates,
        people: d.people ?? 1, budget: d.budget ?? null, visaHistory: d.visa ?? null, price: d.price ?? 0,
        fullPayDeadline: dep ? DEPARTURES.find(x => x.id === d.dep)!.pay : null, departureId: dep?.id ?? null,
        wonAt: d.won ? stamp(d.hist.at(-1)!.t.replace(/^(\d{2}\.\d{2})/, '$1')) : null,
        lostReason: d.lost ?? null, lostAt, reqChecks, reqComments, reqValues, createdAt: created,
      },
    })
    DEAL[d.id] = deal.id
    if (d.won) {
      await db.deal.update({ where: { id: deal.id }, data: { wonAt: almatyDate(2025, 4, 22, 9), createdAt: almatyDate(2025, 3, 2, 10, 15) } })
    }

    for (const [i, t] of (d.travelers ?? []).entries()) {
      const [mm, yy] = t.exp.split('.')
      const tr = await db.traveler.create({
        data: {
          organizationId: orgId, dealId: deal.id, clientId: i === 0 ? deal.clientId : null, fullNameLatin: latin(t.name),
          passportNoEnc: encryptPii(t.pass || null), passportExpiry: mm && yy ? new Date(Date.UTC(Number(yy), Number(mm) - 1, 28)) : null,
          isChild: !!t.child, childAge: t.child ?? null, visaStatus: t.visa || null, order: i,
        },
      })
      TRAVELER[`${d.id}:${t.name}`] = tr.id
    }
    for (const p of d.pays ?? []) {
      const [dd, mm] = p.date.split('.').map(Number)
      const paidAt = p.year ? almatyDate(p.year, mm! - 1, dd!, 11) : at(dd!, mm!, '11:00')
      await db.payment.create({ data: { organizationId: orgId, dealId: deal.id, amount: p.amount, type: p.type, method: p.method, paidAt, createdById: d.manager ? M[d.manager] : null } })
    }
    for (const doc of d.docs ?? []) {
      const [dd, mm] = doc.date.split('.').map(Number)
      const key = `org/${orgId}/deals/${deal.id}/${doc.name}`
      await upload(key, doc.name)
      await db.document.create({ data: { organizationId: orgId, dealId: deal.id, type: doc.type, name: doc.name, fileKey: key, createdAt: d.won ? almatyDate(2025, mm! - 1, dd!) : at(dd!, mm!) } })
    }
    if (d.signedAt) {
      contractNo++
      const number = d.won ? 'ДТ-2025-041' : `ДТ-2026-${String(contractNo).padStart(3, '0')}`
      const signedAt = d.won ? almatyDate(2025, 3, 5, 12, 10) : stamp(d.signedAt)
      await db.contract.create({
        data: {
          organizationId: orgId, dealId: deal.id, templateId: pipe === 'package' ? TPL.tp3! : TPL.tp1!, number, kind: 'contract', values: {}, emptyFields: [], status: 'SIGNED', createdAt: signedAt,
          signatures: { create: [
            { side: 'client', token: `seed-${deal.id}-c`, signerName: d.cl?.full ?? d.client, method: 'egov', signedAt },
            { side: 'agency', token: `seed-${deal.id}-a`, signerName: 'Ерлан', method: 'ncalayer', signedAt },
          ] },
        },
      })
    }
    for (const n of d.nl ?? []) {
      await db.note.create({ data: { organizationId: orgId, dealId: deal.id, authorId: M[n.who], authorLabel: n.who, text: n.text, createdAt: stamp(n.t) } })
    }
    for (const h of d.hist) {
      const kind = h.text.startsWith('Этап') ? 'stage' : h.text.startsWith('Оплата') ? 'pay' : h.text.startsWith('Закрыта') ? 'lost' : 'system'
      const atTime = d.won ? (h.t.startsWith('02.04') ? almatyDate(2025, 3, 2, 10, 15) : almatyDate(2025, 4, 22, 9)) : stamp(h.t)
      await db.dealEvent.create({ data: { organizationId: orgId, dealId: deal.id, at: atTime, actorId: h.who ? M[h.who] : null, actorLabel: h.who ?? 'Система', kind, text: h.text } })
    }

    // System stage tasks: closed for passed stages, open for the current one.
    if (!d.lost) {
      for (let i = 0; i <= Math.min(d.stage, stages.length - 1); i++) {
        const current = i === d.stage && !d.won
        const stageName = Object.keys(META[pipe]!)[i]!
        const meta = META[pipe]![stageName]!
        const assignee = d.manager ? M[d.manager] : M['Ерлан']
        await db.task.create({
          data: {
            organizationId: orgId, title: `Этап «${stageName}»: выполнить регламент`, description: meta.desc,
            status: current ? 'IN_PROGRESS' : 'DONE', priority: current && i <= 1 ? 'HIGH' : 'MEDIUM',
            dueAt: current ? at(22 + Math.min(i, 3), 10, '18:00') : created, assigneeId: assignee, authorId: null, dealId: deal.id, stageId: stages[i],
            isSystem: true, completedAt: current ? null : created,
            result: current ? null : 'Этап завершён',
            subtasks: [], log: [{ at: created.toISOString(), text: `Создана автоматически при переходе на этап «${stageName}»`, actor: 'Система' }, ...(current ? [] : [{ at: created.toISOString(), text: 'Закрыта автоматически: этап завершён', actor: 'Система' }])],
            createdAt: created,
          },
        })
      }
    }
  }

  // Offers and booking
  const offers = [
    { deal: 'd9', op: 'op1', hotel: 'Пляжный отель «Марина»', stars: 5, resort: 'ОАЭ, Дубай Марина', from: day(20, 11), to: day(25, 11), meal: 'Завтраки', room: 'Deluxe Sea View', flight: true, transfer: true, ins: true, net: 1080000, price: 1240000, status: 'SENT' as const, note: '' },
    { deal: 'd9', op: 'op2', hotel: 'Resort «Пальма»', stars: 5, resort: 'ОАЭ, Пальма Джумейра', from: day(20, 11), to: day(25, 11), meal: 'Полупансион', room: 'Superior', flight: true, transfer: true, ins: true, net: 1290000, price: 1460000, status: 'SENT' as const, note: 'Свой пляж, аквапарк' },
    { deal: 'd9', op: 'op3', hotel: 'City Hotel «Даунтаун»', stars: 4, resort: 'ОАЭ, Даунтаун', from: day(20, 11), to: day(25, 11), meal: 'Завтраки', room: 'Standard', flight: true, transfer: false, ins: true, net: 820000, price: 950000, status: 'SENT' as const, note: 'Бюджетный вариант' },
    { deal: 'd11', op: 'op2', hotel: 'Coral Beach Resort', stars: 5, resort: 'Египет, Шарм-эль-Шейх', from: day(2, 11), to: day(9, 11), meal: 'Всё включено', room: 'Sea View', flight: true, transfer: true, ins: true, net: 860000, price: 980000, status: 'CHOSEN' as const, note: '' },
    { deal: 'd11', op: 'op1', hotel: 'Reef Hotel', stars: 4, resort: 'Египет, Шарм-эль-Шейх', from: day(2, 11), to: day(9, 11), meal: 'Всё включено', room: 'Standard', flight: true, transfer: true, ins: true, net: 690000, price: 790000, status: 'REJECTED' as const, note: '' },
  ]
  for (const o of offers) {
    const r = await db.offer.create({ data: { organizationId: orgId, dealId: DEAL[o.deal]!, operatorId: OP[o.op]!, hotel: o.hotel, stars: o.stars, resort: o.resort, fromDate: o.from, toDate: o.to, meal: o.meal, room: o.room, flight: o.flight, transfer: o.transfer, insurance: o.ins, net: o.net, price: o.price, status: o.status, note: o.note || null, source: 'manual' } })
    if (o.status === 'CHOSEN') {
      await db.operatorBooking.create({ data: { organizationId: orgId, dealId: DEAL[o.deal]!, offerId: r.id, operatorId: OP[o.op]!, number: 'FS-2611043', status: 'CONFIRMED', createdAt: at(19, 10, '15:00'), confirmedAt: at(19, 10, '18:20'), paymentDeadline: day(28, 10), net: o.net } })
    }
  }
  for (const [id, from, to] of [['d9', day(20, 11), day(25, 11)], ['d11', day(2, 11), day(9, 11)]] as const) {
    const d = DEALS.find(x => x.id === id)!
    await db.deal.update({ where: { id: DEAL[id] }, data: { dates: formatRange(from, to), title: `${d.title}, ${formatRange(from, to)}` } })
  }

  // Participants
  for (const p of PARTS) {
    const dealSeed = p.deal ? DEALS.find(x => x.id === p.deal) : null
    await db.participant.create({
      data: {
        organizationId: orgId, departureId: DEP[p.dep]!.id, dealId: p.deal ? DEAL[p.deal] : null,
        travelerId: dealSeed ? TRAVELER[`${dealSeed.id}:${p.name}`] ?? null : null, name: p.name, passportNote: p.pass, paid: p.paid, step: p.st,
      },
    })
  }

  // Manual tasks
  for (const t of TASKS) {
    const due = dueFrom(t.due)
    const deal = t.deal ? DEALS.find(x => x.id === t.deal)! : null
    const stageId = t.stage && deal ? STAGE[deal.pipe]![deal.stage] : null
    await db.task.create({
      data: {
        organizationId: orgId, title: t.text, description: t.desc || null, status: t.status as 'TODO', priority: t.prio as 'HIGH', dueAt: due,
        assigneeId: M[t.who], authorId: t.author ? M[t.author] : null, dealId: t.deal ? DEAL[t.deal] : null, departureId: t.dep ? DEP[t.dep]!.id : null,
        stageId, isSystem: false, result: t.result ?? null, completedAt: t.status === 'DONE' ? at(21, 10, '16:20') : null,
        subtasks: t.subs, log: t.log.map(l => ({ at: stamp(l.t).toISOString(), text: l.text, actor: '' })), createdAt: stamp(t.log[0]!.t),
      },
    })
  }

  // Calendar events
  for (const e of EVENTS) {
    await db.event.create({ data: { organizationId: orgId, type: e.type, title: e.title, description: e.sub || null, startAt: at(e.d, e.m, e.time), endAt: null, place: e.place, assigneeId: M[e.who], dealId: e.deal ? DEAL[e.deal] : null, remind: e.remind } })
  }

  // Conversations
  for (const c of CONVS) {
    const phone = normalizePhone(c.phone)!
    const msgs = c.msgs.map((m) => {
      const [hh, mm] = m.time.split(':')
      return { ...m, at: at((m as { yesterday?: boolean }).yesterday ? 21 : 22, 10, `${hh}:${mm}`) }
    })
    await db.conversation.create({
      data: {
        organizationId: orgId, channel: CH[c.src]!, externalId: phone.slice(1), clientPhone: phone, clientName: c.name, dealId: c.deal ? DEAL[c.deal] : null,
        unread: c.unread, lead: c.lead, lastMessageAt: msgs.at(-1)!.at,
        messages: { create: msgs.map(m => ({ direction: m.from, text: m.text, sentAt: m.at, auto: !!(m as { auto?: boolean }).auto })) },
      },
    })
  }

  // Constructor tours (not shifted: real 2027 dates)
  const grand = await db.tour.create({
    data: {
      organizationId: orgId, slug: 'grand-tour-2027', name: 'GRAND TOUR', flags: '🇮🇹🇪🇸🇫🇷🇨🇭🇻🇦', countries: ['Италия', 'Испания', 'Франция', 'Швейцария', 'Ватикан'],
      route: 'Милан → Барселона → Париж → Интерлакен / Лаутербруннен → Ватикан → Рим', startDate: fixed('2027-07-28'), endDate: fixed('2027-08-06'),
      seats: 15, price: 1290000, prepay: 160000, riseDate: fixed('2027-06-15'), riseAmount: 100000, payRule: 'Остаток оплачивается после получения визы', status: 'PUBLISHED',
      description: 'Шесть городов Европы за десять дней: шопинг в Милане, море и Гауди в Барселоне, Париж, водопады Швейцарии и вечный Рим.',
      included: ['Перелёт из Алматы с багажом до 10 кг', 'Авиаперелёты между городами', 'Проживание', 'Услуги гида', 'Помощь в оформлении визы', 'Фото- и видеосопровождение'],
      extra: ['Визовый сбор', 'Питание', 'Внутригородской транспорт', 'Личные расходы', 'Дополнительный багаж'],
      rates: { EUR: 545, USD: 505, CHF: 585 }, ratesFixedAt: fixed('2026-10-20'), pricesCheckedAt: fixed('2026-10-20'), posts: [{ kind: 'Пост', url: 'https://instagram.com/p/demo' }],
      days: { create: [
        { order: 0, city: 'Милан', items: ['Прилёт', 'Дуомо и галерея Виктора Эммануила'], description: 'Встреча группы, заселение, вечерняя прогулка по центру.', transfer: 'Аэропорт — отель', availabilityChecked: true },
        { order: 1, city: 'Барселона', items: ['Саграда Фамилия', 'Парк Гуэль', 'Готический квартал'], description: 'Перелёт в Барселону, день Гауди.', transfer: 'Перелёт Милан — Барселона', availabilityChecked: true },
        { order: 2, city: 'Париж', items: ['Эйфелева башня', 'Лувр', 'Монмартр'], description: 'Два дня в Париже, вечерний круиз по Сене по желанию.', transfer: 'Перелёт Барселона — Париж', availabilityChecked: true },
        { order: 3, city: 'Интерлакен / Лаутербруннен', items: ['Долина 72 водопадов', 'Озёра Thun и Brienz'], description: 'Альпы и водопады, фотосессия.', transfer: 'Поезд Париж — Интерлакен', availabilityChecked: true },
        { order: 4, city: 'Ватикан', items: ['Собор Святого Петра', 'Музеи Ватикана'], description: 'Перелёт в Рим, Ватикан.', transfer: 'Перелёт Женева — Рим', availabilityChecked: true },
        { order: 5, city: 'Рим', items: ['Колизей', 'Фонтан Треви', 'Пантеон'], description: 'Прогулка по Риму, прощальный ужин, вылет.', transfer: 'Отель — аэропорт', availabilityChecked: true },
      ] },
      flights: { create: [
        { order: 0, from: 'Алматы', to: 'Милан', departAt: new Date('2027-07-28T02:40:00Z'), airline: 'Air Astana', ticket: '260', baggage: '0', currency: 'EUR' },
        { order: 1, from: 'Милан', to: 'Барселона', departAt: new Date('2027-07-30T08:15:00Z'), airline: 'Vueling', ticket: '60', baggage: '25', currency: 'EUR' },
        { order: 2, from: 'Барселона', to: 'Париж', departAt: new Date('2027-08-01T07:20:00Z'), airline: 'Vueling', ticket: '70', baggage: '25', currency: 'EUR' },
        { order: 3, from: 'Женева', to: 'Рим', departAt: new Date('2027-08-04T10:00:00Z'), airline: 'easyJet', ticket: '80', baggage: '30', currency: 'EUR' },
        { order: 4, from: 'Рим', to: 'Алматы', departAt: new Date('2027-08-06T19:30:00Z'), airline: 'Air Astana', ticket: '260', baggage: '0', currency: 'EUR' },
      ] },
      stays: { create: [
        { order: 0, city: 'Милан', name: 'Отель 3★ у вокзала Centrale', checkIn: fixed('2027-07-28'), checkOut: fixed('2027-07-30'), rooms: 8, guests: 16, total: '1920', currency: 'EUR' },
        { order: 1, city: 'Барселона', name: 'Апартаменты в Эшампле', checkIn: fixed('2027-07-30'), checkOut: fixed('2027-08-01'), rooms: 8, guests: 16, total: '2240', currency: 'EUR', note: 'Пик сезона — цены растут' },
        { order: 2, city: 'Париж', name: 'Отель 3★ район Опера', checkIn: fixed('2027-08-01'), checkOut: fixed('2027-08-03'), rooms: 8, guests: 16, total: '2400', currency: 'EUR' },
        { order: 3, city: 'Интерлакен', name: 'Шале в Лаутербруннене', checkIn: fixed('2027-08-03'), checkOut: fixed('2027-08-04'), rooms: 8, guests: 16, total: '1440', currency: 'CHF' },
        { order: 4, city: 'Рим', name: 'Отель 3★ у Термини', checkIn: fixed('2027-08-04'), checkOut: fixed('2027-08-06'), rooms: 8, guests: 16, total: '1920', currency: 'EUR', note: 'Концерт 5 августа — проверить цены' },
      ] },
      costs: { create: [
        { order: 0, category: 'Услуги гида', plan: '600000', unit: 'KZT', per: 'group' },
        { order: 1, category: 'Фото- и видеосъёмка', plan: '300000', unit: 'KZT', per: 'group' },
        { order: 2, category: 'Трансферы', plan: '800', unit: 'EUR', per: 'group' },
        { order: 3, category: 'Поезд Париж — Интерлакен', plan: '90', unit: 'EUR', per: 'tourist' },
        { order: 4, category: 'Организационные расходы', plan: '100000', unit: 'KZT', per: 'group' },
        { order: 5, category: 'Непредвиденные расходы', plan: '5', unit: 'PERCENT', per: 'group' },
      ] },
    },
  })
  // Publishing created a departure (min = break-even 10, deadlines −45/−30/−7 days).
  await db.departure.create({ data: { organizationId: orgId, tourId: grand.id, name: 'GRAND TOUR', route: grand.route, startDate: fixed('2027-07-28'), endDate: fixed('2027-08-06'), type: 'Авторский', visa: true, minSeats: 10, maxSeats: 15, price: 1290000, flightDeadline: fixed('2027-06-13'), payDeadline: fixed('2027-06-28'), briefingAt: fixed('2027-07-21') } })

  await db.tour.create({
    data: {
      organizationId: orgId, slug: 'switzerland-alps-2027', name: 'Швейцария: Альпы и приключения', flags: '🇨🇭', countries: ['Швейцария'],
      route: 'Женева → Интерлакен → Лаутербруннен → Венген → Гриндельвальд', startDate: fixed('2027-03-29'), endDate: fixed('2027-03-31'),
      seats: 10, price: 0, prepay: 150000, payRule: 'Остаток за 30 дней до поездки', status: 'DRAFT',
      description: 'Горные деревни, ледники, водопады, вертолётный полёт, зиплайны и самые красивые канатные дороги Альп.',
      included: ['Проживание', 'Аренда автомобиля или проездной на 3 дня', 'Все переезды', 'Сопровождение', 'Профессиональное фото и видео'],
      extra: ['Вертолёт', 'Зиплайн', 'Канатные дороги', 'Параглайдинг', 'Питание', 'Личные расходы'],
      rates: { EUR: 545, USD: 505, CHF: 585 }, ratesFixedAt: fixed('2026-10-20'),
      days: { create: [
        { order: 0, city: 'Женева', items: ['Прилёт', 'Старый город', 'Женевское озеро', 'Фонтан Jet d’Eau'], description: 'Фонтан выбрасывает воду на высоту около 150 м — один из символов города.', availabilityChecked: true },
        { order: 1, city: 'Интерлакен', items: ['Переезд через Альпы', 'Озёра Thun и Brienz', 'Harder Kulm', 'Параглайдинг по желанию'], description: 'Одно из главных мест для экстремального туризма в Европе.', transfer: 'На машине Женева — Интерлакен', availabilityChecked: true },
        { order: 2, city: 'Лаутербруннен', items: ['Долина 72 водопадов', 'Staubbach', 'Trümmelbach', 'Вертолётный тур над Альпами', 'Канатная дорога Schilthorn', 'Обед на вершине'], description: 'Одна из самых красивых долин Европы. Панорамы Eiger, Mönch и Jungfrau.', availabilityChecked: false },
        { order: 3, city: 'Венген', items: ['Деревня без автомобилей', 'Альпийские тропы', 'Подвесные мосты', 'Панорамы ледников'], description: 'Самые фотогеничные виды региона Jungfrau.', transfer: 'Поезд Лаутербруннен — Венген', availabilityChecked: true },
        { order: 4, city: 'Гриндельвальд', items: ['Grindelwald First', 'First Cliff Walk', 'First Flyer Zipline', 'Горные карты', 'Трекинг'], description: 'Самый адреналиновый день тура.', availabilityChecked: false },
      ] },
      flights: { create: [
        { order: 0, from: 'Алматы', to: 'Женева', departAt: new Date('2027-03-29T02:10:00Z'), currency: 'EUR' },
        { order: 1, from: 'Женева', to: 'Алматы', departAt: new Date('2027-03-31T17:00:00Z'), currency: 'EUR' },
      ] },
      stays: { create: [{ order: 0, city: 'Интерлакен', name: '', checkIn: fixed('2027-03-29'), checkOut: fixed('2027-03-31'), rooms: 5, guests: 10, currency: 'CHF', note: 'Конец сезона — проверить работу канатных дорог' }] },
      costs: { create: [
        { order: 0, category: 'Аренда автомобиля', plan: '900', unit: 'CHF', per: 'group' },
        { order: 1, category: 'Фото- и видеосъёмка', plan: '300000', unit: 'KZT', per: 'group' },
        { order: 2, category: 'Непредвиденные расходы', plan: '5', unit: 'PERCENT', per: 'group' },
      ] },
    },
  })

  // Notifications
  await db.notification.createMany({ data: [
    { organizationId: orgId, memberId: M['Аягөз']!, title: 'Новая заявка назначена', body: 'Мадина Ахметова — Европа, весна 2027', link: `/deals/${DEAL.d5}`, createdAt: at(22, 10, '13:41') },
    { organizationId: orgId, memberId: M['Аягөз']!, title: 'Дедлайн оплаты оператору', body: 'FUN&SUN · FS-2611043 — оплатить до ' + formatRange(day(28, 10), day(28, 10)), link: `/deals/${DEAL.d11}`, createdAt: at(22, 10, '09:00') },
    { organizationId: orgId, memberId: M['Ерлан']!, title: 'Выезд в риске недобора', body: 'Чарын — Кольсай — Каинды: готовы 2 из 6', link: `/departures/${DEP.p3!.id}`, createdAt: at(22, 10, '09:00') },
    { organizationId: orgId, memberId: M['Ерлан']!, title: 'Оплата получена', body: 'Алия Жумабекова — 300 000 ₸', link: `/deals/${DEAL.d3}`, createdAt: at(18, 10, '15:10'), readAt: at(18, 10, '16:00') },
  ] })

  console.log('Done. Sign in: erlan@demo.travel / demo1234 (owner), ayagoz@demo.travel / demo1234 (manager), callcenter@demo.travel / demo1234 (call center).')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
