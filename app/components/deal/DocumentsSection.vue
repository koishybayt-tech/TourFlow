<script setup lang="ts">
import { DOC_TYPES } from '#shared/domain/types'
import type { DealChanged, DealView } from '~/types/deal'

const props = defineProps<{ view: DealView, num: number }>()
const emit = defineEmits<{ changed: Parameters<DealChanged> }>()
const open = defineModel<boolean>('open', { default: false })
const uploadOpen = ref(false)
const type = ref<string>('Паспорт')
const file = ref<File | null>(null)
const uploading = ref(false)

function startUpload(t?: string) {
  type.value = t ?? 'Паспорт'
  file.value = null
  uploadOpen.value = true
}
defineExpose({ startUpload })

async function upload() {
  if (!file.value) return useNotify().fail({ data: { statusMessage: 'Выберите файл' } })
  uploading.value = true
  const fd = new FormData()
  fd.append('type', type.value)
  fd.append('file', file.value)
  const r = await mutate(() => $fetch<{ advanced: null }>(`/api/deals/${props.view.deal.id}/documents`, { method: 'POST', body: fd }), 'Документ загружен')
  uploading.value = false
  if (r) {
    uploadOpen.value = false
    emit('changed', r)
  }
}
async function remove(id: string) {
  if (await mutate(() => api(`/api/documents/${id}`, { method: 'DELETE' }), 'Документ удалён')) emit('changed')
}
const sizeText = (n: number | null) => (n ? (n > 1_048_576 ? `${(n / 1_048_576).toFixed(1)} МБ` : `${Math.max(1, Math.round(n / 1024))} КБ`) : '')
</script>

<template>
  <StepSection
    id="docs"
    v-model:open="open"
    :num="num"
    title="Документы"
    :badge="String(view.documents.length)"
    :summary="view.documents.map(d => d.type).slice(0, 4).join(', ') || 'нет файлов'"
  >
    <ul
      v-if="view.documents.length"
      class="divide-y divide-(--ui-border-muted)"
    >
      <li
        v-for="d in view.documents"
        :key="d.id"
        class="flex items-center gap-3 py-2 text-sm"
      >
        <UIcon
          name="i-lucide-file-text"
          class="text-(--ui-text-muted) shrink-0"
        />
        <a
          :href="`/api/documents/${d.id}/download`"
          target="_blank"
          class="flex-1 truncate hover:underline"
        >{{ d.name }}</a>
        <UBadge
          size="sm"
          variant="subtle"
          color="neutral"
          :label="d.type"
        />
        <span class="text-xs text-(--ui-text-muted) w-28 text-right">{{ sizeText(d.size) }} {{ formatDate(d.createdAt) }}</span>
        <UButton
          size="xs"
          variant="ghost"
          color="error"
          icon="i-lucide-trash-2"
          aria-label="Удалить документ"
          @click="remove(d.id)"
        />
      </li>
    </ul>
    <p
      v-else
      class="text-sm text-(--ui-text-muted)"
    >
      Паспорта, визы, договоры, ваучеры и чеки — всё по заявке в одном месте.
    </p>
    <UButton
      class="mt-3"
      size="sm"
      icon="i-lucide-upload"
      label="Загрузить"
      @click="startUpload()"
    />
    <UModal
      v-model:open="uploadOpen"
      title="Загрузить документ"
    >
      <template #body>
        <form
          class="space-y-4"
          @submit.prevent="upload"
        >
          <UFormField label="Тип документа">
            <USelect
              v-model="type"
              :items="DOC_TYPES.map(t => ({ value: t as string, label: t as string }))"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Файл"
            hint="до 20 МБ"
          >
            <input
              type="file"
              class="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-(--ui-bg-accented) file:px-3 file:py-1.5"
              accept=".pdf,.jpg,.jpeg,.png,.heic,.doc,.docx"
              aria-label="Файл"
              @change="file = ($event.target as HTMLInputElement).files?.[0] ?? null"
            >
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              label="Отмена"
              @click="uploadOpen = false"
            />
            <UButton
              type="submit"
              :loading="uploading"
              label="Загрузить"
            />
          </div>
        </form>
      </template>
    </UModal>
  </StepSection>
</template>
