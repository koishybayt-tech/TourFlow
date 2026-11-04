const PUBLIC = ['/login', '/register', '/forgot', '/reset', '/invite']

export default defineNuxtRouteMiddleware(async (to) => {
  const isPublic = PUBLIC.includes(to.path) || to.path.startsWith('/t/') || to.path.startsWith('/s/')
  const { loggedIn } = useUserSession()
  if (!loggedIn.value) {
    if (isPublic) return
    return navigateTo({ path: '/login', query: to.fullPath !== '/' ? { next: to.fullPath } : {} })
  }
  if (['/login', '/register'].includes(to.path)) return navigateTo('/')
  if (isPublic) return
  const { me, refresh } = useMe()
  if (!me.value) await refresh()
  if (!me.value) {
    await useUserSession().clear()
    return navigateTo('/login')
  }
})
