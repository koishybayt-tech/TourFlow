import { detectDirection, detectPipeline, pickManager, type DirectionDef, type RoutingSettings } from '#shared/domain/routing'
import type { Channel } from '#shared/domain/types'
import type { AuthContext } from '../utils/auth'
import { prisma } from '../utils/prisma'

export async function loadRouting(organizationId: string): Promise<{ settings: RoutingSettings, defaultManagerId: string | null }> {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { routing: true, defaultManagerId: true } })
  const r = (org.routing ?? {}) as Partial<RoutingSettings>
  return {
    settings: {
      channels: r.channels ?? {},
      keywords: { GROUP: r.keywords?.GROUP ?? [], PACKAGE: r.keywords?.PACKAGE ?? [], BASE: r.keywords?.BASE ?? [] },
      links: r.links ?? [],
      fallback: r.fallback ?? 'queue',
    },
    defaultManagerId: org.defaultManagerId,
  }
}

export async function loadDirections(db: AuthContext['db']): Promise<DirectionDef[]> {
  const rows = await db.direction.findMany({ orderBy: { order: 'asc' } })
  return rows.map(d => ({ id: d.id, name: d.name, keywords: d.keywords, managerIds: d.managerIds, mode: d.mode as 'single' | 'round', backupId: d.backupId, rrIndex: d.rrIndex }))
}

/** Full routing suggestion for a text: pipeline, direction and responsible manager (without persisting round-robin). */
export async function suggestRouting(ctx: Pick<AuthContext, 'organizationId' | 'db'>, text: string, channel: Channel) {
  const [{ settings, defaultManagerId }, directions, members] = await Promise.all([
    loadRouting(ctx.organizationId),
    loadDirections(ctx.db),
    ctx.db.member.findMany({ where: { active: true }, include: { user: { select: { name: true } } } }),
  ])
  const pipeline = detectPipeline(text, channel, settings)
  const dir = detectDirection(text, directions)
  const vacation = new Set(members.filter(m => m.onVacation).map(m => m.id))
  const pick = pickManager(dir?.direction ?? null, id => vacation.has(id), defaultManagerId)
  const name = (id: string | null) => members.find(m => m.id === id)?.user.name ?? null
  return {
    pipeline,
    direction: dir ? { id: dir.direction.id, name: dir.direction.name, matched: dir.matched } : null,
    manager: { id: pick.managerId, name: name(pick.managerId), reason: pick.reason },
    rrIndex: pick.rrIndex,
  }
}

/** Picks the manager and persists the round-robin pointer. */
export async function assignManager(ctx: Pick<AuthContext, 'organizationId' | 'db'>, text: string, channel: Channel) {
  const s = await suggestRouting(ctx, text, channel)
  if (s.direction && s.manager.reason === 'round') {
    await ctx.db.direction.update({ where: { id: s.direction.id }, data: { rrIndex: s.rrIndex } })
  }
  return s
}
