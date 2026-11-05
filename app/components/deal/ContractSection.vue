<script setup lang="ts">
import type { DealChanged, DealView } from '~/types/deal'

const props = defineProps<{ view: DealView, num: number }>()
const emit = defineEmits<{ changed: Parameters<DealChanged>, upload: [type: string] }>()
const open = defineModel<boolean>('open', { default: true })
const contract = computed(() => props.view.contracts.find(c => c.kind === 'contract' && !c.annulledAt) ?? null)
const scanSigned = computed(() => props.view.documents.some(d => d.type === 'Подписанный договор'))
const signed = computed(() => contract.value?.status === 'SIGNED' || contract.value?.status === 'PAPER' || scanSigned.value)
const statusText = computed(() => signed.value ? 'Подписан' : contract.value ? 'Ждёт подписей' : 'Не сформирован')
const side = (s: string) => contract.value?.signatures.find(x => x.side === s)
const wizardOpen = ref(false)
</script>

<template>
  <StepSection
    id="contract"
    v-model:open="open"
    :num="num"
    title="Договор"
    :done="signed"
    :badge="statusText"
    :summary="contract ? `№${contract.number} · ${statusText}` : statusText"
  >
    <div
      v-if="contract"
      class="space-y-3"
    >
      <p class="text-sm">
        <b>№{{ contract.number }}</b> · {{ contract.template }} · от {{ formatDate(contract.createdAt) }}
      </p>
      <div class="grid gap-2 sm:grid-cols-2">
        <div
          v-for="s in [{ key: 'client', label: 'Клиент' }, { key: 'agency', label: 'Турагентство' }]"
          :key="s.key"
          class="rounded-lg border border-(--ui-border) px-3 py-2 flex items-center gap-2 text-sm"
        >
          <UIcon
            :name="side(s.key)?.signedAt ? 'i-lucide-check-circle-2' : 'i-lucide-clock'"
            :class="side(s.key)?.signedAt ? 'text-ok' : 'text-warn'"
          />
          <span class="flex-1">{{ s.label }}</span>
          <span class="text-xs text-(--ui-text-muted)">{{ side(s.key)?.signedAt ? `подписал ${formatDateTime(side(s.key)!.signedAt)}` : 'ждёт подписи' }}</span>
        </div>
      </div>
    </div>
    <p
      v-else-if="scanSigned"
      class="text-sm"
    >
      Договор подписан на бумаге — скан в документах.
    </p>
    <p
      v-else
      class="text-sm text-(--ui-text-muted)"
    >
      Договор доступен в любой момент, не привязан к этапу.
    </p>
    <div class="flex flex-wrap gap-2 mt-4">
      <UButton
        icon="i-lucide-file-signature"
        :label="contract ? 'Сформировать заново' : 'Сформировать договор'"
        :variant="contract ? 'outline' : 'solid'"
        :color="contract ? 'neutral' : 'primary'"
        @click="wizardOpen = true"
      />
      <UButton
        v-if="!signed"
        icon="i-lucide-scan-line"
        color="neutral"
        variant="ghost"
        label="Загрузить скан подписанного"
        @click="emit('upload', 'Подписанный договор')"
      />
    </div>
    <DealContractWizard
      v-model:open="wizardOpen"
      :view="view"
      kind="contract"
      @changed="emit('changed', $event)"
    />
  </StepSection>
</template>
