import type { Permission } from '#shared/permissions'

/** definePageMeta({ middleware: 'role', permission: 'reports' }) */
export default defineNuxtRouteMiddleware((to) => {
  const perm = to.meta.permission as Permission | undefined
  if (!perm) return
  const { can } = usePermissions()
  if (!can(perm)) {
    return abortNavigation(createError({ statusCode: 403, statusMessage: 'Раздел недоступен для вашей роли' }))
  }
})
