<script setup lang="ts">
import type { DealChanged, DealView } from '~/types/deal'

const props = defineProps<{ view: DealView, num: number }>()
defineEmits<{ changed: Parameters<DealChanged> }>()
const open = defineModel<boolean>('open', { default: false })
const recommended = computed(() => props.view.receipts.filter(r => r.recommended))
const signedCount = computed(() => recommended.value.filter(r => r.status === 'SIGNED' || r.status === 'PAPER').length)
</script>

<template>
  <StepSection
    id="receipts"
    v-model:open="open"
    :num="num"
    title="Расписки клиента"
    :done="!!recommended.length && signedCount === recommended.length"
    :badge="`${signedCount} из ${recommended.length} подписано`"
    :summary="`рекомендуется ${recommended.length}`"
  >
    <ul class="divide-y divide-(--ui-border-muted)">
      <li
        v-for="r in view.receipts"
        :key="r.id"
        class="flex items-start gap-3 py-2.5"
      >
        <UIcon
          :name="r.status === 'SIGNED' || r.status === 'PAPER' ? 'i-lucide-check-circle-2' : r.recommended ? 'i-lucide-circle-dot' : 'i-lucide-circle'"
          :class="r.status === 'SIGNED' || r.status === 'PAPER' ? 'text-ok' : r.recommended ? 'text-(--ui-primary)' : 'text-(--ui-text-dimmed)'"
          class="mt-0.5 shrink-0"
        />
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium">
            {{ r.name }} <UBadge
              v-if="r.recommended"
              size="sm"
              variant="subtle"
              label="Рекомендуется"
            />
          </p>
          <p class="text-xs text-(--ui-text-muted)">
            {{ r.short }}
          </p>
        </div>
      </li>
    </ul>
    <p class="text-xs text-(--ui-text-muted) mt-2">
      Отправка на подпись и скан — в фазе 6.
    </p>
  </StepSection>
</template>
