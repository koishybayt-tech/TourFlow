import type { AuthContext } from '../utils/auth'

/** Sets a regulation value/check in the package pipeline by matching the requirement label. */
export async function setPackageRequirement(ctx: AuthContext, dealId: string, kind: 'value' | 'check' | 'comment', labelRe: RegExp, value: string | boolean) {
  const reqs = await ctx.db.stage.findMany({ where: { pipeline: 'PACKAGE' }, include: { requirements: true } })
  const type = kind === 'value' ? 'FIELD' : kind === 'check' ? 'CHECK' : 'COMMENT'
  const req = reqs.flatMap(s => s.requirements).find(r => r.type === type && labelRe.test(r.label) && (type !== 'FIELD' || !(r.config as { field?: string }).field))
  if (!req) return
  const deal = await ctx.db.deal.findFirstOrThrow({ where: { id: dealId } })
  const col = kind === 'value' ? 'reqValues' : kind === 'check' ? 'reqChecks' : 'reqComments'
  await ctx.db.deal.update({ where: { id: dealId }, data: { [col]: { ...(deal[col] as object), [req.id]: value } } })
}
