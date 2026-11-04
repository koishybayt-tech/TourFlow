import { describe, expect, it } from 'vitest'
import {
  autoAdvanceTarget, isRequirementDone, participantStep, stageProgress, suggestStageOnPipelineChange,
  type DealSnapshot, type StageDef,
} from '../../shared/domain/dealStatus'

const stages: StageDef[] = [
  { id: 's3', order: 3, name: 'Договор', description: '', requirements: [
    { id: 'g3c', type: 'CLIENT', label: 'Данные клиента', required: true, config: {} },
    { id: 'g3a', type: 'SIGN', label: 'Договор подписан', required: true, config: {} },
  ] },
  { id: 's4', order: 4, name: 'Предоплата', description: '', requirements: [
    { id: 'g4a', type: 'PAY', label: 'Предоплата', required: true, config: { mode: 'prepay', perPerson: 100_000 } },
    { id: 'g4b', type: 'EVENT', label: 'Визовая запись', required: true, config: { eventType: 'visa' } },
    { id: 'g4c', type: 'DOC', label: 'Чек', required: false, config: { docType: 'Чек' } },
  ] },
  { id: 's5', order: 5, name: 'Виза', description: '', requirements: [
    { id: 'g5a', type: 'DOC', label: 'Скан визы', required: true, config: { docType: 'Виза' } },
  ] },
]

const base: DealSnapshot = {
  people: 1, price: 690_000, paid: 0, dates: '14–21 ноября', budget: null, visaHistory: 'Нет', departureId: 'p1',
  travelersCount: 1, travelersWithPassport: 1, docTypes: [], signed: false,
  client: { fullName: null, iin: false, address: null }, eventTypes: [],
  reqChecks: {}, reqComments: {}, reqValues: {}, openStageTasks: [],
}

describe('dealStatus', () => {
  it('Жанна Ким: «Договор» → «Предоплата» only after client data and signature', () => {
    const snap = (d: DealSnapshot) => () => d
    expect(autoAdvanceTarget(stages, 3, snap(base))).toBe(3)

    const withClient = { ...base, client: { fullName: 'Ким Жанна', iin: true, address: 'г. Алматы' } }
    expect(autoAdvanceTarget(stages, 3, snap(withClient))).toBe(3)

    const signed = { ...withClient, signed: true }
    expect(autoAdvanceTarget(stages, 3, snap(signed))).toBe(4)
  })

  it('advances several stages at once when data is already there, never past the last', () => {
    const all = { ...base, client: { fullName: 'A', iin: true, address: 'B' }, signed: true, paid: 100_000, eventTypes: ['visa'], docTypes: ['Виза'] }
    expect(autoAdvanceTarget(stages, 3, () => all)).toBe(5)
  })

  it('open manual tasks of the stage block the transition', () => {
    const d = { ...base, client: { fullName: 'A', iin: true, address: 'B' }, signed: true, openStageTasks: [{ id: 't', title: 'Позвонить' }] }
    const p = stageProgress(stages[0]!, d)
    expect(p.missing).toHaveLength(0)
    expect(p.complete).toBe(false)
    expect(autoAdvanceTarget(stages, 3, () => d)).toBe(3)
  })

  it('prepay is per person; optional requirements do not block', () => {
    const r = stages[1]!.requirements[0]!
    expect(isRequirementDone(r, { ...base, people: 2, paid: 100_000 })).toBe(false)
    expect(isRequirementDone(r, { ...base, people: 2, paid: 200_000 })).toBe(true)
    const p = stageProgress(stages[1]!, { ...base, paid: 100_000, eventTypes: ['visa'] })
    expect(p.complete).toBe(true)
    expect(p.totalCount).toBe(2)
  })

  it('full pay needs a price', () => {
    const full = { id: 'x', type: 'PAY' as const, label: '', required: true, config: { mode: 'full' as const } }
    expect(isRequirementDone(full, { ...base, price: 0, paid: 10 })).toBe(false)
    expect(isRequirementDone(full, { ...base, paid: 690_000 })).toBe(true)
  })

  it('fields treat «—» as empty; free fields use reqValues', () => {
    const budget = { id: 'g1a', type: 'FIELD' as const, label: '', required: true, config: { field: 'budget' } }
    expect(isRequirementDone(budget, { ...base, budget: '—' })).toBe(false)
    expect(isRequirementDone(budget, { ...base, budget: 'до 1 млн' })).toBe(true)
    const booking = { id: 'p3a', type: 'FIELD' as const, label: '', required: true, config: {} }
    expect(isRequirementDone(booking, { ...base, reqValues: { p3a: 'FS-2611043' } })).toBe(true)
  })

  it('travelers need count ≥ people and passports', () => {
    const r = { id: 'g2a', type: 'TRAVELERS' as const, label: '', required: true, config: {} }
    expect(isRequirementDone(r, { ...base, people: 2, travelersCount: 1 })).toBe(false)
    expect(isRequirementDone(r, { ...base, people: 2, travelersCount: 2, travelersWithPassport: 1 })).toBe(false)
    expect(isRequirementDone(r, { ...base, people: 2, travelersCount: 2, travelersWithPassport: 2 })).toBe(true)
  })

  it('participant step mapping (visa / no visa)', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(i => participantStep(i, true))).toEqual([0, 0, 1, 2, 3, 5, 6, 7])
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(i => participantStep(i, false))).toEqual([0, 0, 0, 1, 2, 2, 3, 4])
    expect(participantStep(2, false, true)).toBe(4)
  })

  it('pipeline change suggests same-named or proportional stage', () => {
    const group = ['Новая', 'Консультация', 'Визовая проверка', 'Договор', 'Предоплата', 'Виза', 'Полная оплата', 'Готов к выезду']
    const pkg = ['Новая', 'Подбор', 'Предложение отправлено', 'Бронь у оператора', 'Оплата', 'Документы выданы']
    expect(suggestStageOnPipelineChange(group, 0, pkg)).toBe(0)
    expect(suggestStageOnPipelineChange(group, 7, pkg)).toBe(5)
    expect(suggestStageOnPipelineChange(group, 3, pkg)).toBe(2)
  })
})
