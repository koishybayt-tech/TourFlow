<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import type { Pipeline } from '#shared/domain/types'

definePageMeta({ middleware: 'role', permission: 'deals' })
useHead({ title: 'Заявки — Tourflow' })

interface DealRow {
  id: string
  number: number
  client: string
  title: string
  source: string
  people: number
  dates: string | null
  stageId: string
  stage: string
  stageOrder: number
  managerId: string | null
  manager: string | null
  price: number | null
  paid: number | null
  paidPct: number | null
  createdAt: string
  wonAt: string | null
  lostAt: string | null
  lostReason: string | null
  done: number
  total: number
}
interface StageCol { id: string, name: string, order: number, count: number, sum: number | null }

const route = useRoute()
const router = useRouter()
const { me } = useMe()
const { can } = usePermissions()
const { module } = usePermissions()

const PIPES = computed(() => [
  { value: 'GROUP', label: 'Групповые туры' },
  ...(module('package') ? [{ value: 'PACKAGE', label: 'Пакетные туры' }] : []),
  { value: 'BASE', label: 'Базовая' },
])
const pipeline = computed<Pipeline>({ get: () => (route.query.pipeline as Pipeline) || 'GROUP', set: v => router.replace({ query: { ...route.query, pipeline: v } }) })
const view = computed<'kanban' | 'list'>({ get: () => (route.query.view as 'kanban' | 'list') || 'kanban', set: v => router.replace({ query: { ...route.query, view: v } }) })
const manager = computed<string>({ get: () => (route.query.manager as string) || 'all', set: v => router.replace({ query: { ...route.query, manager: v === 'all' ? undefined : v } }) })
const status = computed<string>({ get: () => (route.query.status as string) || 'active', set: v => router.replace({ query: { ...route.query, status: v } }) })
const q = ref('')

const query = computed(() => ({ pipeline: pipeline.value, manager: manager.value === 'all' ? undefined : manager.value, status: view.value === 'kanban' ? 'active' : status.value, q: refDebounced(q, 250).value || undefined }))
const { data, refresh, status: loadStatus } = await useFetch<{ stages: StageCol[], deals: DealRow[] }>('/api/deals', { query, default: () => ({ stages: [], deals: [] }) })
useLiveListener((e) => {
  if (e.type === 'deal') refresh()
})

// Kanban columns (local copies for drag-and-drop)
const columns = ref<Record<string, DealRow[]>>({})
watch(data, (d) => {
  const map: Record<string, DealRow[]> = {}
  for (const s of d.stages) map[s.id] = d.deals.filter(x => x.stageId === s.id && !x.wonAt && !x.lostAt)
  columns.value = map
}, { immediate: true })

const BAR = (i: number, n: number) => (i === 0 ? 'bg-(--ui-border)' : i === n - 1 ? 'bg-ok' : 'bg-(--ui-primary)')

// Drag → manual stage change with confirmation when the regulation is not met.
const pending = ref<{ deal: DealRow, to: StageCol } | null>(null)
const reason = ref('')
function onAdd(e: { item: HTMLElement }, to: StageCol) {
  const deal = data.value.deals.find(d => d.id === e.item.dataset.id)
  if (!deal || deal.stageId === to.id) return
  if (deal.done < deal.total || to.order < deal.stageOrder) {
    pending.value = { deal, to }
    reason.value = ''
  }
  else move(deal, to)
}
async function move(deal: DealRow, to: StageCol, why?: string) {
  pending.value = null
  const r = await mutate(() => api<{ advanced: { from: string, to: string } | null }>(`/api/deals/${deal.id}/stage`, { method: 'POST', body: { order: to.order, reason: why || undefined } }), `№${deal.number}: этап «${to.name}»`)
  if (r?.advanced) useNotify().info('Статус обновлён автоматически', `${r.advanced.from} → ${r.advanced.to}`)
  await refresh()
}
function cancelMove() {
  pending.value = null
  refresh()
}

const newOpen = ref(false)
const managerItems = computed(() => [{ value: 'all', label: 'Все менеджеры' }, { value: 'none', label: 'Без ответственного' }, ...(me.value?.members ?? []).map(m => ({ value: m.id, label: m.name }))])
</script>

