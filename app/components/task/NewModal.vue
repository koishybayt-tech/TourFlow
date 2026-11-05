<script setup lang="ts">
const props = defineProps<{ dealId?: string, departureId?: string, stageName?: string }>()
const emit = defineEmits<{ created: [id: string] }>()
const open = defineModel<boolean>('open', { default: false })
const { me } = useMe()
const state = reactive({ title: '', description: '', priority: 'MEDIUM', date: '', time: '18:00', assigneeId: undefined as string | undefined, linkStage: true })
watch(open, (v) => {
  if (v) Object.assign(state, { title: '', description: '', priority: 'MEDIUM', date: isoDay(new Date()), time: '18:00', assigneeId: me.value?.member.id, linkStage: true })
})
async function save() {
  const dueAt = state.date ? new Date(`${state.date}T${state.time || '18:00'}:00+05:00`).toISOString() : null
  const r = await mutate(() => api<{ id: string }>('/api/tasks', {
    method: 'POST',
    body: { title: state.title, description: state.description, priority: state.priority, dueAt, assigneeId: state.assigneeId, dealId: props.dealId ?? null, departureId: props.departureId ?? null, ...(props.dealId && !state.linkStage ? { stageId: null } : {}) },
  }), 'Задача создана')
  if (r) {
    open.value = false
    emit('created', r.id)
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Новая задача"
  >
    <template #body>
      <form
        class="space-y-4"
        @submit.prevent="save"
      >
        <UFormField label="Что сделать">
          <UInput
            v-model="state.title"
            class="w-full"
            autofocus
          />
        </UFormField>
        <UFormField label="Описание">
          <UTextarea
            v-model="state.description"
            :rows="2"
            class="w-full"
          />
        </UFormField>
        <div class="grid grid-cols-3 gap-3">
          <UFormField label="Срок">
            <UInput
              v-model="state.date"
              type="date"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Время">
            <UInput
              v-model="state.time"
              type="time"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Приоритет">
            <USelect
              v-model="state.priority"
              :items="[{ value: 'HIGH', label: 'Высокий' }, { value: 'MEDIUM', label: 'Средний' }, { value: 'LOW', label: 'Низкий' }]"
              class="w-full"
            />
          </UFormField>
        </div>
        <UFormField label="Исполнитель">
          <USelect
            v-model="state.assigneeId"
            :items="(me?.members ?? []).map(m => ({ value: m.id, label: m.name }))"
            class="w-full"
          />
        </UFormField>
        <UCheckbox
          v-if="dealId && stageName"
          v-model="state.linkStage"
          :label="`Привязать к этапу «${stageName}» — этап не завершится, пока задача открыта`"
        />
        <div class="flex justify-end gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            label="Отмена"
            @click="open = false"
          />
          <UButton
            type="submit"
            label="Создать"
          />
        </div>
      </form>
    </template>
  </UModal>
</template>
