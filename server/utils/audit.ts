import { prisma } from './prisma'

/**
 * Audit log for sensitive actions, including every view of decrypted IIN or passport data.
 * Rows are append-only.
 */
export async function audit(entry: { organizationId: string, userId?: string | null, action: string, entity: string, entityId: string, meta?: Record<string, unknown> }) {
  await prisma.auditLog.create({
    data: {
      organizationId: entry.organizationId,
      userId: entry.userId ?? null,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      meta: (entry.meta ?? undefined) as object | undefined,
    },
  })
}
