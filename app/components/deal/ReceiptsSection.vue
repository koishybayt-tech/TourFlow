<script setup lang="ts">
import type { DealChanged, DealView } from '~/types/deal'

const props = defineProps<{ view: DealView, num: number }>()
const emit = defineEmits<{ changed: Parameters<DealChanged> }>()
const open = defineModel<boolean>('open', { default: false })
const recommended = computed(() => props.view.receipts.filter(r => r.recommended))
const isSigned = (s: string | null) => s === 'SIGNED' || s === 'PAPER'
const signedCount = computed(() => props.view.receipts.filter(r => isSigned(r.status)).length)
const toSend = computed(() => recommended.value.filter(r => !r.contractId))

// Text preview
const textOpen = ref(false)
const text = ref<{ name: string, text: string } | null>(null)
async function showText(id: string) {
  const r = await mutate(() => api<{ name: string, text: string }>(`/api/deals/${props.view.deal.id}/contract-preview`, { method: 'POST', body: { templateId: id } }))
  if (r) {
    text.value = r
    textOpen.value = true
  }
}
// Send for signing (one or several, one link)
const links = ref<{ client: string } | null>(null)
async function send(ids: string[]) {
  const r = await mutate(() => api<{ count: number, links: { client: string } }>(`/api/deals/${props.view.deal.id}/receipts`, { method: 'POST', body: { templateIds: ids } }), ids.length > 1 ? `Расписок отправлено: ${ids.length}` : 'Расписка отправлена на подпись')
  if (r) {
    links.value = r.links
    emit('changed')
  }
}
function copy() {
  navigator.clipboard.writeText(links.value!.client)
  useNotify().ok('Ссылка скопирована')
}
// Paper scan
const fileInput = ref<HTMLInputElement | null>(null)
const scanFor = ref<{ templateId: string, contractId: string | null } | null>(null)
function scan(r: DealView['receipts'][number]) {
  scanFor.value = { templateId: r.id, contractId: r.contractId }
  fileInput.value?.click()
}
async function onFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file || !scanFor.value) return
  let contractId = scanFor.value.contractId
  if (!contractId) {
    await api(`/api/deals/${props.view.deal.id}/receipts`, { method: 'POST', body: { templateIds: [scanFor.value.templateId] } })
    const fresh = await api<DealView>(`/api/deals/${props.view.deal.id}`)
    contractId = fresh.receipts.find(r => r.id === scanFor.value!.templateId)?.contractId ?? null
  }
  if (!contractId) return
  const fd = new FormData()
  fd.append('file', file)
  const r = await mutate(() => $fetch<{ advanced: null }>(`/api/contracts/${contractId}/paper`, { method: 'POST', body: fd }), 'Скан расписки загружен')
  ;(e.target as HTMLInputElement).value = ''
  if (r) emit('changed', r)
}
</script>

<template>
  <StepSection
    id="receipts"
    v-model:open="open"
    :num="num"
    title="Расписки клиента"
    :done="!!recommended.length && recommended.every(r => isSigned(r.status))"
    :badge="`${signedCount} из ${recommended.length} подписано`"
    :summary="`рекомендуется ${recommended.length}, подписано ${signedCount}`"
  >
    <input
      ref="fileInput"
      type="file"
      class="hidden"
      accept=".pdf,.jpg,.jpeg,.png,.heic"
      aria-label="Скан расписки"
      @change="onFile"
    >
    <ul class="divide-y divide-(--ui-border-muted)">
      <li
        v-for="r in view.receipts"
        :key="r.id"
        class="flex items-start gap-3 py-2.5"
      >
        <UIcon
          :name="isSigned(r.status) ? 'i-lucide-check-circle-2' : r.status === 'SENT' ? 'i-lucide-clock' : r.recommended ? 'i-lucide-circle-dot' : 'i-lucide-circle'"
          :class="isSigned(r.status) ? 'text-ok' : r.status === 'SENT' ? 'text-warn' : r.recommended ? 'text-(--ui-primary)' : 'text-(--ui-text-dimmed)'"
          class="mt-0.5 shrink-0"
        />
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium">
            {{ r.name }}
            <UBadge
              v-if="r.recommended"
              size="sm"
              variant="subtle"
              label="Рекомендуется"
            />
            <UBadge
              v-if="r.status === 'SENT'"
              size="sm"
              variant="subtle"
              color="warning"
              label="Ждёт подписи"
            />
            <UBadge
              v-else-if="isSigned(r.status)"
              size="sm"
              variant="subtle"
              color="success"
              :label="r.status === 'PAPER' ? 'Подписана на бумаге' : 'Подписана'"
            />
          </p>
          <p class="text-xs text-(--ui-text-muted)">
            {{ r.short }}
          </p>
        </div>
        <div
          v-if="!isSigned(r.status)"
          class="flex gap-1 shrink-0"
        >
          <UButton
            size="xs"
            variant="ghost"
            label="Текст"
            @click="showText(r.id)"
          />
          <UButton
            v-if="!r.contractId"
            size="xs"
            variant="soft"
            label="На подпись"
            @click="send([r.id])"
          />
          <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            label="Скан"
            @click="scan(r)"
          />
        </div>
      </li>
    </ul>
    <div class="flex flex-wrap items-center gap-2 mt-3">
      <UButton
        v-if="toSend.length"
        size="sm"
        icon="i-lucide-send"
        :label="`Отправить рекомендуемые · ${toSend.length}`"
        @click="send(toSend.map(r => r.id))"
      />
      <template v-if="links">
        <code class="text-xs bg-(--ui-bg-muted) rounded px-2 py-1 truncate max-w-80">{{ links.client }}</code>
        <UButton
          size="xs"
          variant="soft"
          icon="i-lucide-copy"
          label="Копировать ссылку"
          @click="copy"
        />
      </template>
    </div>
    <UModal
      v-model:open="textOpen"
      :title="text?.name"
      :ui="{ content: 'sm:max-w-2xl' }"
    >
      <template #body>
        <div class="bg-white text-[#111] rounded p-8 font-serif text-sm whitespace-pre-wrap leading-relaxed max-h-[60vh] overflow-y-auto">
          {{ text?.text }}
        </div>
      </template>
    </UModal>
  </StepSection>
</template>
