<script setup lang="ts">
interface Notification { id: string, title: string, body: string, link: string | null, readAt: string | null, createdAt: string }
const open = ref(false)
const { data: badges, refresh: refreshBadges } = useFetch('/api/badges', { key: 'badges', default: () => ({ inbox: 0, tasks: 0, departures: 0, notifications: 0 }) })
const { data: list, refresh } = useFetch<Notification[]>('/api/notifications', { default: () => [], immediate: false })
watch(open, (v) => {
  if (v) refresh()
})
async function readAll() {
  await api('/api/notifications/read', { method: 'POST', body: {} })
  await Promise.all([refresh(), refreshBadges()])
}
async function go(n: Notification) {
  open.value = false
  if (!n.readAt) {
    await api('/api/notifications/read', { method: 'POST', body: { id: n.id } })
    refreshBadges()
  }
  if (n.link) await navigateTo(n.link)
}
</script>

<template>
  <UPopover
    v-model:open="open"
    :content="{ align: 'end' }"
  >
    <UChip
      :show="!!badges.notifications"
      color="error"
      inset
    >
      <UButton
        icon="i-lucide-bell"
        color="neutral"
        variant="ghost"
        aria-label="Уведомления"
      />
    </UChip>
    <template #content>
      <div class="w-80 max-h-[70vh] overflow-y-auto">
        <div class="flex items-center justify-between px-4 py-3 border-b border-(--ui-border)">
          <span class="font-semibold">Уведомления</span>
          <UButton
            v-if="badges.notifications"
            size="xs"
            variant="ghost"
            label="Прочитать все"
            @click="readAll"
          />
        </div>
        <EmptyState
          v-if="!list.length"
          icon="i-lucide-bell-off"
          text="Новых уведомлений нет"
          compact
        />
        <button
          v-for="n in list"
          :key="n.id"
          class="w-full text-left px-4 py-3 border-b border-(--ui-border-muted) hover:bg-(--ui-bg-muted) flex gap-3"
          @click="go(n)"
        >
          <span
            class="mt-1.5 size-2 rounded-full shrink-0"
            :class="n.readAt ? 'bg-transparent' : 'bg-(--ui-primary)'"
          />
          <span class="min-w-0">
            <span class="block font-medium text-sm">{{ n.title }}</span>
            <span class="block text-sm text-(--ui-text-muted)">{{ n.body }}</span>
            <span class="block text-xs text-(--ui-text-dimmed) mt-0.5">{{ formatDateTime(n.createdAt) }}</span>
          </span>
        </button>
      </div>
    </template>
  </UPopover>
</template>
