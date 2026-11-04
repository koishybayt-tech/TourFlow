import type { Pipeline, RequirementType, PrismaClient } from '../generated/prisma/client'
import type { ScopedDb } from '../utils/db'
import { bindVariables } from '../../shared/domain/templates'

/** Default stage regulations, contract templates and receipts for a new organization (from the prototype). */

export const PIPE: Record<string, Pipeline> = { group: 'GROUP', package: 'PACKAGE', base: 'BASE' }

export type Req = { id: string, type: string, label: string, req: boolean, key?: string, doc?: string, mode?: string }
export const META: Record<string, Record<string, { desc: string, reqs: Req[] }>> = {
  group: {
    'Новая': { desc: 'Ответьте клиенту в течение 15 минут: представьтесь, поблагодарите за обращение и уточните первичные данные — даты, направление, сколько человек, есть ли виза.', reqs: [{ id: 'g0a', type: 'field', key: 'dates', label: 'Желаемые даты поездки', req: true }, { id: 'g0b', type: 'field', key: 'people', label: 'Количество человек', req: true }, { id: 'g0c', type: 'check', label: 'Первый ответ клиенту отправлен', req: true }] },
    'Консультация': { desc: 'Расскажите программу, стоимость и что входит. Подберите подходящий выезд, зафиксируйте бюджет и итог разговора.', reqs: [{ id: 'g1a', type: 'field', key: 'budget', label: 'Бюджет клиента', req: true }, { id: 'g1b', type: 'dep', label: 'Выбран выезд', req: true }, { id: 'g1c', type: 'comment', label: 'Итог консультации', req: true }] },
    'Визовая проверка': { desc: 'Проверьте, сможет ли клиент получить визу: паспорт действует 6 месяцев после поездки, история виз, нет отказов. Внесите паспортные данные каждого туриста.', reqs: [{ id: 'g2a', type: 'travelers', label: 'Туристы с паспортными данными', req: true }, { id: 'g2b', type: 'doc', doc: 'Паспорт', label: 'Скан паспорта', req: true }, { id: 'g2c', type: 'field', key: 'visa', label: 'Визовая история', req: true }, { id: 'g2d', type: 'check', label: 'Срок паспорта проверен: ≥ 6 мес. после поездки', req: true }] },
    'Договор': { desc: 'Сформируйте договор из шаблона и отправьте клиенту на подпись в WhatsApp. Без подписанного договора предоплату не принимаем.', reqs: [{ id: 'g3c', type: 'client', label: 'Данные клиента для договора: ФИО, ИИН, адрес', req: true }, { id: 'g3a', type: 'sign', label: 'Договор подписан клиентом и турагентством', req: true }] },
    'Предоплата': { desc: 'Примите предоплату — от 100 000 ₸ за человека — и запишите клиента на подачу документов в визовый центр.', reqs: [{ id: 'g4a', type: 'pay', mode: 'prepay', label: 'Предоплата от 100 000 ₸ за человека', req: true }, { id: 'g4b', type: 'event', label: 'Визовая запись в календаре', req: true }, { id: 'g4c', type: 'doc', doc: 'Чек', label: 'Чек об оплате', req: false }] },
    'Виза': { desc: 'Дождитесь решения (около 14 рабочих дней). Получив паспорт, сверьте визу: ФИО, даты, номер, данные паспорта. При отказе — предложите перенос или оформите возврат.', reqs: [{ id: 'g5a', type: 'doc', doc: 'Виза', label: 'Скан визы', req: true }, { id: 'g5b', type: 'check', label: 'Проверены ФИО, даты, номер визы и паспорт', req: true }] },
    'Полная оплата': { desc: 'Получите остаток до дедлайна выезда. После полной оплаты турист считается готовым и учитывается в минимуме группы.', reqs: [{ id: 'g6a', type: 'pay', mode: 'full', label: 'Оплачено 100% стоимости', req: true }] },
    'Готов к выезду': { desc: 'Выдайте билеты и ваучеры, отправьте инструкцию, пригласите на сбор группы. После возвращения попросите отзыв.', reqs: [{ id: 'g7a', type: 'doc', doc: 'Авиабилет', label: 'Билеты выданы клиенту', req: true }, { id: 'g7b', type: 'check', label: 'Инструкция перед поездкой отправлена', req: true }, { id: 'g7c', type: 'comment', label: 'Отзыв после поездки', req: false }] },
  },
  package: {
    'Новая': { desc: 'Ответьте в течение 15 минут и уточните даты, состав, направление и пожелания по отелю.', reqs: [{ id: 'p0a', type: 'field', key: 'dates', label: 'Даты поездки', req: true }, { id: 'p0b', type: 'field', key: 'people', label: 'Количество человек', req: true }] },
    'Подбор': { desc: 'Подберите 2–4 варианта у разных туроператоров под бюджет и пожелания клиента.', reqs: [{ id: 'p1a', type: 'field', key: 'budget', label: 'Бюджет клиента', req: true }, { id: 'p1b', type: 'comment', label: 'Пожелания: отель, питание, перелёт', req: true }] },
    'Предложение отправлено': { desc: 'Отправьте подборку в WhatsApp и договоритесь о времени ответа. Не держите варианты дольше суток — цены меняются.', reqs: [{ id: 'p2a', type: 'check', label: 'Подборка отправлена клиенту', req: true }, { id: 'p2b', type: 'comment', label: 'Какой вариант выбрал клиент', req: true }] },
    'Бронь у оператора': { desc: 'Забронируйте тур у оператора, внесите номер заявки и подпишите договор с клиентом.', reqs: [{ id: 'p3a', type: 'field', key: 'cf', label: 'Номер брони у туроператора', req: true }, { id: 'p3c', type: 'client', label: 'Данные клиента для договора: ФИО, ИИН, адрес', req: true }, { id: 'p3b', type: 'sign', label: 'Договор подписан клиентом и турагентством', req: true }] },
    'Оплата': { desc: 'Получите полную оплату от клиента и оплатите туроператору до его дедлайна.', reqs: [{ id: 'p4a', type: 'pay', mode: 'full', label: 'Оплачено 100% стоимости', req: true }, { id: 'p4b', type: 'check', label: 'Оплата туроператору проведена', req: true }] },
    'Документы выданы': { desc: 'Выдайте ваучер, билеты и страховку, напомните о сроках вылета.', reqs: [{ id: 'p5a', type: 'doc', doc: 'Ваучер', label: 'Ваучер', req: true }, { id: 'p5b', type: 'doc', doc: 'Авиабилет', label: 'Авиабилеты', req: true }] },
  },
  base: {
    'Новая': { desc: 'Ответьте клиенту в течение 15 минут и уточните запрос.', reqs: [{ id: 'b0a', type: 'check', label: 'Первый ответ отправлен', req: true }] },
    'В работе': { desc: 'Разберитесь в запросе клиента и подготовьте решение.', reqs: [{ id: 'b1a', type: 'comment', label: 'Суть запроса', req: true }] },
    'Предложение': { desc: 'Отправьте клиенту предложение со стоимостью.', reqs: [{ id: 'b2a', type: 'check', label: 'Предложение отправлено', req: true }] },
    'Ожидание решения': { desc: 'Свяжитесь с клиентом в оговорённый срок.', reqs: [{ id: 'b3a', type: 'comment', label: 'Ответ клиента', req: true }] },
    'Договор и оплата': { desc: 'Подпишите договор и примите оплату.', reqs: [{ id: 'b4c', type: 'client', label: 'Данные клиента для договора', req: true }, { id: 'b4a', type: 'sign', label: 'Договор подписан обеими сторонами', req: true }, { id: 'b4b', type: 'pay', mode: 'full', label: 'Оплачено 100%', req: true }] },
  },
}

