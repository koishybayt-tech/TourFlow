<script setup lang="ts">
import { LOST_REASONS, type Pipeline } from '#shared/domain/types'
import { suggestStageOnPipelineChange } from '#shared/domain/dealStatus'
import type { Advanced, DealView } from '~/types/deal'

definePageMeta({ middleware: 'role', permission: 'deals' })

const route = useRoute()
const id = computed(() => String(route.params.id))
const { data: view, refresh, error } = await useFetch<DealView>(() => `/api/deals/${id.value}`)
useHead(() => ({ title: view.value ? `№${view.value.deal.number} · ${view.value.client.name} — Tourflow` : 'Заявка — Tourflow' }))
const { can, isOwner } = usePermissions()
const { me } = useMe()
const notify = useNotify()

useLiveListener((e) => {
  if (e.type === 'deal' && e.dealId === id.value) refresh()
})

// Status badge "flows" when the stage changes.
const statusFlash = ref(false)
async function onChanged(r?: { advanced?: Advanced | { from: string, to: string } | null, moved?: { from: string, to: string } | null } | null) {
  await refresh()
  const a = r?.advanced
  if (a) {
    notify.info('Статус обновлён автоматически', `${a.from} → ${a.to}`)
    statusFlash.value = true
    setTimeout(() => (statusFlash.value = false), 900)
  }
  else if (r?.moved) {
    statusFlash.value = true
    setTimeout(() => (statusFlash.value = false), 900)
  }
  refreshNuxtData('badges')
}

