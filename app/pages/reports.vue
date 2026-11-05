<script setup lang="ts">
import type { Pipeline } from '#shared/domain/types'

definePageMeta({ middleware: 'role', permission: 'reports' })
useHead({ title: 'Отчёты — Tourflow' })

interface Report {
  label: string
  kpis: { leads: number, sales: number, conversion: number, income: number, avgCheck: number, commission: number, receivable: number, refunds: number, lost: number }
  sources: { source: string, leads: number, won: number, revenue: number, conversion: number }[]
  managers: { manager: string, leads: number, active: number, won: number, revenue: number, income: number, conversion: number, overdue: number }[]
  funnel: { pipeline: Pipeline, total: number, stages: { name: string, reached: number }[], won: number }[]
  departures: { name: string, dates: string, seats: number, sold: number, ready: number, fill: number, gross: number }[]
  receivables: { number: number, client: string, price: number, paid: number, debt: number, deadline: string | null, manager: string }[]
  payables: { number: number, client: string, operator: string, bookingNo: string | null, net: number, debt: number, deadline: string }[]
  reasons: { reason: string, count: number, sum: number }[]
}
const { me } = useMe()
const period = ref<'month' | 'quarter' | 'year' | 'all'>('all')
const pipeline = ref<'all' | Pipeline>('all')
const manager = ref('all')
const query = computed(() => ({ period: period.value, pipeline: pipeline.value === 'all' ? undefined : pipeline.value, manager: manager.value === 'all' ? undefined : manager.value }))
const { data: r, status } = await useFetch<Report>('/api/reports', { query })
const tab = ref('summary')
function printPage() {
  window.print()
}
const TABS = [{ value: 'summary', label: 'Сводка' }, { value: 'funnel', label: 'Воронка и конверсия' }, { value: 'sources', label: 'Источники' }, { value: 'managers', label: 'Менеджеры' }, { value: 'departures', label: 'Выезды' }, { value: 'debts', label: 'Долги' }, { value: 'lost', label: 'Отказы' }]
const exportUrl = (t: string) => `/api/reports/export?${new URLSearchParams({ tab: t, ...Object.fromEntries(Object.entries(query.value).filter(([, v]) => v)) as Record<string, string> })}`
const kpiCards = computed(() => r.value
  ? [
      { l: 'Обращения', v: String(r.value.kpis.leads), i: 'i-lucide-message-circle' },
      { l: 'Продажи', v: String(r.value.kpis.sales), i: 'i-lucide-badge-check', tone: 'success' as const },
      { l: 'Конверсия', v: `${r.value.kpis.conversion}%`, i: 'i-lucide-percent' },
      { l: 'Поступления', v: formatMoney(r.value.kpis.income), i: 'i-lucide-arrow-down-left', tone: 'success' as const },
      { l: 'Средний чек', v: formatMoney(r.value.kpis.avgCheck), i: 'i-lucide-receipt' },
      { l: 'Комиссия пакетов', v: formatMoney(r.value.kpis.commission), i: 'i-lucide-briefcase' },
      { l: 'Дебиторка', v: formatMoney(r.value.kpis.receivable), i: 'i-lucide-hourglass', tone: 'warning' as const },
      { l: 'Возвраты', v: formatMoney(r.value.kpis.refunds), i: 'i-lucide-undo-2', tone: 'error' as const },
      { l: 'Отказы', v: String(r.value.kpis.lost), i: 'i-lucide-x-circle' },
    ]
  : [])
</script>

