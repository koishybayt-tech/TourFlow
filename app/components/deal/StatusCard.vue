<script setup lang="ts">
import type { DealChanged, DealView, ReqView } from '~/types/deal'

const props = defineProps<{ view: DealView }>()
const emit = defineEmits<{ changed: Parameters<DealChanged>, jump: [section: string], openTask: [id: string] }>()
const s = computed(() => props.view.status)
const closed = computed(() => !!(props.view.deal.wonAt || props.view.deal.lostAt))
const missing = computed(() => s.value.requirements.filter(r => !r.done))
const pct = computed(() => (s.value.totalCount ? Math.round((s.value.doneCount / s.value.totalCount) * 100) : 100))
const drafts = reactive<Record<string, string>>({})

async function patch(body: Record<string, unknown>) {
  const r = await mutate(() => api<{ advanced: null }>(`/api/deals/${props.view.deal.id}`, { method: 'PATCH', body }))
  if (r) emit('changed', r)
}
const check = (r: ReqView, v: boolean) => patch({ reqChecks: { [r.id]: v } })
function comment(r: ReqView) {
  const v = (drafts[r.id] ?? '').trim()
  if (v) patch({ reqComments: { [r.id]: v } })
}

// Manual stage change from the dropdown
const pendingOrder = ref<number | null>(null)
const reason = ref('')
function pickStage(order: number) {
  if (order === s.value.order) return
  pendingOrder.value = order
  reason.value = ''
}
async function confirmStage() {
  const order = pendingOrder.value!
  pendingOrder.value = null
  const r = await mutate(() => api<{ advanced: null }>(`/api/deals/${props.view.deal.id}/stage`, { method: 'POST', body: { order, reason: reason.value || undefined } }), 'Этап изменён')
  if (r) emit('changed', r)
}
async function finish() {
  if (await mutate(() => api(`/api/deals/${props.view.deal.id}/won`, { method: 'POST' }), 'Заявка успешно завершена')) emit('changed')
}
async function reopen() {
  if (await mutate(() => api(`/api/deals/${props.view.deal.id}/reopen`, { method: 'POST' }), 'Заявка возвращена в работу')) emit('changed')
}
const TYPE_ICON: Record<string, string> = { FIELD: 'i-lucide-text-cursor-input', DOC: 'i-lucide-file', SIGN: 'i-lucide-pen-line', PAY: 'i-lucide-wallet', COMMENT: 'i-lucide-message-square', CHECK: 'i-lucide-square-check', DEPARTURE: 'i-lucide-bus', TRAVELERS: 'i-lucide-users', EVENT: 'i-lucide-calendar', CLIENT: 'i-lucide-id-card' }
</script>

