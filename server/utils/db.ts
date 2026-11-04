import { prisma } from './prisma'

/**
 * Multi-tenancy: a Prisma client extension that adds organizationId to every query
 * on tenant models. Child tables without organizationId (Message, TourDay, …) are
 * reached through their parents, which are scoped.
 */
const TENANT_MODELS = new Set([
  'Member', 'Invite', 'Client', 'Traveler', 'Direction', 'Stage', 'Deal', 'Payment', 'DealEvent', 'Note',
  'Conversation', 'Task', 'Event', 'DocumentTemplate', 'Document', 'Contract', 'Departure', 'Participant',
  'Guide', 'Tour', 'Operator', 'Offer', 'OperatorBooking', 'PriceWatch', 'Notification', 'AuditLog',
])

const WHERE_OPS = new Set([
  'findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany',
  'count', 'aggregate', 'groupBy', 'update', 'updateMany', 'delete', 'deleteMany',
])

export function scopedDb(organizationId: string) {
  return prisma.$extends({
    name: 'tenant',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.has(model)) return query(args)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma args differ per operation
          const a = (args ?? {}) as Record<string, any>
          if (WHERE_OPS.has(operation)) {
            a.where = { ...(a.where ?? {}), organizationId }
          }
          else if (operation === 'create') {
            a.data = { ...(a.data ?? {}), organizationId }
          }
          else if (operation === 'createMany' || operation === 'createManyAndReturn') {
            const rows = Array.isArray(a.data) ? a.data : [a.data]
            a.data = rows.map((r: object) => ({ ...r, organizationId }))
          }
          else if (operation === 'upsert') {
            a.where = { ...(a.where ?? {}), organizationId }
            a.create = { ...(a.create ?? {}), organizationId }
          }
          return query(a)
        },
      },
    },
  })
}

export type ScopedDb = ReturnType<typeof scopedDb>
