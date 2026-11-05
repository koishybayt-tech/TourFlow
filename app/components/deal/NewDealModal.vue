<script setup lang="ts">
import type { Pipeline } from '#shared/domain/types'

const props = defineProps<{ pipeline?: Pipeline }>()
const open = defineModel<boolean>('open', { default: false })

const PIPES = [{ value: 'GROUP', label: 'Групповые туры' }, { value: 'PACKAGE', label: 'Пакетные туры' }, { value: 'BASE', label: 'Базовая' }]
const state = reactive({ pipeline: (props.pipeline ?? 'GROUP') as Pipeline, title: '', departureId: null as string | null, people: 1 })
const mode = ref<'find' | 'new'>('find')
const q = ref('')
const clientId = ref<string | null>(null)
const newClient = reactive({ name: '', phone: '' })
const duplicate = ref<{ id: string, name: string } | null>(null)
const saving = ref(false)

watch(open, (v) => {
  if (v) {
    Object.assign(state, { pipeline: props.pipeline ?? 'GROUP', title: '', departureId: null, people: 1 })
    Object.assign(newClient, { name: '', phone: '' })
    clientId.value = null
    q.value = ''
    mode.value = 'find'
    duplicate.value = null
  }
})

const { data: found } = useFetch<{ id: string, name: string, phone: string }[]>('/api/clients', { query: { q: refDebounced(q, 250) }, default: () => [], immediate: false, watch: [refDebounced(q, 250)] })
const { data: deps } = useFetch<{ departures: { id: string, label: string }[] }>('/api/departures/options', { default: () => ({ departures: [] }), immediate: false, watch: [open] })

async function submit() {
  duplicate.value = null
  saving.value = true
  try {
    const r = await api<{ id: string, number: number }>('/api/deals', {
      method: 'POST',
      body: { pipeline: state.pipeline, title: state.title || (state.departureId ? deps.value.departures.find(d => d.id === state.departureId)?.label.split(' · ')[0] : ''), departureId: state.departureId, people: state.people, ...(mode.value === 'find' ? { clientId: clientId.value } : { newClient }) },
    })
    open.value = false
    useNotify().ok(`Заявка №${r.number} создана`)
    await navigateTo(`/deals/${r.id}`)
  }
  catch (e) {
    const err = e as { statusCode?: number, data?: { data?: { id: string, name: string } } }
    if (err.statusCode === 409 && err.data?.data) duplicate.value = err.data.data
    else useNotify().fail(e)
  }
  finally {
    saving.value = false
  }
}
function useExisting() {
  clientId.value = duplicate.value!.id
  q.value = duplicate.value!.name
  mode.value = 'find'
  duplicate.value = null
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Новая заявка"
  >
    <template #body>
      <form
        class="space-y-4"
        @submit.prevent="submit"
      >
        <div class="flex gap-1">
          <UButton
            size="sm"
            :variant="mode === 'find' ? 'soft' : 'ghost'"
            :color="mode === 'find' ? 'primary' : 'neutral'"
            label="Найти клиента"
            @click="mode = 'find'"
          />
          <UButton
            size="sm"
            :variant="mode === 'new' ? 'soft' : 'ghost'"
            :color="mode === 'new' ? 'primary' : 'neutral'"
            icon="i-lucide-plus"
            label="Новый клиент"
            @click="mode = 'new'"
          />
        </div>
        <div v-if="mode === 'find'">
          <UInput
            v-model="q"
            icon="i-lucide-search"
            placeholder="Имя или телефон"
            class="w-full"
            autofocus
          />
          <div
            v-if="q && found.length"
            class="mt-2 max-h-48 overflow-y-auto rounded-lg border border-(--ui-border) divide-y divide-(--ui-border-muted)"
          >
            <button
              v-for="c in found.slice(0, 8)"
              :key="c.id"
              type="button"
              class="w-full text-left px-3 py-2 text-sm hover:bg-(--ui-bg-muted) flex justify-between"
              :class="clientId === c.id && 'bg-(--ui-bg-muted) font-medium'"
              @click="clientId = c.id"
            >
              <span>{{ c.name }}</span><span class="text-(--ui-text-muted) tabular">{{ formatPhone(c.phone) }}</span>
            </button>
          </div>
          <p
            v-else-if="q.length > 1 && !found.length"
            class="text-sm text-(--ui-text-muted) mt-2"
          >
            Не нашли — <button
              type="button"
              class="text-(--ui-primary)"
              @click="mode = 'new'; newClient.name = q"
            >
              добавить нового клиента
            </button>
          </p>
        </div>
        <div
          v-else
          class="grid grid-cols-2 gap-3"
        >
          <UFormField label="Имя">
            <UInput
              v-model="newClient.name"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Телефон">
            <UInput
              v-model="newClient.phone"
              placeholder="+7 701 000 00 00"
              class="w-full"
            />
          </UFormField>
        </div>
        <UAlert
          v-if="duplicate"
          color="warning"
          variant="subtle"
          :title="`Клиент с этим телефоном уже есть: ${duplicate.name}`"
          :actions="[{ label: 'Создать заявку для него', onClick: useExisting }]"
        />
        <div class="grid grid-cols-[1fr_100px] gap-3">
          <UFormField label="Воронка">
            <USelect
              v-model="state.pipeline"
              :items="PIPES"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Человек">
            <UInputNumber
              v-model="state.people"
              :min="1"
              :max="99"
              class="w-full"
            />
          </UFormField>
        </div>
        <UFormField
          v-if="state.pipeline === 'GROUP'"
          label="Выезд"
          hint="можно выбрать позже"
        >
          <USelect
            v-model="state.departureId"
            :items="[{ value: null, label: 'Не выбран' }, ...deps.departures.map(d => ({ value: d.id, label: d.label }))]"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Запрос">
          <UInput
            v-model="state.title"
            placeholder="Например: Турция, январь, всё включено"
            class="w-full"
          />
        </UFormField>
        <div class="flex justify-end gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            label="Отмена"
            @click="open = false"
          />
          <UButton
            type="submit"
            :loading="saving"
            :disabled="mode === 'find' ? !clientId : !newClient.name || !newClient.phone"
            label="Создать заявку"
          />
        </div>
      </form>
    </template>
  </UModal>
</template>
