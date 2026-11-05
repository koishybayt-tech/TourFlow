import { searchSchema } from '#shared/schemas/package'
import { tourSearch } from '../../providers/tourSearch'

export default defineEventHandler(async (event) => {
  await requireAuth(event, 'package')
  const q = await body(event, searchSchema)
  if (q.nightsTo < q.nightsFrom) throw createError({ statusCode: 422, statusMessage: 'Ночей «до» меньше, чем «от»' })
  return { id: await tourSearch().start(q) }
})