<template>
  <div class="card p-5 space-y-4">
    <div class="flex items-center justify-between">
      <h3 class="font-semibold">
        Статус заявки
      </h3>
      <span class="text-xs text-(--ui-text-muted)">этап {{ s.order + 1 }} из {{ s.total }}</span>
    </div>

    <template v-if="closed">
      <UAlert
        :color="view.deal.wonAt ? 'success' : 'error'"
        variant="subtle"
        :icon="view.deal.wonAt ? 'i-lucide-party-popper' : 'i-lucide-x-circle'"
        :title="view.deal.wonAt ? 'Заявка успешно завершена' : `Отказ: ${view.deal.lostReason}`"
        :description="view.deal.lostComment ?? undefined"
      />
      <UButton
        block
        variant="outline"
        color="neutral"
        icon="i-lucide-rotate-ccw"
        label="Вернуть в работу"
        @click="reopen"
      />
    </template>
    <template v-else>
      <USelect
        :model-value="s.order"
        :items="view.stages.map(x => ({ value: x.order, label: `${x.order + 1}. ${x.name}` }))"
        class="w-full"
        aria-label="Этап заявки"
        @update:model-value="pickStage($event as number)"
      />
      <div>
        <div class="flex justify-between text-xs text-(--ui-text-muted) mb-1">
          <span>Регламент этапа</span><span class="tabular">{{ s.doneCount }} из {{ s.totalCount }}</span>
        </div>
        <div class="h-1.5 rounded-full bg-(--ui-bg-accented) overflow-hidden">
          <div
            class="h-full rounded-full transition-[width] duration-500"
            :class="pct === 100 ? 'bg-ok' : 'bg-(--ui-primary)'"
            :style="{ width: `${pct}%` }"
          />
        </div>
      </div>
      <p class="text-xs text-(--ui-text-muted) flex gap-1.5">
        <UIcon
          name="i-lucide-sparkles"
          class="shrink-0 mt-0.5 text-(--ui-primary)"
        /> Статус меняется сам, когда выполнены условия текущего этапа.
      </p>
      <p class="text-sm text-(--ui-text-toned)">
        {{ s.description }}
      </p>

      <div v-if="missing.length || s.openTasks.length">
        <p class="text-xs font-semibold uppercase tracking-wide text-(--ui-text-muted) mb-2">
          Осталось для следующего статуса
        </p>
        <ul class="space-y-2">
          <li
            v-for="r in missing"
            :key="r.id"
            class="text-sm"
          >
            <div
              v-if="r.type === 'CHECK'"
              class="flex items-start gap-2"
            >
              <UCheckbox
                :model-value="false"
                :label="r.label + (r.required ? '' : ' (необязательно)')"
                @update:model-value="check(r, !!$event)"
              />
            </div>
            <form
              v-else-if="r.type === 'COMMENT'"
              class="space-y-1"
              @submit.prevent="comment(r)"
            >
              <p class="flex items-center gap-2">
                <UIcon
                  :name="TYPE_ICON.COMMENT!"
                  class="text-(--ui-text-muted)"
                />{{ r.label }}<span
                  v-if="!r.required"
                  class="text-(--ui-text-dimmed)"
                > (необяз.)</span>
              </p>
              <div class="flex gap-1">
                <UInput
                  v-model="drafts[r.id]"
                  size="sm"
                  class="flex-1"
                  placeholder="Комментарий"
                />
                <UButton
                  type="submit"
                  size="sm"
                  icon="i-lucide-check"
                  aria-label="Сохранить"
                />
              </div>
            </form>
            <button
              v-else
              type="button"
              class="flex items-center gap-2 w-full text-left hover:text-(--ui-primary)"
              @click="emit('jump', r.section)"
            >
              <UIcon
                :name="TYPE_ICON[r.type] ?? 'i-lucide-circle'"
                class="text-(--ui-text-muted) shrink-0"
              />
              <span class="flex-1">{{ r.label }}<span
                v-if="!r.required"
                class="text-(--ui-text-dimmed)"
              > (необяз.)</span></span>
              <UIcon
                name="i-lucide-arrow-down-right"
                class="size-3.5 text-(--ui-text-dimmed)"
              />
            </button>
          </li>
          <li
            v-for="t in s.openTasks"
            :key="t.id"
          >
            <button
              type="button"
              class="flex items-center gap-2 text-sm hover:text-(--ui-primary)"
              @click="emit('openTask', t.id)"
            >
              <UIcon
                name="i-lucide-check-square"
                class="text-(--ui-text-muted)"
              />Задача этапа: {{ t.title }}
            </button>
          </li>
        </ul>
      </div>
      <UAlert
        v-else-if="!s.isLast"
        color="success"
        variant="subtle"
        icon="i-lucide-check-circle-2"
        title="Регламент выполнен"
      />
      <UButton
        v-if="s.isLast"
        block
        color="success"
        icon="i-lucide-flag"
        label="Завершить заявку"
        @click="finish"
      />
      <div v-if="s.requirements.some(r => r.done)">
        <p class="text-xs text-(--ui-text-muted) mb-1">
          Выполнено
        </p>
        <ul class="space-y-1">
          <li
            v-for="r in s.requirements.filter(x => x.done)"
            :key="r.id"
            class="text-xs flex items-center gap-1.5 text-(--ui-text-muted)"
          >
            <UIcon
              name="i-lucide-check"
              class="text-ok"
            /> {{ r.label }}
            <button
              v-if="r.type === 'CHECK'"
              class="ml-auto hover:text-(--ui-text)"
              aria-label="Снять отметку"
              @click="check(r, false)"
            >
              <UIcon name="i-lucide-x" />
            </button>
          </li>
        </ul>
      </div>
    </template>

    <UModal
      :open="pendingOrder !== null"
      title="Сменить этап вручную?"
      :description="pendingOrder !== null ? `«${s.stageName}» → «${view.stages.find(x => x.order === pendingOrder)?.name}»` : ''"
      @update:open="v => !v && (pendingOrder = null)"
    >
      <template #body>
        <div class="space-y-4">
          <UAlert
            v-if="!s.complete"
            color="warning"
            variant="subtle"
            icon="i-lucide-alert-triangle"
            :title="`Регламент выполнен на ${s.doneCount} из ${s.totalCount}`"
            description="Регламент — подсказка, а не блокировка. Ручная смена запишется в историю."
          />
          <UFormField label="Причина (необязательно)">
            <UInput
              v-model="reason"
              class="w-full"
            />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              label="Отмена"
              @click="pendingOrder = null"
            />
            <UButton
              label="Сменить этап"
              @click="confirmStage"
            />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
