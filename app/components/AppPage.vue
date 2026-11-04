<script setup lang="ts">
/** Page frame: navbar with title, actions, global search, notifications and the user. */
defineProps<{ title: string, subtitle?: string, id?: string, back?: string }>()
const { me } = useMe()
</script>

<template>
  <UDashboardPanel
    :id="id"
    :ui="{ body: 'px-6 lg:px-8 py-6 gap-6' }"
  >
    <template #header>
      <UDashboardNavbar :ui="{ root: 'px-6 lg:px-8 gap-3', right: 'gap-2' }">
        <template #leading>
          <UDashboardSidebarCollapse />
          <UButton
            v-if="back"
            :to="back"
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            size="sm"
            aria-label="Назад"
          />
        </template>
        <template #title>
          <span class="block min-w-0">
            <span class="block truncate text-[17px] font-semibold text-(--ui-text-highlighted)">{{ title }}</span>
            <span
              v-if="subtitle"
              class="block truncate text-xs text-(--ui-text-muted) font-normal"
            >{{ subtitle }}</span>
          </span>
        </template>
        <template #right>
          <slot name="actions" />
          <UDashboardSearchButton
            :collapsed="true"
            class="lg:hidden"
          />
          <NotificationsButton />
          <span class="hidden xl:flex items-center gap-2 pl-2 ml-1 border-l border-(--ui-border)">
            <UAvatar
              :text="initials(me?.user.name)"
              size="xs"
            />
            <span class="text-sm leading-tight">
              <span class="block font-medium">{{ me?.user.name }}</span>
              <span class="block text-xs text-(--ui-text-muted)">{{ me?.user.email }}</span>
            </span>
          </span>
        </template>
      </UDashboardNavbar>
      <slot name="toolbar" />
    </template>
    <template #body>
      <slot />
    </template>
  </UDashboardPanel>
</template>