<template>
  <AppPage
    title="Отчёты"
    :subtitle="r ? `Период: ${r.label}` : ''"
  >
    <template #actions>
      <UButton
        color="neutral"
        variant="ghost"
        icon="i-lucide-printer"
        label="Печать / PDF"
        class="hidden md:inline-flex print:hidden"
        @click="printPage"
      />
      <UButton
        icon="i-lucide-download"
        label="Скачать все"
        :to="exportUrl('all')"
        external
        class="print:hidden"
      />
    </template>

    <div class="flex flex-wrap gap-3 print:hidden">
      <div class="flex rounded-lg border border-(--ui-border) p-0.5 bg-(--ui-bg-elevated)">
        <UButton
          v-for="p in [{ v: 'month', l: 'Месяц' }, { v: 'quarter', l: 'Квартал' }, { v: 'year', l: 'Год' }, { v: 'all', l: 'Всё время' }]"
          :key="p.v"
          size="sm"
          :variant="period === p.v ? 'soft' : 'ghost'"
          :color="period === p.v ? 'primary' : 'neutral'"
          :label="p.l"
          @click="period = p.v as typeof period"
        />
      </div>
      <USelect
        v-model="pipeline"
        size="sm"
        :items="[{ value: 'all', label: 'Все воронки' }, { value: 'GROUP', label: 'Групповые' }, { value: 'PACKAGE', label: 'Пакетные' }, { value: 'BASE', label: 'Базовая' }]"
        class="w-40"
      />
      <USelect
        v-model="manager"
        size="sm"
        :items="[{ value: 'all', label: 'Все менеджеры' }, ...(me?.members ?? []).map(m => ({ value: m.id, label: m.name }))]"
        class="w-44"
      />
    </div>

    <div
      v-if="status === 'pending' && !r"
      class="grid gap-3 grid-cols-3 lg:grid-cols-9"
    >
      <div
        v-for="i in 9"
        :key="i"
        class="skeleton h-20"
      />
    </div>
    <template v-else-if="r">
      <div class="grid gap-3 grid-cols-2 md:grid-cols-3 2xl:grid-cols-9">
        <div
          v-for="k in kpiCards"
          :key="k.l"
          class="card px-4 py-3"
        >
          <p class="text-xs text-(--ui-text-muted) flex items-center gap-1">
            <UIcon :name="k.i" /> {{ k.l }}
          </p>
          <p
            class="text-lg font-semibold tabular mt-0.5"
            :class="{ 'text-ok-text': k.tone === 'success', 'text-warn-text': k.tone === 'warning', 'text-bad-text': k.tone === 'error' }"
          >
            {{ k.v }}
          </p>
        </div>
      </div>

      <div class="card">
        <div class="flex items-center justify-between px-4 pt-2 print:hidden">
          <UTabs
            v-model="tab"
            :items="TABS"
            variant="link"
            :content="false"
            class="overflow-x-auto"
          />
          <UButton
            size="xs"
            variant="ghost"
            icon="i-lucide-file-spreadsheet"
            label="XLSX"
            :to="exportUrl(tab)"
            external
          />
        </div>
        <div class="p-5 space-y-6">
          <template v-if="tab === 'summary'">
            <div class="grid gap-6 lg:grid-cols-2">
              <div>
                <p class="text-sm font-medium mb-2">
                  Обращения и продажи по источникам
                </p>
                <ClientOnly>
                  <ReportBarChart
                    :labels="r.sources.map(s => s.source)"
                    :datasets="[{ label: 'Обращения', data: r.sources.map(s => s.leads) }, { label: 'Продажи', data: r.sources.map(s => s.won) }]"
                  />
                </ClientOnly>
              </div>
              <div>
                <p class="text-sm font-medium mb-2">
                  Выручка по менеджерам
                </p>
                <ClientOnly>
                  <ReportBarChart
                    :labels="r.managers.map(m => m.manager)"
                    :datasets="[{ label: 'Выручка', data: r.managers.map(m => m.revenue) }]"
                    horizontal
                    money
                  />
                </ClientOnly>
              </div>
            </div>
            <div
              v-for="f in r.funnel.filter(x => x.total)"
              :key="f.pipeline"
            >
              <p class="text-sm font-medium mb-2">
                Воронка «{{ PIPELINE_LABELS[f.pipeline] }}» · {{ f.total }} заявок
              </p>
              <div class="space-y-1">
                <div
                  v-for="s in f.stages"
                  :key="s.name"
                  class="flex items-center gap-3 text-sm"
                >
                  <span class="w-48 truncate">{{ s.name }}</span>
                  <div class="flex-1 h-5 rounded bg-(--ui-bg-accented) overflow-hidden">
                    <div
                      class="h-full bg-(--ui-primary)/80 transition-[width] duration-500"
                      :style="{ width: `${(s.reached / f.total) * 100}%` }"
                    />
                  </div>
                  <span class="w-16 text-right tabular">{{ s.reached }}</span>
                </div>
              </div>
            </div>
          </template>

          <template v-else-if="tab === 'funnel'">
            <div
              v-for="f in r.funnel"
              :key="f.pipeline"
            >
              <p class="text-sm font-medium mb-2">
                {{ PIPELINE_LABELS[f.pipeline] }} · вход {{ f.total }} · успешно {{ f.won }} ({{ f.total ? Math.round((f.won / f.total) * 100) : 0 }}%)
              </p>
              <table class="w-full text-sm">
                <tbody>
                  <tr
                    v-for="(s, i) in f.stages"
                    :key="s.name"
                    class="border-t border-(--ui-border-muted)"
                  >
                    <td class="py-1.5 w-64">
                      {{ i + 1 }}. {{ s.name }}
                    </td>
                    <td class="py-1.5 tabular text-right w-20">
                      {{ s.reached }}
                    </td>
                    <td class="py-1.5 tabular text-right w-28 text-(--ui-text-muted)">
                      {{ f.total ? Math.round((s.reached / f.total) * 100) : 0 }}% от входа
                    </td>
                    <td class="py-1.5 tabular text-right w-36 text-(--ui-text-muted)">
                      {{ i && f.stages[i - 1]!.reached ? `${Math.round((s.reached / f.stages[i - 1]!.reached) * 100)}% с прошлого` : '' }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>

          <table
            v-else-if="tab === 'sources'"
            class="w-full text-sm"
          >
            <thead class="text-left text-xs text-(--ui-text-muted)">
              <tr>
                <th class="py-2 font-medium">
                  Источник
                </th><th class="py-2 font-medium text-right">
                  Обращения
                </th><th class="py-2 font-medium text-right">
                  Продажи
                </th><th class="py-2 font-medium text-right">
                  Конверсия
                </th><th class="py-2 font-medium text-right">
                  Выручка
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="s in r.sources"
                :key="s.source"
                class="border-t border-(--ui-border-muted)"
              >
                <td class="py-2">
                  {{ s.source }}
                </td><td class="py-2 text-right tabular">
                  {{ s.leads }}
                </td><td class="py-2 text-right tabular">
                  {{ s.won }}
                </td><td class="py-2 text-right tabular">
                  {{ s.conversion }}%
                </td><td class="py-2 text-right tabular">
                  {{ formatMoney(s.revenue) }}
                </td>
              </tr>
            </tbody>
          </table>

          <table
            v-else-if="tab === 'managers'"
            class="w-full text-sm"
          >
            <thead class="text-left text-xs text-(--ui-text-muted)">
              <tr>
                <th class="py-2 font-medium">
                  Менеджер
                </th><th class="py-2 font-medium text-right">
                  Обращения
                </th><th class="py-2 font-medium text-right">
                  В работе
                </th><th class="py-2 font-medium text-right">
                  Продажи
                </th><th class="py-2 font-medium text-right">
                  Конверсия
                </th><th class="py-2 font-medium text-right">
                  Выручка
                </th><th class="py-2 font-medium text-right">
                  Поступления
                </th><th class="py-2 font-medium text-right">
                  Просрочено задач
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="m in r.managers"
                :key="m.manager"
                class="border-t border-(--ui-border-muted)"
              >
                <td class="py-2">
                  {{ m.manager }}
                </td><td class="py-2 text-right tabular">
                  {{ m.leads }}
                </td><td class="py-2 text-right tabular">
                  {{ m.active }}
                </td><td class="py-2 text-right tabular">
                  {{ m.won }}
                </td><td class="py-2 text-right tabular">
                  {{ m.conversion }}%
                </td><td class="py-2 text-right tabular">
                  {{ formatMoney(m.revenue) }}
                </td><td class="py-2 text-right tabular">
                  {{ formatMoney(m.income) }}
                </td>
                <td
                  class="py-2 text-right tabular"
                  :class="m.overdue ? 'text-bad-text' : ''"
                >
                  {{ m.overdue }}
                </td>
              </tr>
            </tbody>
          </table>

          <template v-else-if="tab === 'departures'">
            <ClientOnly>
              <ReportBarChart
                :labels="r.departures.map(d => d.name)"
                :datasets="[{ label: 'Продано мест', data: r.departures.map(d => d.sold) }, { label: 'Готовы', data: r.departures.map(d => d.ready), color: '#12B76A' }]"
              />
            </ClientOnly>
            <table class="w-full text-sm">
              <tbody>
                <tr
                  v-for="d in r.departures"
                  :key="d.name + d.dates"
                  class="border-t border-(--ui-border-muted)"
                >
                  <td class="py-2">
                    {{ d.name }}<span class="text-(--ui-text-muted)"> · {{ d.dates }}</span>
                  </td>
                  <td class="py-2 text-right tabular">
                    {{ d.sold }} / {{ d.seats }}
                  </td>
                  <td class="py-2 w-40">
                    <UProgress
                      :model-value="d.fill"
                      size="xs"
                    />
                  </td>
                  <td class="py-2 text-right tabular">
                    {{ formatMoney(d.gross) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </template>

          <div
            v-else-if="tab === 'debts'"
            class="grid gap-6 lg:grid-cols-2"
          >
            <div>
              <p class="text-sm font-medium mb-2">
                Дебиторка (клиенты) · {{ formatMoney(r.receivables.reduce((s, x) => s + x.debt, 0)) }}
              </p>
              <table class="w-full text-sm">
                <tbody>
                  <tr
                    v-for="x in r.receivables"
                    :key="x.number"
                    class="border-t border-(--ui-border-muted)"
                  >
                    <td class="py-1.5">
                      №{{ x.number }} · {{ x.client }}<p class="text-xs text-(--ui-text-muted)">
                        {{ x.manager }}{{ x.deadline ? ` · до ${formatDate(x.deadline, { dateOnly: true })}` : '' }}
                      </p>
                    </td>
                    <td class="py-1.5 text-right tabular text-bad-text">
                      {{ formatMoney(x.debt) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div>
              <p class="text-sm font-medium mb-2">
                Кредиторка (туроператоры) · {{ formatMoney(r.payables.reduce((s, x) => s + x.debt, 0)) }}
              </p>
              <table class="w-full text-sm">
                <tbody>
                  <tr
                    v-for="x in r.payables"
                    :key="x.number + x.operator"
                    class="border-t border-(--ui-border-muted)"
                  >
                    <td class="py-1.5">
                      {{ x.operator }} {{ x.bookingNo ?? '' }}<p class="text-xs text-(--ui-text-muted)">
                        №{{ x.number }} · {{ x.client }} · до {{ formatDate(x.deadline, { dateOnly: true }) }}
                      </p>
                    </td>
                    <td class="py-1.5 text-right tabular text-warn-text">
                      {{ formatMoney(x.debt) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <template v-else-if="tab === 'lost'">
            <ClientOnly>
              <ReportBarChart
                :labels="r.reasons.map(x => x.reason)"
                :datasets="[{ label: 'Заявок', data: r.reasons.map(x => x.count), color: '#F04438' }]"
                horizontal
                :height="200"
              />
            </ClientOnly>
            <EmptyState
              v-if="!r.reasons.length"
              text="Отказов за период нет"
              compact
            />
          </template>
        </div>
      </div>
    </template>
  </AppPage>
</template>

<style>
@media print {
  aside, nav, header button, .print\:hidden { display: none !important; }
  .card { break-inside: avoid; }
}
</style>
