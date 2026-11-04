import type { Modules, Permission, Role } from '#shared/permissions'
import { can } from '#shared/permissions'

export interface MeMember { id: string, name: string, email: string, role: Role, onVacation: boolean, signRight: boolean }
export interface Me {
  user: { id: string, name: string, email: string, phone: string | null, position: string | null, telegramChatId: string | null }
  member: { id: string, role: Role }
  org: { id: string, name: string, city: string, modules: Modules }
  members: MeMember[]
}

/** Current user, organization and team. Loaded once per session; call refresh() after changes. */
export function useMe() {
  const me = useState<Me | null>('me', () => null)
  async function refresh() {
    me.value = await useRequestFetch()<Me>('/api/me').catch(() => null)
    return me.value
  }
  return { me, refresh }
}

export function usePermissions() {
  const { me } = useMe()
  const role = computed(() => me.value?.member.role ?? null)
  return {
    role,
    can: (perm: Permission) => can(role.value, perm),
    module: (key: keyof Modules) => !!me.value?.org.modules[key],
    isOwner: computed(() => role.value === 'OWNER'),
  }
}

export function memberName(id: string | null | undefined): string {
  const { me } = useMe()
  return me.value?.members.find(m => m.id === id)?.name ?? 'Не назначен'
}
