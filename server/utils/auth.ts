import type { H3Event } from 'h3'
import { can, type Permission, type Role } from '#shared/permissions'
import { scopedDb, type ScopedDb } from './db'
import { prisma } from './prisma'

export interface AuthContext {
  userId: string
  memberId: string
  organizationId: string
  role: Role
  name: string
  email: string
  db: ScopedDb
}

/** Loads the signed-in member (role is read from the database on every request). */
export async function requireAuth(event: H3Event, perm?: Permission): Promise<AuthContext> {
  const cached = event.context.auth as AuthContext | undefined
  let ctx = cached
  if (!ctx) {
    const session = await requireUserSession(event)
    const member = await prisma.member.findFirst({
      where: { id: session.memberId, organizationId: session.organizationId, active: true },
      include: { user: true },
    })
    if (!member) {
      await clearUserSession(event)
      throw createError({ statusCode: 401, statusMessage: 'Сессия истекла, войдите снова' })
    }
    ctx = {
      userId: member.userId,
      memberId: member.id,
      organizationId: member.organizationId,
      role: member.role as Role,
      name: member.user.name,
      email: member.user.email,
      db: scopedDb(member.organizationId),
    }
    event.context.auth = ctx
  }
  if (perm && !can(ctx.role, perm)) {
    throw createError({ statusCode: 403, statusMessage: 'Недостаточно прав' })
  }
  return ctx
}

/** Restricts deal queries for managers to their own deals. */
export function dealScope(ctx: AuthContext): { managerId?: string } {
  return can(ctx.role, 'deals.all') ? {} : { managerId: ctx.memberId }
}

export function notFound(what = 'Запись'): never {
  throw createError({ statusCode: 404, statusMessage: `${what} не найдена` })
}
