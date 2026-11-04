<script setup lang="ts">
import type { Component } from 'vue'
import SettingsModules from '~/components/settings/SettingsModules.vue'
import SettingsMembers from '~/components/settings/SettingsMembers.vue'
import SettingsCompany from '~/components/settings/SettingsCompany.vue'

definePageMeta({ middleware: 'role', permission: 'settings' })
useHead({ title: 'Настройки — Tourflow' })

const route = useRoute()
const tabs = [
  { key: 'modules', label: 'Модули', icon: 'i-lucide-blocks', phase: 0 },
  { key: 'stages', label: 'Воронки и этапы', icon: 'i-lucide-git-branch', phase: 5 },
  { key: 'channels', label: 'Каналы', icon: 'i-lucide-radio-tower', phase: 4 },
  { key: 'members', label: 'Сотрудники и доступ', icon: 'i-lucide-users', phase: 0 },
  { key: 'directions', label: 'Направления и ответственные', icon: 'i-lucide-compass', phase: 4 },
  { key: 'routing', label: 'Распределение по воронкам', icon: 'i-lucide-split', phase: 4 },
  { key: 'company', label: 'Реквизиты компании', icon: 'i-lucide-building-2', phase: 0 },
  { key: 'templates', label: 'Шаблоны документов', icon: 'i-lucide-file-text', phase: 6 },
  { key: 'operators', label: 'Туроператоры', icon: 'i-lucide-briefcase', phase: 8 },
]
const tab = computed(() => tabs.find(t => t.key === route.params.tab) ?? tabs[0]!)
const COMPONENTS: Record<string, Component> = {
  modules: SettingsModules,
  members: SettingsMembers,
  company: SettingsCompany,
}
</script>

<template>
  <AppPage
    title="Настройки"
    :subtitle="tab.label"
  >
    <div class="grid gap-6 lg:grid-cols-[240px_1fr] items-start">
      <nav class="card p-2 lg:sticky lg:top-0">
        <NuxtLink
          v-for="t in tabs"
          :key="t.key"
          :to="`/settings/${t.key}`"
          class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-(--ui-bg-muted)"
          :class="t.key === tab.key ? 'bg-(--ui-bg-muted) font-medium text-(--ui-text-highlighted)' : 'text-(--ui-text-toned)'"
        >
          <UIcon
            :name="t.icon"
            class="size-4"
          />
          {{ t.label }}
        </NuxtLink>
      </nav>
      <div class="min-w-0">
        <component
          :is="COMPONENTS[tab.key]"
          v-if="COMPONENTS[tab.key]"
          :key="tab.key"
        />
        <div
          v-else
          class="card"
        >
          <EmptyState
            icon="i-lucide-hammer"
            :text="`Раздел «${tab.label}» появится в фазе ${tab.phase}.`"
          />
        </div>
      </div>
    </div>
  </AppPage>
</template>
