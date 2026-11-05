<script setup lang="ts">
import type { DealChanged, DealView } from '~/types/deal'

const props = defineProps<{ view: DealView, num: number }>()
const emit = defineEmits<{ changed: Parameters<DealChanged>, upload: [type: string] }>()
const open = defineModel<boolean>('open', { default: true })
const visaEvents = computed(() => props.view.calendar.filter(e => e.type === 'visa'))
const visaDocs = computed(() => props.view.documents.filter(d => d.type === 'Виза'))
const done = computed(() => visaEvents.value.length > 0 && visaDocs.value.length > 0)
const formOpen = ref(false)
const form = reactive({ date: '', time: '10:00', place: 'Визовый центр, Алматы' })
async function save() {
  if (!form.date) return useNotify().fail({ data: { statusMessage: 'Укажите дату записи' } })
  const startAt = new Date(`${form.date}T${form.time}:00+05:00`).toISOString()
  const r = await mutate(() => api<{ advanced: null }>(`/api/deals/${props.view.deal.id}/visa-appointment`, { method: 'POST', body: { startAt, place: form.place } }), 'Запись в визовый центр добавлена в календарь')
  if (r) {
    formOpen.value = false
    emit('changed', r)
  }
}
</script>

<template>
  <StepSection
    id="visa"
    v-model:open="open"
    :num="num"
    title="Виза"
    :done="done"
    :summary="visaEvents[0] ? `запись ${formatDateTime(visaEvents[0].startAt)} · виз загружено ${visaDocs.length}` : 'запись не назначена'"
  >
    <div class="grid gap-4 md:grid-cols-2">
      <div>
        <p class="text-sm font-medium mb-2">
          Запись в визовый центр
        </p>
        <ul
          v-if="visaEvents.length"
          class="space-y-1.5 text-sm"
        >
          <li
            v-for="e in visaEvents"
            :key="e.id"
            class="flex items-center gap-2"
          >
            <UIcon
              name="i-lucide-stamp"
              class="text-(--ui-primary)"
            />
            <span><b>{{ formatDateTime(e.startAt) }}</b> · {{ e.title }}<span class="text-(--ui-text-muted)"> · {{ e.place }}</span></span>
          </li>
        </ul>
        <p
          v-else
          class="text-sm text-(--ui-text-muted)"
        >
          Запись не назначена
        </p>
        <UButton
          class="mt-3"
          size="sm"
          icon="i-lucide-calendar-plus"
          variant="soft"
          label="Записать в визовый центр"
          @click="formOpen = true"
        />
      </div>
      <div>
        <p class="text-sm font-medium mb-2">
          Виза
        </p>
        <ul
          v-if="visaDocs.length"
          class="space-y-1 text-sm"
        >
          <li
            v-for="d in visaDocs"
            :key="d.id"
          >
            <a
              :href="`/api/documents/${d.id}/download`"
              target="_blank"
              class="hover:underline"
            >{{ d.name }}</a>
          </li>
        </ul>
        <p
          v-else
          class="text-sm text-(--ui-text-muted)"
        >
          Скан визы не загружен
        </p>
        <UButton
          class="mt-3"
          size="sm"
          icon="i-lucide-upload"
          variant="soft"
          color="neutral"
          label="Загрузить визу"
          @click="emit('upload', 'Виза')"
        />
      </div>
    </div>
    <UModal
      v-model:open="formOpen"
      title="Запись в визовый центр"
      description="Создастся событие календаря; клиенту — напоминание в WhatsApp за день."
    >
      <template #body>
        <form
          class="space-y-4"
          @submit.prevent="save"
        >
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Дата">
              <UInput
                v-model="form.date"
                type="date"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Время">
              <UInput
                v-model="form.time"
                type="time"
                class="w-full"
              />
            </UFormField>
          </div>
          <UFormField label="Место">
            <UInput
              v-model="form.place"
              class="w-full"
            />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              label="Отмена"
              @click="formOpen = false"
            />
            <UButton
              type="submit"
              label="Записать"
            />
          </div>
        </form>
      </template>
    </UModal>
  </StepSection>
</template>
