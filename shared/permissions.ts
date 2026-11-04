/** Role permissions. The server checks them in every endpoint; the UI only hides what is not allowed. */
export type Role = 'OWNER' | 'MANAGER' | 'CALLCENTER' | 'GUIDE'

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: 'Владелец',
  MANAGER: 'Менеджер',
  CALLCENTER: 'Колл-центр',
  GUIDE: 'Гид',
}

export type Permission
  = | 'inbox' | 'deals' | 'deals.all' | 'deals.reassign' | 'payments' | 'documents' | 'tasks' | 'calendar' | 'clients'
    | 'tours' | 'tours.finance' | 'departures' | 'guides' | 'package' | 'tickets' | 'reports' | 'settings'

const MATRIX: Record<Permission, Role[]> = {
  'inbox': ['OWNER', 'MANAGER', 'CALLCENTER'],
  'deals': ['OWNER', 'MANAGER', 'CALLCENTER'],
  'deals.all': ['OWNER', 'CALLCENTER'],
  'deals.reassign': ['OWNER'],
  'payments': ['OWNER', 'MANAGER'],
  'documents': ['OWNER', 'MANAGER'],
  'tasks': ['OWNER', 'MANAGER', 'CALLCENTER'],
  'calendar': ['OWNER', 'MANAGER', 'CALLCENTER', 'GUIDE'],
  'clients': ['OWNER', 'MANAGER', 'CALLCENTER'],
  'tours': ['OWNER', 'MANAGER'],
  'tours.finance': ['OWNER'],
  'departures': ['OWNER', 'MANAGER', 'GUIDE'],
  'guides': ['OWNER', 'MANAGER'],
  'package': ['OWNER', 'MANAGER'],
  'tickets': ['OWNER', 'MANAGER'],
  'reports': ['OWNER'],
  'settings': ['OWNER'],
}

export function can(role: Role | null | undefined, perm: Permission): boolean {
  return !!role && MATRIX[perm].includes(role)
}

export interface Modules {
  group: boolean
  package: boolean
  tickets: boolean
  team: boolean
  migration: boolean
}

export const DEFAULT_MODULES: Modules = { group: true, package: false, tickets: true, team: false, migration: false }

export const MODULE_INFO: { key: keyof Modules, title: string, description: string }[] = [
  { key: 'group', title: 'Групповые туры', description: 'Мои туры (конструктор), выезды, участники, гиды' },
  { key: 'package', title: 'Пакетные туры', description: 'Поиск туров, подборки, брони у туроператоров, туроператоры' },
  { key: 'tickets', title: 'Авиабилеты и отели', description: 'Отдельный поиск по нескольким источникам, мониторинг цен' },
  { key: 'team', title: 'Команда и распределение', description: 'Направления → ответственные, отпуска, очередь' },
  { key: 'migration', title: 'Миграция с Битрикс24', description: 'Импорт лидов, сделок, контактов' },
]
