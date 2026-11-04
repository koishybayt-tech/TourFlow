<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const { t } = useI18n()
const { can, module } = usePermissions()
const { me } = useMe()
const { data: badges, refresh: refreshBadges } = useFetch('/api/badges', { key: 'badges', default: () => ({ inbox: 0, tasks: 0, departures: 0, notifications: 0 }) })
const route = useRoute()
watch(() => route.fullPath, () => refreshBadges())
useIntervalFn(() => refreshBadges(), 60_000)

const open = ref(false)

function badge(n: number | undefined, color: 'primary' | 'error' | 'warning' = 'primary') {
  return n ? { label: String(n), color, variant: 'subtle' as const, size: 'sm' as const } : undefined
}

const items = computed<NavigationMenuItem[][]>(() => {
  const b = badges.value
  const core: NavigationMenuItem[] = [
    { label: t('nav.home'), icon: 'i-lucide-sun', to: '/', exact: true },
    can('inbox') && { label: t('nav.inbox'), icon: 'i-lucide-message-circle', to: '/inbox', badge: badge(b.inbox) },
    can('deals') && { label: t('nav.deals'), icon: 'i-lucide-kanban-square', to: '/deals' },
    can('tasks') && { label: t('nav.tasks'), icon: 'i-lucide-check-square', to: '/tasks', badge: badge(b.tasks, 'error') },
    can('calendar') && { label: t('nav.calendar'), icon: 'i-lucide-calendar-days', to: '/calendar' },
    can('clients') && { label: t('nav.clients'), icon: 'i-lucide-users', to: '/clients' },
  ].filter(Boolean) as NavigationMenuItem[]

  const groups: NavigationMenuItem[][] = [core]
  if (module('group') && (can('tours') || can('departures'))) {
    groups.push([
      { label: t('nav.groupTours'), type: 'label' },
      can('tours') && { label: t('nav.tours'), icon: 'i-lucide-map', to: '/tours' },
      can('departures') && { label: t('nav.departures'), icon: 'i-lucide-bus', to: '/departures', badge: badge(b.departures, 'warning') },
      can('guides') && { label: t('nav.guides'), icon: 'i-lucide-flag', to: '/guides' },
    ].filter(Boolean) as NavigationMenuItem[])
  }
  if (module('package') && can('package')) {
    groups.push([
      { label: t('nav.packageTours'), type: 'label' },
      { label: t('nav.packageSearch'), icon: 'i-lucide-search', to: '/package/search' },
      { label: t('nav.bookings'), icon: 'i-lucide-ticket', to: '/package/bookings' },
    ])
  }
  const tail = [
    can('reports') && { label: t('nav.reports'), icon: 'i-lucide-bar-chart-3', to: '/reports' },
    module('tickets') && can('tickets') && { label: t('nav.tickets'), icon: 'i-lucide-plane', to: '/tickets' },
    can('settings') && { label: t('nav.settings'), icon: 'i-lucide-settings', to: '/settings' },
  ].filter(Boolean) as NavigationMenuItem[]
  if (tail.length) groups.push(tail)
  return groups
})

// Global search (⌘K)
const searchTerm = ref('')
const { data: found, status: searchStatus } = useFetch('/api/search', { query: { q: searchTerm }, default: () => ({ clients: [], deals: [], departures: [] }), watch: [refDebounced(searchTerm, 250)], immediate: false })
const searchGroups = computed(() => {
  const g = [
    { id: 'deals', label: 'Заявки', items: found.value.deals.map(x => ({ ...x, icon: 'i-lucide-kanban-square' })), ignoreFilter: true },
    { id: 'clients', label: 'Клиенты', items: found.value.clients.map(x => ({ ...x, icon: 'i-lucide-user' })), ignoreFilter: true },
    { id: 'departures', label: 'Выезды', items: found.value.departures.map(x => ({ ...x, icon: 'i-lucide-bus' })), ignoreFilter: true },
  ].filter(x => x.items.length)
  const nav = items.value.flat().filter(i => i.to && i.type !== 'label').map(i => ({ label: String(i.label), icon: i.icon, to: i.to }))
  return [...g, { id: 'nav', label: 'Перейти', items: nav }]
})
</script>

<template>
  <UDashboardGroup
    unit="rem"
    storage="local"
  >
    <UDashboardSidebar
      v-model:open="open"
      collapsible
      resizable
      :min-size="14"
      :default-size="16"
      :max-size="22"
      class="bg-(--ui-bg-elevated)"
      :ui="{ footer: 'border-t border-(--ui-border)' }"
    >
      <template #header="{ collapsed }">
        <NuxtLink
          to="/"
          class="flex items-center gap-2 min-w-0"
        >
          <span class="size-7 shrink-0 rounded-lg bg-(--ui-primary) grid place-items-center text-white font-semibold text-sm">T</span>
          <span
            v-if="!collapsed"
            class="font-semibold truncate"
          >{{ me?.org.name || $t('app.name') }}</span>
        </NuxtLink>
      </template>

      <template #default="{ collapsed }">
        <UDashboardSearchButton
          :collapsed="collapsed"
          label="Поиск"
          class="bg-transparent ring-(--ui-border)"
        />
        <UNavigationMenu
          v-for="(group, i) in items"
          :key="i"
          :collapsed="collapsed"
          :items="group"
          orientation="vertical"
          tooltip
          popover
        />
      </template>

      <template #footer="{ collapsed }">
        <UserMenu :collapsed="collapsed" />
      </template>
    </UDashboardSidebar>

    <UDashboardSearch
      v-model:search-term="searchTerm"
      :groups="searchGroups"
      :loading="searchStatus === 'pending'"
      placeholder="Клиент, телефон, заявка, выезд…"
      :color-mode="false"
    />

    <slot />
  </UDashboardGroup>
</template>
