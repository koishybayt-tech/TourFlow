import { describe, expect, it } from 'vitest'
import { BLANK, autoBind, bindVariables, extractPlaceholders, renderTemplate } from '../../shared/domain/templates'

const body = 'ДОГОВОР № {contract_no}\n{company_name}, БИН {company_bin}, и {client_fio}, ИИН {client_iin}, адрес: {client_address}. Турист: {client_fio}. {Странное_поле}'

describe('templates', () => {
  it('extracts placeholders with counts', () => {
    expect(extractPlaceholders(body)).toContainEqual({ placeholder: 'client_fio', count: 2 })
  })

  it('auto-binds prototype placeholders', () => {
    const cases: Record<string, string> = {
      contract_no: 'contract.number', contract_date: 'contract.date', company_name: 'company.name', company_bin: 'company.bin',
      company_director: 'company.director', client_fio: 'client.fullName', client_iin: 'client.iin', client_address: 'client.address',
      client_birth: 'client.birthDate', client_phone: 'client.phone', tour_name: 'trip.name', tour_dates: 'trip.dates',
      tourists_count: 'trip.people', tourists_list: 'trip.travelers', price_total: 'pay.total', prepayment: 'pay.prepay', paid: 'pay.paid',
      full_pay_deadline: 'pay.deadline', refund_rule: 'pay.refundRule', company_address: 'company.address', company_bank: 'company.bank',
      company_iik: 'company.iik', company_bik: 'company.bik', company_license: 'company.license', guide_name: 'trip.guide',
      hotel_name: 'trip.hotel', operator_name: 'trip.operator',
    }
    for (const [ph, field] of Object.entries(cases)) expect([ph, autoBind(ph)]).toEqual([ph, field])
    expect(autoBind('Странное_поле')).toBeNull()
  })

  it('renders and reports empty fields', () => {
    const vars = bindVariables(body)
    const r = renderTemplate(body, vars, { 'contract.number': 'ДТ-1', 'client.fullName': 'Ким Жанна' })
    expect(r.text).toContain('ДОГОВОР № ДТ-1')
    expect(r.text).toContain(`ИИН ${BLANK}`)
    expect(r.empty).toEqual(expect.arrayContaining(['client.iin', 'client.address', 'Странное_поле']))
  })
})