export function mapReq(r: Req): { type: RequirementType, config: Record<string, unknown> } {
  switch (r.type) {
    case 'field': return { type: 'FIELD', config: r.key === 'cf' ? {} : { field: r.key === 'visa' ? 'visaHistory' : r.key } }
    case 'doc': return { type: 'DOC', config: { docType: r.doc } }
    case 'sign': return { type: 'SIGN', config: {} }
    case 'pay': return { type: 'PAY', config: r.mode === 'prepay' ? { mode: 'prepay', perPerson: 100_000 } : { mode: 'full' } }
    case 'comment': return { type: 'COMMENT', config: {} }
    case 'check': return { type: 'CHECK', config: {} }
    case 'dep': return { type: 'DEPARTURE', config: {} }
    case 'travelers': return { type: 'TRAVELERS', config: {} }
    case 'event': return { type: 'EVENT', config: { eventType: 'visa' } }
    case 'client': return { type: 'CLIENT', config: {} }
    default: throw new Error(r.type)
  }
}

export const CONTRACT_TEMPLATES = [
  { id: 'tp1', name: 'Договор на групповой визовый тур', pipe: 'group', body: 'ДОГОВОР № {contract_no}\nо реализации туристского продукта\n\nг. Алматы, {contract_date}\n\n{company_name}, БИН {company_bin}, в лице директора {company_director}, действующего на основании Устава (далее — Турагент), и {client_fio}, ИИН {client_iin}, проживающий(ая) по адресу: {client_address} (далее — Турист), заключили настоящий договор о нижеследующем.\n\n1. Турагент обязуется предоставить туристский продукт: {tour_name}, даты поездки: {tour_dates}, количество туристов: {tourists_count}. Состав группы: {tourists_list}.\n\n2. Стоимость туристского продукта — {price_total}. Предоплата — {prepayment}, внесено на дату договора — {paid}. Полная оплата производится до {full_pay_deadline}.\n\n3. Турагент оказывает содействие в оформлении визы. Отказ консульства в выдаче визы не является нарушением договора со стороны Турагента.\n\n4. Условия возврата: {refund_rule}.\n\n5. Реквизиты Турагента: {company_name}, БИН {company_bin}, {company_address}, {company_bank}, ИИК {company_iik}, БИК {company_bik}. Лицензия: {company_license}.\n\nТурагент: {company_director}\nТурист: {client_fio}, тел. {client_phone}' },
  { id: 'tp2', name: 'Договор на тур по Казахстану', pipe: 'group', body: 'ДОГОВОР № {contract_no}\nна туристское обслуживание по Республике Казахстан\n\nг. Алматы, {contract_date}\n\n{company_name}, БИН {company_bin} (далее — Исполнитель), и {client_fio}, ИИН {client_iin} (далее — Заказчик), заключили договор.\n\n1. Исполнитель организует тур: {tour_name}, {tour_dates}, количество человек: {tourists_count}.\n\n2. Стоимость — {price_total}, оплачено — {paid}.\n\n3. Условия возврата: {refund_rule}.\n\nИсполнитель: {company_director}\nЗаказчик: {client_fio}' },
  { id: 'tp4', name: 'Дополнительное соглашение о переносе даты', pipe: 'group', body: 'ДОПОЛНИТЕЛЬНОЕ СОГЛАШЕНИЕ\nк договору № {contract_no}\n\nг. Алматы, {contract_date}\n\n{company_name} и {client_fio}, ИИН {client_iin}, договорились перенести поездку «{tour_name}» на даты: {tour_dates}. Внесённая оплата {paid} засчитывается в стоимость нового выезда.\n\nТурагент: {company_director}\nТурист: {client_fio}' },
  { id: 'tp5', name: 'Доверенность на подачу документов в визовый центр', pipe: 'group', body: 'ДОВЕРЕННОСТЬ\n\nг. Алматы, {contract_date}\n\nЯ, {client_fio}, ИИН {client_iin}, проживающий(ая) по адресу: {client_address}, доверяю {company_name} (БИН {company_bin}) подать и получить мои документы в визовом центре для поездки «{tour_name}», {tour_dates}.\n\nДоверитель: {client_fio}, тел. {client_phone}' },
  { id: 'tp6', name: 'Согласие на обработку персональных данных', pipe: 'group', body: 'СОГЛАСИЕ НА СБОР И ОБРАБОТКУ ПЕРСОНАЛЬНЫХ ДАННЫХ\n\nЯ, {client_fio}, ИИН {client_iin}, дата рождения {client_birth}, даю согласие {company_name} (БИН {company_bin}) на сбор и обработку моих персональных данных для оформления поездки «{tour_name}» и визы.\n\n{contract_date}\nСубъект: {client_fio}' },
  { id: 'tp7', name: 'Акт оказанных услуг', pipe: 'group', body: 'АКТ ОКАЗАННЫХ УСЛУГ\nпо договору № {contract_no}\n\nг. Алматы, {contract_date}\n\n{company_name} оказал, а {client_fio} принял услуги по туристскому продукту «{tour_name}», {tour_dates}, на сумму {price_total}. Претензий стороны не имеют.\n\nИсполнитель: {company_director}\nЗаказчик: {client_fio}' },
  { id: 'tp8', name: 'Договор на групповой тур с гидом', pipe: 'group', body: 'ДОГОВОР № {contract_no}\nна групповой тур с сопровождением\n\nг. Алматы, {contract_date}\n\n{company_name}, БИН {company_bin}, и {client_fio}, ИИН {client_iin}, заключили договор на тур «{tour_name}», {tour_dates}, туристов: {tourists_count}. Сопровождающий гид: {guide_name}.\n\nСтоимость — {price_total}, полная оплата до {full_pay_deadline}.\nУсловия возврата: {refund_rule}.\n\nТурагент: {company_director}\nТурист: {client_fio}' },
  { id: 'tp3', name: 'Договор на пакетный тур', pipe: 'package', body: 'ДОГОВОР № {contract_no}\nо реализации туристского продукта туроператора\n\nг. Алматы, {contract_date}\n\n{company_name}, БИН {company_bin}, и {client_fio}, ИИН {client_iin}, адрес: {client_address}, заключили договор на тур: {tour_name}, {tour_dates}, туристов: {tourists_count}. Стоимость — {price_total}.\n\nУсловия возврата определяются правилами туроператора и п. 4: {refund_rule}.\n\nТурагент: {company_director}\nТурист: {client_fio}' },
  { id: 'tp9', name: 'Договор на услуги (базовый)', pipe: 'base', body: 'ДОГОВОР № {contract_no}\nоб оказании услуг\n\nг. Алматы, {contract_date}\n\n{company_name}, БИН {company_bin}, и {client_fio}, ИИН {client_iin}, адрес: {client_address}, заключили договор на оказание услуг: {tour_name}. Стоимость — {price_total}.\n\nИсполнитель: {company_director}\nЗаказчик: {client_fio}' },
]

