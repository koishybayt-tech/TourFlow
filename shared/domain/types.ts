export type Pipeline = 'GROUP' | 'PACKAGE' | 'BASE'
export type Channel = 'WHATSAPP' | 'INSTAGRAM' | 'SITE' | 'MANUAL' | 'CALL' | 'OFFICE' | 'REFERRAL'
export type RequirementType = 'FIELD' | 'DOC' | 'SIGN' | 'PAY' | 'COMMENT' | 'CHECK' | 'DEPARTURE' | 'TRAVELERS' | 'EVENT' | 'CLIENT'

export const PIPELINES: Pipeline[] = ['GROUP', 'PACKAGE', 'BASE']

export const PIPELINE_LABELS: Record<Pipeline, string> = {
  GROUP: 'Групповые туры',
  PACKAGE: 'Пакетные туры',
  BASE: 'Базовая',
}

export const CHANNEL_LABELS: Record<Channel, string> = {
  WHATSAPP: 'WhatsApp',
  INSTAGRAM: 'Instagram',
  SITE: 'Сайт',
  MANUAL: 'Вручную',
  CALL: 'Звонок',
  OFFICE: 'Офис',
  REFERRAL: 'Рекомендация',
}

export const LOST_REASONS = [
  'Не устроила цена',
  'Выбрал другое агентство',
  'Не выходит на связь',
  'Передумал',
  'Отказ в визе',
  'Другое',
] as const

export const PAYMENT_METHODS = ['Kaspi', 'Наличные', 'Карта', 'Перевод на счёт'] as const
export const PAYMENT_TYPES = ['Предоплата', 'Доплата', 'Полная оплата', 'Возврат'] as const

export const DOC_TYPES = ['Паспорт', 'Виза', 'Договор', 'Подписанный договор', 'Расписка', 'Ваучер', 'Авиабилет', 'Страховой полис', 'Чек', 'Другое'] as const
