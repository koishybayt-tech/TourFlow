import type { Pipeline, RequirementType } from '#shared/domain/types'

export interface ReqView {
  id: string
  type: RequirementType
  label: string
  required: boolean
  config: { field?: string, docType?: string, mode?: 'prepay' | 'full', perPerson?: number, eventType?: string }
  done: boolean
  section: string
}
export interface Advanced { moved: boolean, from: string, to: string }

export interface DealView {
  deal: {
    id: string
    number: number
    pipeline: Pipeline
    title: string
    dates: string | null
    people: number
    budget: string | null
    visaHistory: string | null
    price: number
    fullPayDeadline: string | null
    source: string
    createdAt: string
    wonAt: string | null
    lostAt: string | null
    lostReason: string | null
    lostComment: string | null
    managerId: string | null
    manager: string | null
    direction: { id: string, name: string } | null
    reqChecks: Record<string, boolean>
    reqComments: Record<string, string>
    reqValues: Record<string, string>
  }
  client: { id: string, name: string, phone: string, email: string | null, fullName: string | null, iinMasked: string | null, hasIin: boolean, birthDate: string | null, address: string | null, pdConsentAt: string | null }
  travelers: { id: string, fullNameLatin: string, passportMasked: string | null, hasPassport: boolean, passportExpiry: string | null, expiryWarn: boolean, birthDate: string | null, isChild: boolean, childAge: number | null, visaStatus: string | null }[]
  departure: { id: string, name: string, dates: string, price: number, visa: boolean, guide: string | null, payDeadline: string } | null
  departures: { id: string, label: string, price: number }[]
  stages: { id: string, name: string, order: number, description: string, requirements: ReqView[] }[]
  status: { stageId: string, stageName: string, order: number, total: number, description: string, requirements: ReqView[], doneCount: number, totalCount: number, openTasks: { id: string, title: string }[], complete: boolean, isLast: boolean }
  money: { price: number, paid: number, debt: number, payments: { id: string, amount: number, type: string, method: string, comment: string | null, paidAt: string }[], deadline: string | null } | null
  contracts: { id: string, number: string, kind: string, template: string, status: 'NONE' | 'SENT' | 'SIGNED' | 'PAPER', createdAt: string, annulledAt: string | null, emptyFields: string[], fileKey: string | null, signatures: { id: string, side: string, token: string, signerName: string | null, method: string | null, signedAt: string | null }[] }[]
  receipts: { id: string, name: string, short: string | null, condition: string | null, recommended: boolean, contractId: string | null, status: string | null }[]
  documents: { id: string, type: string, name: string, size: number | null, createdAt: string }[]
  calendar: { id: string, type: string, title: string, startAt: string, place: string | null, who: string | null }[]
  tasks: { id: string, title: string, status: 'TODO' | 'IN_PROGRESS' | 'DONE', priority: 'HIGH' | 'MEDIUM' | 'LOW', dueAt: string | null, isSystem: boolean, assignee: string | null, stage: string | null, stageId: string | null }[]
  offers: { id: string, operatorId: string, operator: string, commissionPct: number, hotel: string, stars: number, resort: string, fromDate: string, toDate: string, meal: string, room: string, flight: boolean, transfer: boolean, insurance: boolean, net: number | null, price: number, status: 'DRAFT' | 'SENT' | 'CHOSEN' | 'REJECTED', note: string | null, source: string | null, externalRef: string | null }[]
  bookings: { id: string, offerId: string, operator: string, hotel: string, number: string | null, status: 'REQUEST' | 'CONFIRMED' | 'PAID' | 'CANCELLED', comment: string | null, createdAt: string, confirmedAt: string | null, paymentDeadline: string, net: number | null, paid: number | null, cancelReason: string | null, penalty: number | null, payments: { id: string, amount: number, method: string, paidAt: string }[] }[]
  chat: { id: string, channel: string, messages: { id: string, direction: string, text: string, sentAt: string }[] } | null
  otherDeals: { id: string, number: number, title: string, status: string, stage: string, price: number | null, paid: number | null }[]
  notes: { id: string, text: string, author: string, createdAt: string }[]
  history: { id: string, at: string, text: string, actor: string, kind: string }[]
  historyCount: number
}

export type DealChanged = (r?: { advanced?: Advanced | null } | null) => void
