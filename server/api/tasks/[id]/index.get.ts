import { isRequirementDone } from '#shared/domain/dealStatus'
import { dealSnapshot, loadStages } from '../../../services/deals'
import { requirementSection } from '../../../services/dealView'
import { accessibleTask } from '../../../services/tasks'

/** Task card. System tasks include the stage regulation with live requirement states. */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'tasks')
  const t0 = await accessibleTask(ctx, getRouterParam(event, 'id')!)
  const t = await ctx.db.task.findFirstOrThrow({
    where: { id: t0.id },
    include: {
      assignee: { include: { user: { select: { name: true } } } },
      author: { include: { user: { select: { name: true } } } },
      deal: { select: { id: true, number: true, title: true, pipeline: true, stageId: true, client: { select: { name: true } } } },
      departure: { select: { id: true, name: true } },
      stage: true,
    },
  })
  let regulation = null
  if (t.deal && t.stageId) {
    const stages = await loadStages(ctx.db, t.deal.pipeline)
    const stage = stages.find(s => s.id === t.stageId)
    if (stage) {
      const { forStage } = await dealSnapshot(ctx.db, t.deal.id)
      const snap = forStage(stage.id)
      const next = stages.find(s => s.order === stage.order + 1)
      regulation = {
        stageName: stage.name,
        description: stage.description,
        isCurrent: t.deal.stageId === stage.id,
        nextStage: next?.name ?? null,
        requirements: stage.requirements.map(r => ({ id: r.id, type: r.type, label: r.label, required: r.required, done: isRequirementDone(r, snap), section: requirementSection(r), value: (r.type === 'COMMENT' ? snap.reqComments[r.id] : r.type === 'FIELD' && !r.config.field ? snap.reqValues[r.id] : undefined) ?? null })),
      }
    }
  }
  return {
    id: t.id, title: t.title, description: t.description, status: t.status, priority: t.priority, dueAt: t.dueAt, isSystem: t.isSystem, result: t.result,
    assigneeId: t.assigneeId, assignee: t.assignee?.user.name ?? null, author: t.author?.user.name ?? (t.authorId ? null : 'Система'),
    deal: t.deal ? { id: t.deal.id, number: t.deal.number, title: t.deal.title, client: t.deal.client.name } : null,
    departure: t.departure, stageId: t.stageId, stage: t.stage?.name ?? null,
    subtasks: t.subtasks as { t: string, done: boolean }[], log: t.log as { at: string, text: string, actor: string }[],
    createdAt: t.createdAt, completedAt: t.completedAt, regulation,
  }
})
