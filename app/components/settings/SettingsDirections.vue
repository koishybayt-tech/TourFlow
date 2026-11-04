<script setup lang="ts">
interface Dir { id?: string, name: string, keywords: string[], managerIds: string[], mode: 'single' | 'round', backupId: string | null }
const { me, refresh: refreshMe } = useMe()
const { data } = await useFetch<{ directions: Dir[], defaultManagerId: string | null }>('/api/settings/directions')
const dirs = ref<(Dir & { kw: string })[]>((data.value?.directions ?? []).map(d => ({ ...d, kw: d.keywords.join(', ') })))
const defaultManagerId = ref(data.value?.defaultManagerId ?? null)
const members = computed(() => (me.value?.members ?? []).map(m => ({ value: m.id, label: m.name + (m.onVacation ? ' (отпуск)' : '') })))
const saving = ref(false)

function add() {
  dirs.value.push({ name: '', keywords: [], kw: '', managerIds: [], mode: 'single', backupId: null })
}
async function save() {
  saving.value = true
  await mutate(() => api('/api/settings/directions', {
    method: 'PUT',
    body: { defaultManagerId: defaultManagerId.value, directions: dirs.value.map(d => ({ id: d.id, name: d.name, keywords: d.kw.split(',').map(s => s.trim()).filter(Boolean), managerIds: d.managerIds, mode: d.mode, backupId: d.backupId })) },
  }), 'Направления сохранены')
  saving.value = false
}
async function vacation(id: string, value: boolean) {
  await mutate(() => api(`/api/settings/members/${id}`, { method: 'PATCH', body: { onVacation: value } }), value ? 'Отмечен отпуск' : 'Сотрудник на работе')
  await refreshMe()
}
</script>

<template>
  <div class="space-y-6">
    <div class="card">
      <div class="px-5 py-4 border-b border-(--ui-border)">
        <h2 class="font-semibold">
          Доступность сотрудников
        </h2>
        <p class="text-sm text-(--ui-text-muted)">
          Сотрудники в отпуске не получают новые заявки — их получает резерв.
        </p>
      </div>
      <div
        v-for="m in me?.members"
        :key="m.id"
        class="flex items-center justify-between px-5 py-3 border-b border-(--ui-border-muted) last:border-0"
      >
        <span class="flex items-center gap-2 text-sm"><UAvatar
          :text="initials(m.name)"
          size="xs"
        /> {{ m.name }} <span class="text-(--ui-text-muted)">· {{ ROLE_LABELS[m.role] }}</span></span>
        <span class="flex items-center gap-2 text-sm">
          <span :class="m.onVacation ? 'text-warn-text' : 'text-ok-text'">{{ m.onVacation ? 'В отпуске' : 'На работе' }}</span>
          <USwitch
            :model-value="m.onVacation"
            aria-label="В отпуске"
            @update:model-value="vacation(m.id, $event)"
          />
        </span>
      </div>
    </div>

    <div class="card">
      <div class="flex items-center justify-between px-5 py-4 border-b border-(--ui-border)">
        <div>
          <h2 class="font-semibold">
            Направления и ответственные
          </h2>
          <p class="text-sm text-(--ui-text-muted)">
            Направление определяется по началу слов в сообщении: «анталь» найдёт «Анталью».
          </p>
        </div>
        <UButton
          icon="i-lucide-plus"
          label="Направление"
          variant="soft"
          @click="add"
        />
      </div>
      <div
        v-for="(d, i) in dirs"
        :key="d.id ?? i"
        class="px-5 py-4 border-b border-(--ui-border-muted) space-y-3"
      >
        <div class="flex gap-3 items-end flex-wrap">
          <UFormField
            label="Название"
            class="flex-1 min-w-52"
          >
            <UInput
              v-model="d.name"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Режим">
            <USelect
              v-model="d.mode"
              :items="[{ value: 'single', label: 'Один ответственный' }, { value: 'round', label: 'По очереди' }]"
              class="w-48"
            />
          </UFormField>
          <UButton
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            aria-label="Удалить направление"
            @click="dirs.splice(i, 1)"
          />
        </div>
        <UFormField
          label="Ключевые слова"
          hint="через запятую"
        >
          <UInput
            v-model="d.kw"
            class="w-full"
          />
        </UFormField>
        <div class="grid gap-3 md:grid-cols-2">
          <UFormField label="Ответственные">
            <USelectMenu
              v-model="d.managerIds"
              :items="members"
              value-key="value"
              multiple
              placeholder="Выберите сотрудников"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Резерв (если все в отпуске)">
            <USelect
              v-model="d.backupId"
              :items="[{ value: null, label: 'Нет' }, ...members]"
              class="w-full"
            />
          </UFormField>
        </div>
      </div>
      <div class="flex flex-wrap items-end justify-between gap-3 px-5 py-4">
        <UFormField label="По умолчанию (направление не определено)">
          <USelect
            v-model="defaultManagerId"
            :items="[{ value: null, label: 'Не назначать' }, ...members]"
            class="w-64"
          />
        </UFormField>
        <UButton
          :loading="saving"
          label="Сохранить"
          @click="save"
        />
      </div>
    </div>
  </div>
</template>
