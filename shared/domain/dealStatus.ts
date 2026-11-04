import type { RequirementType } from './types'

/**
 * Stage regulation logic (docs/02_FEATURES.md §5.1).
 * A requirement is "done" when the deal data satisfies it. Only CHECK and COMMENT
 * are stored as flags; everything else is computed from the deal snapshot.
 */

export interface RequirementDef {
  id: string
  type: RequirementType
  label: string
  required: boolean
  config: RequirementConfig
}

export interface RequirementConfig {
  /** FIELD: a deal column (dates, people, budget, visaHistory, price) or omitted for a free value in reqValues. */
  field?: string
  /** DOC: document type prefix, e.g. "Паспорт". */
  docType?: string
  /** PAY: prepay (per person) or full. */
  mode?: 'prepay' | 'full'
  perPerson?: number
  /** EVENT: calendar event type, default "visa". */
  eventType?: string
}

export interface StageDef {
  id: string
  name: string
  order: number
  description: string
  requirements: RequirementDef[]
}

export interface DealSnapshot {
  people: number
  price: number
  paid: number
  dates?: string | null
  budget?: string | null
  visaHistory?: string | null
  departureId?: string | null
  travelersCount: number
  /** Travelers with passport number filled in. */
  travelersWithPassport: number
  docTypes: string[]
  signed: boolean
  client: { fullName?: string | null, iin?: boolean | null, address?: string | null }
  eventTypes: string[]
  reqChecks: Record<string, boolean>
  reqComments: Record<string, string>
  reqValues: Record<string, string>
  /** Manual (non-system) tasks linked to the current stage that are still open. */
  openStageTasks: { id: string, title: string }[]
}

const EMPTY_VALUES = new Set(['', '—', '-', 'Не назначен'])

function filled(v: unknown): boolean {
  if (v === null || v === undefined) return false
  if (typeof v === 'number') return v > 0
  return !EMPTY_VALUES.has(String(v).trim())
}

export function isRequirementDone(req: RequirementDef, d: DealSnapshot): boolean {
  const c = req.config ?? {}
  switch (req.type) {
    case 'FIELD': {
      if (!c.field) return filled(d.reqValues[req.id])
      const value = (d as unknown as Record<string, unknown>)[c.field]
      return filled(value)
    }
    case 'DOC':
      return !!c.docType && d.docTypes.some(t => t.startsWith(c.docType!))
    case 'SIGN':
      return d.signed || d.docTypes.some(t => t.startsWith('Подписанный договор'))
    case 'PAY':
      if (c.mode === 'prepay') return d.paid >= (c.perPerson ?? 100_000) * Math.max(1, d.people)
      return d.price > 0 && d.paid >= d.price
    case 'COMMENT':
      return filled(d.reqComments[req.id])
    case 'CHECK':
      return d.reqChecks[req.id] === true
    case 'DEPARTURE':
      return !!d.departureId
    case 'TRAVELERS':
      return d.travelersCount > 0 && d.travelersCount >= d.people && d.travelersWithPassport >= d.travelersCount
    case 'EVENT':
      return d.eventTypes.includes(c.eventType ?? 'visa')
    case 'CLIENT':
      return filled(d.client.fullName) && !!d.client.iin && filled(d.client.address)
    default:
      return false
  }
}

export interface StageProgress {
  done: RequirementDef[]
  missing: RequirementDef[]
  /** Required requirements done / total required. */
  doneCount: number
  totalCount: number
  openTasks: { id: string, title: string }[]
  complete: boolean
}

export function stageProgress(stage: StageDef, d: DealSnapshot): StageProgress {
  const required = stage.requirements.filter(r => r.required)
  const done = stage.requirements.filter(r => isRequirementDone(r, d))
  const missing = required.filter(r => !isRequirementDone(r, d))
  return {
    done,
    missing,
    doneCount: required.length - missing.length,
    totalCount: required.length,
    openTasks: d.openStageTasks,
    complete: missing.length === 0 && d.openStageTasks.length === 0,
  }
}

/**
 * Returns the order of the stage the deal should be on after auto-advance.
 * Advances while the current stage is complete; never moves past the last stage
 * (the last stage is finished by the manager with «Завершить заявку»).
 * `snapshotFor(stage)` lets the caller supply stage-specific data (open tasks of that stage).
 */
export function autoAdvanceTarget(
  stages: StageDef[],
  currentOrder: number,
  snapshotFor: (stage: StageDef) => DealSnapshot,
): number {
  const sorted = [...stages].sort((a, b) => a.order - b.order)
  let idx = sorted.findIndex(s => s.order === currentOrder)
  if (idx < 0) return currentOrder
  while (idx < sorted.length - 1) {
    const stage = sorted[idx]!
    if (!stageProgress(stage, snapshotFor(stage)).complete) break
    idx++
  }
  return sorted[idx]!.order
}

/**
 * Participant step for a group departure, derived from the deal stage index (docs/03 «Сиды»).
 * Visa tours use 8 steps, non-visa tours 5 steps.
 */
export const VISA_STEPS = ['Проверка визовой записи', 'Согласование документов', 'Договор', 'Предоплата', 'Запись на визу', 'Ожидание визы (~14 дн.)', 'Проверка визы', 'Готов'] as const
export const NOVISA_STEPS = ['Бронь места', 'Договор', 'Предоплата', 'Полная оплата', 'Готов'] as const
const VISA_MAP = [0, 0, 1, 2, 3, 5, 6, 7]
const NOVISA_MAP = [0, 0, 0, 1, 2, 2, 3, 4]

export function participantStep(stageIndex: number, visa: boolean, won = false): number {
  const map = visa ? VISA_MAP : NOVISA_MAP
  if (won) return map[map.length - 1]!
  return map[Math.max(0, Math.min(stageIndex, map.length - 1))]!
}

export function participantReady(step: number, visa: boolean): boolean {
  return step >= (visa ? VISA_STEPS.length : NOVISA_STEPS.length) - 1
}

/** When switching pipelines: same-named stage, otherwise proportional position. */
export function suggestStageOnPipelineChange(fromNames: string[], fromIndex: number, toNames: string[]): number {
  const same = toNames.indexOf(fromNames[fromIndex] ?? '')
  if (same >= 0) return same
  if (fromNames.length <= 1) return 0
  return Math.round((fromIndex / (fromNames.length - 1)) * (toNames.length - 1))
}
