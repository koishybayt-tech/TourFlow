<script setup lang="ts">
import type { DealChanged, DealView } from '~/types/deal'

defineProps<{ view: DealView }>()
defineEmits<{ changed: Parameters<DealChanged> }>()
</script>

<template>
  <div>
    <p class="text-sm font-medium mb-2">
      Варианты туроператоров
    </p>
    <div
      v-if="view.offers.length"
      class="grid gap-3 md:grid-cols-2"
    >
      <div
        v-for="o in view.offers"
        :key="o.id"
        class="rounded-lg border p-3 text-sm"
        :class="o.status === 'CHOSEN' ? 'border-ok bg-ok-bg/40' : o.status === 'REJECTED' ? 'border-(--ui-border) opacity-60' : 'border-(--ui-border)'"
      >
        <div class="flex justify-between gap-2">
          <span class="font-medium">{{ o.hotel }} {{ '★'.repeat(o.stars) }}</span>
          <span class="text-xs text-(--ui-text-muted)">{{ o.operator }}</span>
        </div>
        <p class="text-xs text-(--ui-text-muted)">
          {{ o.resort }} · {{ formatRange(o.fromDate, o.toDate) }} · {{ o.meal }} · {{ o.room }}
        </p>
        <p class="mt-1 font-semibold tabular">
          {{ formatMoney(o.price) }}
        </p>
      </div>
    </div>
    <p
      v-else
      class="text-sm text-(--ui-text-muted)"
    >
      Подбор туров и бронь у оператора — в фазе 8.
    </p>
  </div>
</template>
