<script setup lang="ts">
import type { Pipeline, RequirementType } from '#shared/domain/types'
import { DOC_TYPES } from '#shared/domain/types'

interface Req { id?: string, type: RequirementType, label: string, required: boolean, config: Record<string, unknown> }
interface Stage { id: string, name: string, order: number, description: string, requirements: Req[], deals: number }

const pipeline = ref<Pipeline>('GROUP')
const { data: stages, refresh } = await useFetch<Stage[]>('/api/settings/stages', { query: { pipeline }, default: () => [] })
const editId = ref<string | null>(null)
const draft = reactive<{ name: string, description: string, requirements: Req[] }>({ name: '', description: '', requirements: [] })
const newStage = ref('')

const TYPES: { value: RequirementType, label: string }[] = [
  { value: 'FIELD', label: 'Ввод данных' }, { value: 'CLIENT', label: 'Данные клиента для договора' }, { value: 'TRAVELERS', label: 'Туристы с паспортами' },
  { value: 'DEPARTURE', label: 'Выбран выезд' }, { value: 'DOC', label: 'Документ' }, { value: 'SIGN', label: 'Договор подписан' },
  { value: 'PAY', label: 'Оплата' }, { value: 'EVENT', label: 'Визовая запись в календаре' }, { value: 'COMMENT', label: 'Комментарий' }, { value: 'CHECK', label: 'Подтверждение (галочка)' },
]
const FIELDS = [{ value: 'dates', label: 'Даты' }, { value: 'people', label: 'Количество человек' }, { value: 'budget', label: 'Бюджет' }, { value: 'visaHistory', label: 'Визовая история' }, { value: '', label: 'Своё поле (например, номер брони)' }]
const typeLabel = (t: string) => TYPES.find(x => x.value === t)?.label ?? t

function edit(s: Stage) {
  editId.value = s.id
  Object.assign(draft, { name: s.name, description: s.description, requirements: structuredClone(toRaw(s.requirements)).map((r: Req) => ({ ...r, config: { ...r.config } })) })
}
function addReq() {
  draft.requirements.push({ type: 'CHECK', label: '', required: true, config: {} })
}
function onType(r: Req) {
  r.config = r.type === 'PAY' ? { mode: 'prepay', perPerson: 100000 } : r.type === 'DOC' ? { docType: 'Паспорт' } : r.type === 'FIELD' ? { field: 'dates' } : r.type === 'EVENT' ? { eventType: 'visa' } : {}
}
async function save() {
  const body = { ...draft, requirements: draft.requirements.map(r => ({ ...r, config: r.type === 'FIELD' && !r.config.field ? {} : r.config })) }
  if (await mutate(() => api(`/api/settings/stages/${editId.value}`, { method: 'PUT', body }), 'Регламент сохранён')) {
    editId.value = null
    refresh()
  }
}
async function add() {
  if (await mutate(() => api('/api/settings/stages', { method: 'POST', body: { pipeline: pipeline.value, name: newStage.value } }), 'Этап добавлен')) {
    newStage.value = ''
    refresh()
  }
}
async function remove(s: Stage) {
  if (await mutate(() => api(`/api/settings/stages/${s.id}`, { method: 'DELETE' }), 'Этап удалён')) refresh()
}
</script>