<template>
  <AppPage
    title="Заявки"
    :subtitle="`${data.deals.length} ${plural(data.deals.length, 'заявка', 'заявки', 'заявок')}${view === 'kanban' ? ' в работе' : ''}`"
  >
    <template #actions>
      <UButton
        icon="i-lucide-plus"
        label="Новая заявка"
        @click="newOpen = true"
      />
    </template>

    <div class="flex flex-wrap items-center gap-3">
      <div class="flex rounded-lg border border-(--ui-border) p-0.5 bg-(--ui-bg-elevated)">
        <UButton
          v-for="p in PIPES"
          :key="p.value"
          size="sm"
          :variant="pipeline === p.value ? 'soft' : 'ghost'"
          :color="pipeline === p.value ? 'primary' : 'neutral'"
          :label="p.label"
          @click="pipeline = p.value as Pipeline"
        />
      </div>
      <USelect
        v-if="can('deals.all')"
        v-model="manager"
        :items="managerItems"
        size="sm"
        class="w-48"
      />
      <UInput
        v-model="q"
        size="sm"
        icon="i-lucide-search"
        placeholder="Клиент или запрос"
        class="w-56"
      />
      <USelect
        v-if="view === 'list'"
        v-model="status"
        :items="[{ value: 'active', label: 'В работе' }, { value: 'won', label: 'Успешные' }, { value: 'lost', label: 'Отказы' }, { value: 'all', label: 'Все' }]"
        size="sm"
        class="w-36"
      />
      <div class="ml-auto flex rounded-lg border border-(--ui-border) p-0.5 bg-(--ui-bg-elevated)">
        <UButton
          size="sm"
          icon="i-lucide-columns-3"
          :variant="view === 'kanban' ? 'soft' : 'ghost'"
          :color="view === 'kanban' ? 'primary' : 'neutral'"
          label="Канбан"
          @click="view = 'kanban'"
        />
        <UButton
          size="sm"
          icon="i-lucide-list"
          :variant="view === 'list' ? 'soft' : 'ghost'"
          :color="view === 'list' ? 'primary' : 'neutral'"
          label="Список"
          @click="view = 'list'"
        />
      </div>
    </div>

    <!-- Kanban -->
    <div
      v-if="view === 'kanban'"
      class="flex gap-3 overflow-x-auto pb-2 snap-x -mx-6 px-6 lg:-mx-8 lg:px-8 flex-1 min-h-[480px]"
    >
      <div
        v-for="(s, i) in data.stages"
        :key="s.id"
        class="kanban-col snap-start shrink-0 w-[280px] rounded-xl bg-(--ui-bg-muted) flex flex-col overflow-hidden"
      >
        <div
          class="h-1"
          :class="BAR(i, data.stages.length)"
        />
        <div class="px-3 pt-2.5 pb-2">
          <div class="flex items-center justify-between gap-2">
            <span class="font-semibold text-sm truncate">{{ s.name }}</span>
            <UBadge
              size="sm"
              color="neutral"
              variant="subtle"
              :label="String(columns[s.id]?.length ?? 0)"
            />
          </div>
          <p
            v-if="s.sum !== null"
            class="text-xs text-(--ui-text-muted) tabular mt-0.5"
          >
            {{ formatMoney((columns[s.id] ?? []).reduce((a, d) => a + (d.price ?? 0), 0)) }}
          </p>
        </div>
        <VueDraggable
          v-model="columns[s.id]!"
          group="deals"
          :animation="180"
          ghost-class="kanban-ghost"
          chosen-class="kanban-chosen"
          drag-class="kanban-drag"
          class="flex-1 overflow-y-auto px-2 pb-2 space-y-2 min-h-24"
          @add="onAdd($event, s)"
        >
          <NuxtLink
            v-for="d in columns[s.id]"
            :key="d.id"
            :data-id="d.id"
            :to="`/deals/${d.id}`"
            class="block card p-3 hover:border-(--ui-primary)/40 transition-[border-color,box-shadow] cursor-grab active:cursor-grabbing"
            draggable="false"
          >
            <div class="flex items-start justify-between gap-2">
              <span class="font-medium text-sm leading-snug">{{ d.client }}</span>
              <span class="text-[11px] text-(--ui-text-dimmed) tabular">№{{ d.number }}</span>
            </div>
            <p class="text-xs text-(--ui-text-muted) truncate mt-0.5">
              {{ d.title }}
            </p>
            <div class="flex flex-wrap gap-1 mt-2">
              <ChannelBadge :channel="d.source" />
              <UBadge
                size="sm"
                color="neutral"
                variant="subtle"
                :label="`${d.people} чел.`"
              />
              <UBadge
                v-if="d.dates"
                size="sm"
                color="neutral"
                variant="subtle"
                :label="d.dates"
              />
            </div>
            <div
              v-if="d.paidPct !== null && d.price"
              class="mt-2.5"
            >
              <div class="flex justify-between text-[11px] text-(--ui-text-muted)">
                <span>Оплачено {{ d.paidPct }}%</span><span class="tabular">{{ formatMoney(d.price) }}</span>
              </div>
              <div class="h-1 rounded-full bg-(--ui-bg-accented) mt-1 overflow-hidden">
                <div
                  class="h-full rounded-full transition-[width] duration-500"
                  :class="d.paidPct >= 100 ? 'bg-ok' : 'bg-(--ui-primary)'"
                  :style="{ width: `${d.paidPct}%` }"
                />
              </div>
            </div>
            <div class="flex items-center justify-between mt-2.5 text-[11px] text-(--ui-text-muted)">
              <span class="flex items-center gap-1"><UAvatar
                :text="initials(d.manager)"
                size="3xs"
              /> {{ d.manager ?? 'Не назначен' }}</span>
              <span
                v-if="d.total"
                :class="d.done === d.total ? 'text-ok-text' : ''"
              >{{ d.done }}/{{ d.total }}</span>
            </div>
          </NuxtLink>
        </VueDraggable>
      </div>
      <div
        v-if="loadStatus === 'pending' && !data.stages.length"
        class="flex gap-3"
      >
        <div
          v-for="i in 5"
          :key="i"
          class="skeleton w-[280px] h-96"
        />
      </div>
    </div>

    <!-- List -->
    <div
      v-else
      class="card overflow-x-auto"
    >
      <table class="w-full text-sm min-w-[860px]">
        <thead class="text-left text-xs text-(--ui-text-muted) border-b border-(--ui-border)">
          <tr>
            <th class="px-5 py-2.5 font-medium">
              №
            </th><th class="px-3 py-2.5 font-medium">
              Клиент и запрос
            </th><th class="px-3 py-2.5 font-medium">
              Этап
            </th><th class="px-3 py-2.5 font-medium">
              Ответственный
            </th>
            <th
              v-if="can('payments')"
              class="px-3 py-2.5 font-medium text-right"
            >
              Сумма
            </th><th
              v-if="can('payments')"
              class="px-3 py-2.5 font-medium"
            >
              Оплата
            </th><th class="px-5 py-2.5 font-medium">
              Создана
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="d in data.deals"
            :key="d.id"
            class="border-b border-(--ui-border-muted) last:border-0 hover:bg-(--ui-bg-muted) cursor-pointer"
            @click="navigateTo(`/deals/${d.id}`)"
          >
            <td class="px-5 py-3 tabular text-(--ui-text-muted)">
              {{ d.number }}
            </td>
            <td class="px-3 py-3">
              <p class="font-medium">
                {{ d.client }}
              </p><p class="text-xs text-(--ui-text-muted) truncate max-w-72">
                {{ d.title }}
              </p>
            </td>
            <td class="px-3 py-3">
              <UBadge
                v-if="d.lostAt"
                color="error"
                variant="subtle"
                :label="`Отказ: ${d.lostReason}`"
              />
              <UBadge
                v-else-if="d.wonAt"
                color="success"
                variant="subtle"
                label="Успешно"
              />
              <span v-else>{{ d.stage }} <span class="text-xs text-(--ui-text-muted)">· {{ d.done }}/{{ d.total }}</span></span>
            </td>
            <td class="px-3 py-3">
              {{ d.manager ?? '—' }}
            </td>
            <td
              v-if="can('payments')"
              class="px-3 py-3 text-right tabular"
            >
              {{ d.price ? formatMoney(d.price) : '—' }}
            </td>
            <td
              v-if="can('payments')"
              class="px-3 py-3 w-36"
            >
              <UProgress
                v-if="d.price"
                :model-value="d.paidPct ?? 0"
                size="xs"
                :color="(d.paidPct ?? 0) >= 100 ? 'success' : 'primary'"
              />
            </td>
            <td class="px-5 py-3 text-(--ui-text-muted) tabular">
              {{ formatDate(d.createdAt) }}
            </td>
          </tr>
        </tbody>
      </table>
      <EmptyState
        v-if="!data.deals.length"
        icon="i-lucide-kanban-square"
        text="Заявок нет. Создайте заявку вручную или из диалога в «Сообщениях»."
        action="Новая заявка"
        @action="newOpen = true"
      />
    </div>

    <DealNewDealModal
      v-model:open="newOpen"
      :pipeline="pipeline"
    />

    <UModal
      :open="!!pending"
      title="Сменить этап вручную?"
      :description="pending ? `№${pending.deal.number} · ${pending.deal.client}: «${pending.deal.stage}» → «${pending.to.name}»` : ''"
      @update:open="v => !v && cancelMove()"
    >
      <template #body>
        <div class="space-y-4">
          <UAlert
            v-if="pending && pending.deal.done < pending.deal.total"
            color="warning"
            variant="subtle"
            icon="i-lucide-alert-triangle"
            :title="`Регламент этапа выполнен на ${pending.deal.done} из ${pending.deal.total}`"
            description="Обычно статус меняется сам, когда условия выполнены. Ручная смена запишется в историю."
          />
          <UFormField label="Причина (необязательно)">
            <UInput
              v-model="reason"
              class="w-full"
              placeholder="Например: клиент оплатил наличными в офисе"
            />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              label="Отмена"
              @click="cancelMove"
            />
            <UButton
              label="Сменить этап"
              @click="pending && move(pending.deal, pending.to, reason)"
            />
          </div>
        </div>
      </template>
    </UModal>
  </AppPage>
</template>

<style scoped>
.kanban-ghost { opacity: .35; }
.kanban-chosen { transform: scale(1.02); box-shadow: var(--shadow-pop); }
.kanban-col:has(.kanban-ghost) { outline: 2px dashed color-mix(in srgb, var(--ui-primary) 35%, transparent); outline-offset: -2px; }
@media (prefers-reduced-motion: reduce) { .kanban-chosen { transform: none; } }
</style>
