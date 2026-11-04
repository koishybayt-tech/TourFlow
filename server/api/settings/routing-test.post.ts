import { routingTestSchema } from '#shared/schemas/settings'
import { suggestRouting } from '../../services/routing'

/** «Проверить распределение»: what would happen with this message (nothing is saved). */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'settings')
  const { text, channel } = await body(event, routingTestSchema)
  return suggestRouting(ctx, text, channel)
})