<template>
  <div class="space-y-4">
    <div class="card p-5 space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="font-semibold">
            Воронки и этапы
          </h2>
          <p class="text-sm text-(--ui-text-muted)">
            Регламент этапа — подсказка «что осталось». Когда обязательные требования выполнены, заявка переходит дальше сама.
          </p>
        </div>
        <div class="flex rounded-lg border border-(--ui-border) p-0.5">
          <UButton
            v-for="p in [{ v: 'GROUP', l: 'Групповые' }, { v: 'PACKAGE', l: 'Пакетные' }, { v: 'BASE', l: 'Базовая' }]"
            :key="p.v"
            size="sm"
            :variant="pipeline === p.v ? 'soft' : 'ghost'"
            :color="pipeline === p.v ? 'primary' : 'neutral'"
            :label="p.l"
            @click="pipeline = p.v as Pipeline; editId = null"
          />
        </div>
      </div>
    </div>

    <div
      v-for="s in stages"
      :key="s.id"
      class="card"
    >
      <div class="flex items-center gap-3 px-5 py-4">
        <span class="size-6 rounded-full bg-(--ui-bg-accented) grid place-items-center text-xs font-semibold">{{ s.order + 1 }}</span>
        <div class="flex-1 min-w-0">
          <p class="font-medium">
            {{ s.name }} <span class="text-xs text-(--ui-text-muted) font-normal">· заявок: {{ s.deals }}</span>
          </p>
          <p
            v-if="editId !== s.id"
            class="text-sm text-(--ui-text-muted) truncate"
          >
            {{ s.requirements.filter(r => r.required).length }} обязательных · {{ s.description || 'описание не задано' }}
          </p>
        </div>
        <UButton
          v-if="editId !== s.id"
          size="sm"
          variant="ghost"
          icon="i-lucide-pencil"
          label="Регламент"
          @click="edit(s)"
        />
        <UButton
          v-if="editId !== s.id && !s.deals"
          size="sm"
          variant="ghost"
          color="error"
          icon="i-lucide-trash-2"
          aria-label="Удалить этап"
          @click="remove(s)"
        />
      </div>
      <div
        v-if="editId === s.id"
        class="px-5 pb-5 space-y-4 border-t border-(--ui-border) pt-4"
      >
        <UFormField label="Название этапа">
          <UInput
            v-model="draft.name"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Что сделать на этапе">
          <UTextarea
            v-model="draft.description"
            :rows="2"
            class="w-full"
          />
        </UFormField>
        <div>
          <p class="text-sm font-medium mb-2">
            Требования
          </p>
          <div
            v-for="(r, i) in draft.requirements"
            :key="i"
            class="grid gap-2 md:grid-cols-[200px_1fr_180px_auto_auto] items-center py-2 border-b border-(--ui-border-muted)"
          >
            <USelect
              v-model="r.type"
              :items="TYPES"
              size="sm"
              @update:model-value="onType(r)"
            />
            <UInput
              v-model="r.label"
              size="sm"
              placeholder="Как требование увидит менеджер"
            />
            <USelect
              v-if="r.type === 'FIELD'"
              :model-value="(r.config.field as string) ?? ''"
              :items="FIELDS"
              size="sm"
              @update:model-value="r.config.field = $event"
            />
            <USelect
              v-else-if="r.type === 'DOC'"
              :model-value="(r.config.docType as string)"
              :items="DOC_TYPES.map(t => ({ value: t as string, label: t as string }))"
              size="sm"
              @update:model-value="r.config.docType = $event"
            />
            <USelect
              v-else-if="r.type === 'PAY'"
              :model-value="(r.config.mode as string)"
              :items="[{ value: 'prepay', label: 'Предоплата на чел.' }, { value: 'full', label: '100%' }]"
              size="sm"
              @update:model-value="r.config.mode = $event"
            />
            <span
              v-else
              class="text-xs text-(--ui-text-muted)"
            >{{ typeLabel(r.type) }}</span>
            <UCheckbox
              v-model="r.required"
              label="Обязательно"
            />
            <UButton
              size="xs"
              variant="ghost"
              color="error"
              icon="i-lucide-x"
              aria-label="Удалить требование"
              @click="draft.requirements.splice(i, 1)"
            />
          </div>
          <UButton
            class="mt-2"
            size="sm"
            variant="soft"
            icon="i-lucide-plus"
            label="Требование"
            @click="addReq"
          />
        </div>
        <div class="flex justify-end gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            label="Отмена"
            @click="editId = null"
          />
          <UButton
            label="Сохранить регламент"
            @click="save"
          />
        </div>
      </div>
    </div>

    <form
      class="card p-5 flex gap-2"
      @submit.prevent="add"
    >
      <UInput
        v-model="newStage"
        placeholder="Новый этап в конце воронки"
        class="flex-1"
      />
      <UButton
        type="submit"
        icon="i-lucide-plus"
        variant="soft"
        label="Добавить этап"
        :disabled="newStage.trim().length < 2"
      />
    </form>
  </div>
</template>
