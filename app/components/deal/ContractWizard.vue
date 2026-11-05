<script setup lang="ts">
import type { DealChanged, DealView } from '~/types/deal'

defineProps<{ view: DealView, kind: 'contract' | 'receipt', templateId?: string }>()
defineEmits<{ changed: Parameters<DealChanged> }>()
const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <UModal
    v-model:open="open"
    title="Документ на подпись"
  >
    <template #body>
      <EmptyState
        icon="i-lucide-file-signature"
        text="Мастер договора с шаблонами и электронной подписью появится в фазе 6. Пока можно загрузить скан подписанного договора."
        compact
      />
    </template>
  </UModal>
</template>
