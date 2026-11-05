import { tourSearch } from '../../../providers/tourSearch'

export default defineEventHandler(async (event) => {
  await requireAuth(event, 'package')
  return tourSearch().poll(getRouterParam(event, 'id')!)
})