// Sections: open state; done ones start collapsed.
type Key = 'client' | 'tour' | 'pay' | 'contract' | 'receipts' | 'visa' | 'docs' | 'tasks'
const sections = computed(() => {
  const v = view.value
  if (!v) return [] as { key: Key, title: string, done: boolean }[]
  const reqSec = (k: string) => v.status.requirements.filter(r => r.section === k)
  const all = [
    { key: 'client' as Key, title: 'Клиент и туристы', done: !!(v.client.fullName && v.client.hasIin && v.client.address) && v.travelers.length >= v.deal.people && v.travelers.every(t => t.hasPassport) },
    { key: 'tour' as Key, title: 'Тур', done: v.deal.pipeline === 'PACKAGE' ? v.offers.some(o => o.status === 'CHOSEN') && v.bookings.some(b => b.status === 'CONFIRMED' || b.status === 'PAID') : reqSec('tour').length ? reqSec('tour').every(r => r.done) : !!v.deal.dates },
    ...(v.money ? [{ key: 'pay' as Key, title: 'Цена и оплаты', done: v.money.price > 0 && v.money.paid >= v.money.price }] : []),
    ...(can('documents') ? [{ key: 'contract' as Key, title: 'Договор', done: v.contracts.some(c => c.kind === 'contract' && !c.annulledAt && (c.status === 'SIGNED' || c.status === 'PAPER')) || v.documents.some(d => d.type === 'Подписанный договор') }] : []),
    ...(can('documents') ? [{ key: 'receipts' as Key, title: 'Расписки', done: false }] : []),
    ...(v.departure?.visa ? [{ key: 'visa' as Key, title: 'Виза', done: v.calendar.some(e => e.type === 'visa') && v.documents.some(d => d.type === 'Виза') }] : []),
    ...(can('documents') ? [{ key: 'docs' as Key, title: 'Документы', done: false }] : []),
    { key: 'tasks' as Key, title: 'Задачи', done: false },
  ]
  return all
})
const openState = reactive<Record<string, boolean>>({})
watch(() => view.value?.deal.id, () => {
  for (const s of sections.value) openState[s.key] = !s.done && s.key !== 'docs' && s.key !== 'receipts'
}, { immediate: true })
const numOf = (k: Key) => sections.value.findIndex(s => s.key === k) + 1
function jump(k: string) {
  const key = (k === 'status' ? 'tasks' : k) as Key
  openState[key] = true
  nextTick(() => document.getElementById(`sec-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}
function collapseDone() {
  for (const s of sections.value) openState[s.key] = !s.done
}
function expandAll() {
  for (const s of sections.value) openState[s.key] = true
}
onMounted(() => {
  if (route.hash.startsWith('#sec-')) setTimeout(() => jump(route.hash.slice(5)), 300)
})

// Documents upload from other sections
const docsRef = ref<{ startUpload: (t?: string) => void } | null>(null)
function upload(type: string) {
  openState.docs = true
  docsRef.value?.startUpload(type)
}

// Tasks slideover
const taskId = ref<string | null>(null)

// Header actions
async function setManager(managerId: string | null) {
  if (await mutate(() => api(`/api/deals/${id.value}/manager`, { method: 'POST', body: { managerId } }), 'Ответственный изменён')) refresh()
}
const lostOpen = ref(false)
const lost = reactive({ reason: LOST_REASONS[0] as string, comment: '' })
async function markLost() {
  if (await mutate(() => api(`/api/deals/${id.value}/lost`, { method: 'POST', body: lost }), 'Заявка закрыта с отказом')) {
    lostOpen.value = false
    refresh()
  }
}
const pipeOpen = ref(false)
const pipe = reactive<{ pipeline: Pipeline, order: number, departureId: string | null, reason: string }>({ pipeline: 'PACKAGE', order: 0, departureId: null, reason: '' })
const pipeStages = ref<{ order: number, name: string }[]>([])
async function openPipeline() {
  const v = view.value!
  pipe.pipeline = v.deal.pipeline === 'GROUP' ? 'PACKAGE' : 'GROUP'
  pipe.reason = ''
  pipe.departureId = null
  pipeOpen.value = true
}
watch(() => [pipe.pipeline, pipeOpen.value], async () => {
  if (!pipeOpen.value) return
  const r = await api<{ stages: { order: number, name: string }[] }>('/api/deals', { query: { pipeline: pipe.pipeline, status: 'won' } })
  pipeStages.value = r.stages
  pipe.order = suggestStageOnPipelineChange(view.value!.stages.map(s => s.name), view.value!.status.order, r.stages.map(s => s.name))
})
async function changePipeline() {
  const r = await mutate(() => api<{ advanced: null }>(`/api/deals/${id.value}/pipeline`, { method: 'POST', body: pipe }), 'Воронка изменена')
  if (r) {
    pipeOpen.value = false
    onChanged(r)
  }
}
const PIPES = [{ value: 'GROUP', label: 'Групповые туры' }, { value: 'PACKAGE', label: 'Пакетные туры' }, { value: 'BASE', label: 'Базовая' }]
</script>

<template>
  <AppPage
    v-if="view"
    :title="`№${view.deal.number} · ${view.client.name}`"
    :subtitle="view.deal.title"
    back="/deals"
  >
    <template #actions>
      <UButton
        v-if="!view.deal.lostAt && !view.deal.wonAt"
        color="neutral"
        variant="ghost"
        icon="i-lucide-git-branch"
        label="Сменить воронку"
        class="hidden md:inline-flex"
        @click="openPipeline"
      />
      <UButton
        v-if="!view.deal.lostAt && !view.deal.wonAt"
        color="error"
        variant="soft"
        icon="i-lucide-x"
        label="Отказ"
        @click="lostOpen = true"
      />
    </template>

    <!-- Header -->
    <div class="card p-5 flex flex-wrap items-center gap-x-6 gap-y-3">
      <div class="flex items-center gap-3 min-w-0">
        <UAvatar
          :text="initials(view.client.name)"
          size="lg"
        />
        <div class="min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <NuxtLink
              :to="`/clients/${view.client.id}`"
              class="font-semibold text-lg hover:underline"
            >{{ view.client.name }}</NuxtLink>
            <span
              class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium transition-all duration-500"
              :class="[view.deal.lostAt ? 'bg-bad-bg text-bad-text' : view.deal.wonAt ? 'bg-ok-bg text-ok-text' : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300', statusFlash && 'status-flash']"
            >{{ view.deal.lostAt ? 'Отказ' : view.deal.wonAt ? 'Успешно' : view.status.stageName }}</span>
          </div>
          <p class="text-sm text-(--ui-text-muted)">
            {{ view.deal.title }} · {{ view.deal.people }} чел.<template v-if="view.deal.dates">
              · {{ view.deal.dates }}
            </template>
          </p>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <a
          :href="`tel:${view.client.phone}`"
          class="tabular hover:underline"
        >{{ formatPhone(view.client.phone) }}</a>
        <ChannelBadge :channel="view.deal.source" />
        <UBadge
          v-if="view.deal.direction"
          variant="subtle"
          color="neutral"
          icon="i-lucide-compass"
          :label="view.deal.direction.name"
        />
        <span class="text-(--ui-text-muted)">{{ PIPELINE_LABELS[view.deal.pipeline] }}</span>
      </div>
      <div class="ml-auto flex items-center gap-2 text-sm">
        <span class="text-(--ui-text-muted)">Ведёт</span>
        <USelect
          v-if="isOwner"
          :model-value="view.deal.managerId ?? undefined"
          :items="(me?.members ?? []).map(m => ({ value: m.id, label: m.name }))"
          placeholder="Не назначен"
          size="sm"
          class="w-40"
          @update:model-value="setManager($event as string)"
        />
        <span
          v-else
          class="font-medium"
        >{{ view.deal.manager ?? 'Не назначен' }}</span>
      </div>
    </div>

    <!-- Sticky steps -->
    <div class="sticky top-0 z-10 -mx-6 lg:-mx-8 px-6 lg:px-8 py-2 bg-(--ui-bg)/90 backdrop-blur flex items-center gap-2 overflow-x-auto">
      <button
        v-for="(s, i) in sections"
        :key="s.key"
        class="flex items-center gap-1.5 shrink-0 rounded-full px-2.5 py-1 text-xs hover:bg-(--ui-bg-muted)"
        :class="s.done ? 'text-ok-text' : 'text-(--ui-text-toned)'"
        @click="jump(s.key)"
      >
        <span
          class="size-4 rounded-full grid place-items-center text-[10px] font-semibold"
          :class="s.done ? 'bg-ok text-white' : 'bg-(--ui-bg-accented)'"
        >
          <UIcon
            v-if="s.done"
            name="i-lucide-check"
            class="size-3"
          /><template v-else>{{ i + 1 }}</template>
        </span>
        {{ s.title }}
      </button>
      <span class="flex-1" />
      <UButton
        size="xs"
        variant="ghost"
        color="neutral"
        label="Свернуть готовые"
        @click="collapseDone"
      />
      <UButton
        size="xs"
        variant="ghost"
        color="neutral"
        label="Развернуть всё"
        @click="expandAll"
      />
    </div>

    <div class="grid gap-6 xl:grid-cols-[1fr_360px] items-start">
      <div class="space-y-4 min-w-0">
        <DealClientSection
          v-model:open="openState.client"
          :view="view"
          :num="numOf('client')"
          @changed="onChanged"
        />
        <DealTourSection
          v-model:open="openState.tour"
          :view="view"
          :num="numOf('tour')"
          @changed="onChanged"
          @upload="upload"
        />
        <DealPaymentsSection
          v-if="view.money"
          v-model:open="openState.pay"
          :view="view"
          :num="numOf('pay')"
          @changed="onChanged"
        />
        <DealContractSection
          v-if="can('documents')"
          v-model:open="openState.contract"
          :view="view"
          :num="numOf('contract')"
          @changed="onChanged"
          @upload="upload"
        />
        <DealReceiptsSection
          v-if="can('documents')"
          v-model:open="openState.receipts"
          :view="view"
          :num="numOf('receipts')"
          @changed="onChanged"
        />
        <DealVisaSection
          v-if="view.departure?.visa"
          v-model:open="openState.visa"
          :view="view"
          :num="numOf('visa')"
          @changed="onChanged"
          @upload="upload"
        />
        <DealDocumentsSection
          v-if="can('documents')"
          ref="docsRef"
          v-model:open="openState.docs"
          :view="view"
          :num="numOf('docs')"
          @changed="onChanged"
        />
        <DealTasksSection
          v-model:open="openState.tasks"
          :view="view"
          :num="numOf('tasks')"
          @changed="onChanged"
          @open-task="taskId = $event"
        />
      </div>
      <aside class="space-y-4 xl:sticky xl:top-14">
        <DealStatusCard
          :view="view"
          @changed="onChanged"
          @jump="jump"
          @open-task="taskId = $event"
        />
        <DealSideCards
          :view="view"
          @changed="refresh"
        />
      </aside>
    </div>

    <TaskSlideover
      :task-id="taskId"
      @close="taskId = null"
      @changed="onChanged"
    />

    <UModal
      v-model:open="lostOpen"
      title="Закрыть заявку с отказом"
    >
      <template #body>
        <form
          class="space-y-4"
          @submit.prevent="markLost"
        >
          <UFormField label="Причина">
            <USelect
              v-model="lost.reason"
              :items="LOST_REASONS.map(r => ({ value: r as string, label: r as string }))"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Комментарий">
            <UTextarea
              v-model="lost.comment"
              :rows="2"
              class="w-full"
            />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              label="Отмена"
              @click="lostOpen = false"
            />
            <UButton
              type="submit"
              color="error"
              label="Закрыть с отказом"
            />
          </div>
        </form>
      </template>
    </UModal>

    <UModal
      v-model:open="pipeOpen"
      title="Сменить воронку"
      description="Системная задача текущего этапа закроется, для нового этапа — создастся. Остальные данные сохранятся."
    >
      <template #body>
        <form
          class="space-y-4"
          @submit.prevent="changePipeline"
        >
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Воронка">
              <USelect
                v-model="pipe.pipeline"
                :items="PIPES.filter(p => p.value !== view!.deal.pipeline)"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Этап">
              <USelect
                v-model="pipe.order"
                :items="pipeStages.map(s => ({ value: s.order, label: s.name }))"
                class="w-full"
              />
            </UFormField>
          </div>
          <UFormField
            v-if="pipe.pipeline === 'GROUP'"
            label="Выезд"
          >
            <USelect
              v-model="pipe.departureId"
              :items="[{ value: null, label: 'Не выбран' }, ...view.departures.map(d => ({ value: d.id, label: d.label }))]"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Причина">
            <UInput
              v-model="pipe.reason"
              class="w-full"
              placeholder="Например: клиент передумал ехать группой"
            />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              label="Отмена"
              @click="pipeOpen = false"
            />
            <UButton
              type="submit"
              label="Сменить воронку"
            />
          </div>
        </form>
      </template>
    </UModal>
  </AppPage>
  <AppPage
    v-else-if="error"
    title="Заявка"
    back="/deals"
  >
    <div class="card">
      <EmptyState
        icon="i-lucide-file-x"
        :text="error.statusMessage || 'Заявка не найдена'"
      />
    </div>
  </AppPage>
</template>

<style scoped>
.status-flash { animation: flash 900ms ease-out; }
@keyframes flash {
  0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(18, 183, 106, .5); background: var(--color-ok-bg); color: var(--color-ok-text); }
  40% { transform: scale(1.08); box-shadow: 0 0 0 8px rgba(18, 183, 106, 0); }
  100% { transform: scale(1); }
}
@media (prefers-reduced-motion: reduce) { .status-flash { animation: none; } }
</style>
