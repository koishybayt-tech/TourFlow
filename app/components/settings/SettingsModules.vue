<script setup lang="ts">
import { MODULE_INFO, type Modules } from '#shared/permissions'

const { me, refresh } = useMe()
const modules = reactive<Modules>({ ...me.value!.org.modules })
async function toggle(key: keyof Modules, value: boolean) {
  modules[key] = value
  const r = await mutate(() => api('/api/settings/modules', { method: 'PUT', body: modules }), value ? 'Модуль включён' : 'Модуль выключен')
  if (!r) modules[key] = !value
  await refresh()
  refreshNuxtData('badges')
}
</script>

<template>
  <div class="card divide-y divide-(--ui-border)">
    <div class="px-5 py-4">
      <h2 class="font-semibold">
        Модули
      </h2>
      <p class="text-sm text-(--ui-text-muted)">
        Ядро (сообщения, заявки, клиенты, задачи, календарь, документы, оплаты, отчёты) включено всегда. Выключенные модули скрываются из меню.
      </p>
    </div>
    <div
      v-for="m in MODULE_INFO"
      :key="m.key"
      class="flex items-center justify-between gap-4 px-5 py-4"
    >
      <div>
        <p class="font-medium">
          {{ m.title }}
        </p>
        <p class="text-sm text-(--ui-text-muted)">
          {{ m.description }}
        </p>
      </div>
      <USwitch
        :model-value="modules[m.key]"
        :aria-label="m.title"
        @update:model-value="toggle(m.key, $event)"
      />
    </div>
  </div>
</template>