export const RECEIPTS = [
  { title: 'Клиент сам выбрал отель', short: 'Претензий к фактическому виду, расположению и категории отеля не имеет', when: 'hotel', body: 'РАСПИСКА\nо самостоятельном выборе отеля\n\nЯ, {client_fio}, ИИН {client_iin}, подтверждаю, что самостоятельно выбрал(а) отель {hotel_name} для поездки «{tour_name}», {tour_dates}.\n\nС описанием отеля, фотографиями, отзывами и расположением ознакомлен(а) на сайте отеля и туроператора {operator_name}. Понимаю, что фактический вид номера, территории и пляжа может отличаться от фотографий. Претензий к {company_name} по выбору отеля не имею.\n\n{contract_date}\nТурист: {client_fio}' },
  { title: 'Условия аннуляции и штрафы', short: 'Ознакомлен: блочные и чартерные рейсы невозвратные, штрафы туроператора', when: 'pkg', body: 'РАСПИСКА\nоб ознакомлении с условиями аннуляции\n\nЯ, {client_fio}, ознакомлен(а) с условиями аннуляции тура «{tour_name}», {tour_dates}, туроператора {operator_name}. Понимаю, что при отказе от тура удерживаются фактические расходы и штрафы туроператора, а блочные и чартерные авиабилеты не возвращаются.\n\n{contract_date}\nТурист: {client_fio}' },
  { title: 'Изменение курса валюты', short: 'Цена тура зафиксирована в валюте — возможна доплата при росте курса', when: 'pkg', body: 'РАСПИСКА\nо валюте расчёта\n\nЯ, {client_fio}, понимаю, что стоимость тура «{tour_name}» установлена туроператором в иностранной валюте и пересчитывается в тенге по курсу на дату оплаты. При изменении курса до полной оплаты возможна доплата.\n\n{contract_date}\nТурист: {client_fio}' },
  { title: 'Сборы и депозит на месте', short: 'Курортный сбор, туристический налог и депозит отеля оплачиваются на месте', when: 'hotel', body: 'РАСПИСКА\n\nЯ, {client_fio}, уведомлён(а), что курортный сбор, туристический налог и залоговый депозит отеля {hotel_name} не входят в стоимость тура и оплачиваются самостоятельно при заселении.\n\n{contract_date}\nТурист: {client_fio}' },
  { title: 'Риск отказа в визе', short: 'Решение принимает консульство, сборы и расходы при отказе не возвращаются', when: 'visa', body: 'РАСПИСКА\nоб ознакомлении с визовыми рисками\n\nЯ, {client_fio}, понимаю, что решение о выдаче визы принимает консульство. {company_name} не влияет на решение. При отказе в визе консульский и сервисный сборы не возвращаются, возврат за тур — по условиям договора.\n\n{contract_date}\nТурист: {client_fio}' },
  { title: 'Срок действия паспорта', short: 'Паспорт действует 6 месяцев после поездки, ответственность за документы на туристе', when: 'all', body: 'РАСПИСКА\n\nЯ, {client_fio}, подтверждаю, что мой паспорт и паспорта туристов ({tourists_list}) действительны не менее 6 месяцев после окончания поездки «{tour_name}». Ответственность за наличие и действительность документов несу сам(а).\n\n{contract_date}\nТурист: {client_fio}' },
  { title: 'Отказ от страховки от невыезда', short: 'Клиенту предложили страховку от невыезда, он отказался', when: 'pkg', body: 'РАСПИСКА\nоб отказе от страхования\n\nЯ, {client_fio}, подтверждаю, что мне было предложено страхование от невыезда по туру «{tour_name}». От страховки отказываюсь. Понимаю, что при отмене поездки по личным причинам расходы не компенсируются.\n\n{contract_date}\nТурист: {client_fio}' },
  { title: 'Изменение времени чартерного рейса', short: 'Время вылета чартера может измениться, это не нарушение договора', when: 'pkg', body: 'РАСПИСКА\n\nЯ, {client_fio}, уведомлён(а), что время вылета чартерных и блочных рейсов может быть изменено перевозчиком. Изменение времени вылета не является нарушением договора со стороны {company_name}.\n\n{contract_date}\nТурист: {client_fio}' },
  { title: 'Выезд несовершеннолетнего', short: 'Нотариальное согласие второго родителя и документы ребёнка — на родителях', when: 'kids', body: 'РАСПИСКА\n\nЯ, {client_fio}, подтверждаю, что для выезда несовершеннолетнего в поездку «{tour_name}» самостоятельно оформляю нотариальное согласие второго родителя и все необходимые документы. Ответственность за отказ во въезде или выезде из-за документов несу сам(а).\n\n{contract_date}\nТурист: {client_fio}' },
]

type Db = PrismaClient | ScopedDb

/** Creates stages with requirements and document templates. Returns stage ids per pipeline and requirement ids by key. */
export async function createOrgDefaults(db: Db, organizationId: string) {
  const reqIds: Record<string, string> = {}
  const stageIds: Record<string, string[]> = {}
  const templateIds: Record<string, string> = {}
  for (const [pipe, stages] of Object.entries(META)) {
    stageIds[pipe] = []
    let order = 0
    for (const [name, meta] of Object.entries(stages)) {
      const stage = await (db as PrismaClient).stage.create({
        data: {
          organizationId, pipeline: PIPE[pipe]!, order, name, description: meta.desc,
          requirements: { create: meta.reqs.map((r, i) => ({ key: r.id, label: r.label, required: r.req, order: i, ...mapReq(r), config: mapReq(r).config as object })) },
        },
        include: { requirements: true },
      })
      for (const r of stage.requirements) reqIds[r.key!] = r.id
      stageIds[pipe].push(stage.id)
      order++
    }
  }
  for (const t of CONTRACT_TEMPLATES) {
    const r = await (db as PrismaClient).documentTemplate.create({ data: { organizationId, kind: 'contract', name: t.name, pipeline: PIPE[t.pipe], body: t.body, variables: bindVariables(t.body) as object[] } })
    templateIds[t.id] = r.id
  }
  for (const t of RECEIPTS) {
    await (db as PrismaClient).documentTemplate.create({ data: { organizationId, kind: 'receipt', name: t.title, short: t.short, condition: t.when, body: t.body, variables: bindVariables(t.body) as object[] } })
  }
  return { reqIds, stageIds, templateIds }
}
