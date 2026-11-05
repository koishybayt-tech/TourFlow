<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import { calcTour, canPublish, pricesComplete, toKzt, tourScenarios, type CalcTour } from '#shared/domain/tourCalc'
import type { TourSave } from '#shared/schemas/tours'

definePageMeta({ middleware: 'role', permission: 'tours' })

type Tour = TourSave & { id: string, slug: string, status: 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'ARCHIVE', canFinance: boolean, publicUrl: string, departure: { id: string, sold: number, minSeats: number } | null }
const route = useRoute()
const id = String(route.params.id)
const { data, refresh, error } = await useFetch<Tour>(`/api/tours/${id}`)
useHead(() => ({ title: `${data.value?.name ?? 'Тур'} — Tourflow` }))

const t = ref<Tour | null>(data.value ? structuredClone(toRaw(data.value)) : null)
watch(data, v => v && (t.value = structuredClone(toRaw(v))))

// ── Autosave (debounced) ──
const saveState = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
let timer: ReturnType<typeof setTimeout> | null = null
let ready = false
watch(t, () => {
  if (!ready) {
    ready = true
    return
  }
  saveState.value = 'saving'
  if (timer) clearTimeout(timer)
  timer = setTimeout(save, 800)
}, { deep: true })
async function save() {
  if (!t.value) return
  const { id: _id, slug: _s, status: _st, canFinance: _c, publicUrl: _p, departure: _d, ...body } = t.value
  try {
    await api(`/api/tours/${id}`, { method: 'PUT', body })
    saveState.value = 'saved'
  }
  catch (e) {
    saveState.value = 'error'
    useNotify().fail(e)
  }
}
onBeforeRouteLeave(async () => {
  if (timer && saveState.value === 'saving') {
    clearTimeout(timer)
    await save()
  }
})

const tabs = computed(() => [
  { value: 'main', label: 'Основное', icon: 'i-lucide-info' },
  { value: 'days', label: `Программа · ${t.value?.days.length ?? 0}`, icon: 'i-lucide-route' },
  { value: 'flights', label: 'Перелёты', icon: 'i-lucide-plane' },
  { value: 'stays', label: 'Проживание', icon: 'i-lucide-bed' },
  ...(t.value?.canFinance ? [{ value: 'finance', label: 'Финансы', icon: 'i-lucide-calculator' }] : []),
  { value: 'included', label: 'Включено', icon: 'i-lucide-list-checks' },
  { value: 'publish', label: 'Публикация', icon: 'i-lucide-megaphone' },
])
const tab = computed({ get: () => String(route.query.tab || 'main'), set: v => navigateTo({ query: { tab: v } }, { replace: true }) })

// ── Derived ──
const nights = computed(() => (t.value?.startDate && t.value.endDate ? Math.round((+new Date(t.value.endDate) - +new Date(t.value.startDate)) / 86_400_000) : null))
const mode = ref<'plan' | 'fact'>('plan')
const calcIn = computed<CalcTour | null>(() => t.value
  ? { seats: t.value.seats, price: t.value.price, rates: t.value.rates, flights: t.value.flights.map(f => ({ ticket: f.ticket ?? null, baggage: f.baggage ?? null, currency: f.currency })), stays: t.value.stays.map(s => ({ total: s.total ?? null, currency: s.currency })), costs: t.value.costs.map(c => ({ plan: c.plan ?? null, fact: c.fact ?? null, unit: c.unit, per: c.per })) }
  : null)
const calc = computed(() => (calcIn.value ? calcTour(calcIn.value, undefined, mode.value) : null))
const scenarios = computed(() => (calcIn.value ? tourScenarios(calcIn.value, mode.value) : []))
const pricesStale = computed(() => !t.value?.pricesCheckedAt || Date.now() - +new Date(t.value.pricesCheckedAt) > 14 * 86_400_000)
const publishCheck = computed(() => (t.value ? canPublish({ ...t.value, startDate: t.value.startDate ?? null, endDate: t.value.endDate ?? null }) : { ok: false, missing: [] }))
interface Kpi { l: string, v: string, s?: string, tone?: string }
const kpis = computed<Kpi[]>(() => {
  const c = calc.value
  if (!c || !t.value) return []
  return [
    { l: 'Себестоимость на туриста', v: formatMoney(c.costPer) },
    { l: 'Себестоимость группы', v: formatMoney(c.cost), s: `при ${c.n} туристах` },
    { l: 'Цена продажи', v: t.value.price ? formatMoney(t.value.price) : '—', s: !t.value.price && c.suggestPrice ? `рекомендуем ${formatMoney(c.suggestPrice)}` : '' },
    { l: 'Выручка', v: formatMoney(c.revenue) },
    { l: 'Прибыль на туриста', v: formatMoney(c.profitPer), tone: c.profitPer < 0 ? 'text-bad-text' : 'text-ok-text' },
    { l: 'Прибыль группы', v: formatMoney(c.profit), tone: c.profit < 0 ? 'text-bad-text' : 'text-ok-text' },
    { l: 'Рентабельность', v: `${c.margin}%` },
    { l: 'Безубыточность', v: c.breakEven ? `от ${c.breakEven} чел.` : '—', s: `из ${t.value.seats} мест` },
  ]
})
const kzt = (a: number | null | undefined, c: 'KZT' | 'EUR' | 'USD' | 'CHF') => Math.round(toKzt(a, c, t.value!.rates))

// ── Lists ──
const COUNTRIES = computed({ get: () => t.value?.countries.join(', ') ?? '', set: v => t.value && (t.value.countries = v.split(',').map(s => s.trim()).filter(Boolean)) })
function addDay() {
  t.value!.days.push({ city: '', items: [], description: '', transfer: '', mediaKeys: [], availabilityChecked: false })
}
const itemInput = reactive<Record<number, string>>({})
function addItem(i: number) {
  const v = (itemInput[i] ?? '').trim()
  if (!v) return
  t.value!.days[i]!.items.push(v)
  itemInput[i] = ''
}
function addFlight() {
  const last = t.value!.flights.at(-1)
  t.value!.flights.push({ from: last?.to ?? 'Алматы', to: '', departAt: null, airline: '', ticket: null, baggage: null, currency: 'EUR', link: '' })
}
function addStay() {
  t.value!.stays.push({ city: '', name: '', checkIn: t.value!.startDate ?? null, checkOut: t.value!.endDate ?? null, rooms: Math.ceil(t.value!.seats / 2), guests: t.value!.seats, total: null, currency: 'EUR', link: '', note: '' })
}
const QUICK_COSTS = ['Услуги гида', 'Трансферы', 'Входные билеты', 'Страховка', 'Фото- и видеосъёмка', 'Организационные расходы', 'Непредвиденные расходы']
function addCost(category = '') {
  t.value!.costs.push({ category, plan: category === 'Непредвиденные расходы' ? 5 : null, fact: null, unit: category === 'Непредвиденные расходы' ? 'PERCENT' : 'KZT', per: category === 'Страховка' || category === 'Входные билеты' ? 'tourist' : 'group' })
}
const stayNights = (s: { checkIn?: string | null, checkOut?: string | null }) => (s.checkIn && s.checkOut ? Math.max(0, Math.round((+new Date(s.checkOut) - +new Date(s.checkIn)) / 86_400_000)) : 0)
const listInput = reactive({ included: '', extra: '' })
function addListItem(key: 'included' | 'extra') {
  const v = listInput[key].trim()
  if (!v || !t.value) return
  t.value[key].push(v)
  listInput[key] = ''
}

// ── Media ──
async function upload(target: 'cover' | number, e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const fd = new FormData()
  fd.append('file', file)
  const r = await mutate(() => $fetch<{ key: string }>(`/api/tours/${id}/media`, { method: 'POST', body: fd }), 'Файл загружен')
  if (!r) return
  if (target === 'cover') t.value!.coverKey = r.key
  else t.value!.days[target]!.mediaKeys.push(r.key)
}

// ── Status actions ──
async function publish() {
  await save()
  const r = await mutate(() => api<{ departureId: string }>(`/api/tours/${id}/publish`, { method: 'POST' }), 'Тур опубликован, выезд создан')
  if (r) refresh()
}
async function setStatus(status: string, msg: string) {
  if (await mutate(() => api(`/api/tours/${id}/status`, { method: 'POST', body: { status } }), msg)) refresh()
}
const confirmDel = ref(false)
async function remove() {
  if (await mutate(() => api(`/api/tours/${id}`, { method: 'DELETE' }), 'Тур удалён')) navigateTo('/tours')
}
async function genInstagram() {
  const r = await mutate(() => api<{ text: string }>(`/api/tours/${id}/instagram`))
  if (r) t.value!.instagramText = r.text
}
function copy(text: string) {
  navigator.clipboard.writeText(text)
  useNotify().ok('Скопировано')
}
const STATUS: Record<string, string> = { DRAFT: 'Черновик', PUBLISHED: 'Опубликован', CLOSED: 'Набор закрыт', ARCHIVE: 'Архив' }
const CURS = [{ value: 'EUR', label: 'EUR' }, { value: 'USD', label: 'USD' }, { value: 'CHF', label: 'CHF' }, { value: 'KZT', label: '₸' }]
</script>

<template>
  <AppPage
    v-if="t"
    :title="t.name || 'Новый тур'"
    :subtitle="`${STATUS[t.status]}${t.departure ? ` · продано ${t.departure.sold} из ${t.seats}` : ''}`"
    back="/tours"
  >
    <template #actions>
      <template v-if="t">
        <span
          class="text-xs flex items-center gap-1 mr-2"
          :class="saveState === 'error' ? 'text-bad-text' : 'text-(--ui-text-muted)'"
        >
          <UIcon
            :name="saveState === 'saving' ? 'i-lucide-loader-circle' : saveState === 'error' ? 'i-lucide-alert-circle' : 'i-lucide-cloud-check'"
            :class="saveState === 'saving' && 'animate-spin'"
          />
          {{ saveState === 'saving' ? 'Сохраняем…' : saveState === 'error' ? 'Не сохранено' : saveState === 'saved' ? 'Сохранено' : 'Черновик сохраняется автоматически' }}
        </span>
        <UButton
          v-if="t.status === 'DRAFT'"
          icon="i-lucide-rocket"
          label="Опубликовать"
          :disabled="!publishCheck.ok"
          @click="publish"
        />
        <UButton
          v-else-if="t.status === 'PUBLISHED'"
          color="neutral"
          variant="outline"
          label="Закрыть набор"
          @click="setStatus('CLOSED', 'Набор закрыт')"
        />
        <UButton
          v-else-if="t.status === 'CLOSED'"
          color="neutral"
          variant="outline"
          label="Открыть набор"
          @click="setStatus('PUBLISHED', 'Набор открыт')"
        />
      </template>
    </template>

    <template v-if="t">
      <UAlert
        v-if="t.status === 'DRAFT' && !publishCheck.ok"
        color="neutral"
        variant="subtle"
        icon="i-lucide-list-todo"
        :title="`Для публикации осталось: ${publishCheck.missing.join(', ')}`"
      />

      <div class="grid gap-6 xl:grid-cols-[1fr_300px] items-start">
        <div class="card min-w-0">
          <UTabs
            v-model="tab"
            :items="tabs"
            variant="link"
            :content="false"
            class="px-4 pt-2 overflow-x-auto"
          />
          <div class="p-5">
            <!-- Main -->
            <div
              v-if="tab === 'main'"
              class="space-y-4"
            >
              <div class="grid gap-3 md:grid-cols-[2fr_120px_1fr]">
                <UFormField label="Название тура">
                  <UInput
                    v-model="t.name"
                    class="w-full"
                  />
                </UFormField>
                <UFormField label="Флаги">
                  <UInput
                    :model-value="t.flags ?? ''"
                    placeholder="🇮🇹🇫🇷"
                    class="w-full"
                    @update:model-value="t.flags = String($event) || null"
                  />
                </UFormField>
                <UFormField label="Страны">
                  <UInput
                    v-model="COUNTRIES"
                    placeholder="Италия, Франция"
                    class="w-full"
                  />
                </UFormField>
              </div>
              <UFormField label="Маршрут">
                <UInput
                  v-model="t.route"
                  placeholder="Милан → Париж → Рим"
                  class="w-full"
                />
              </UFormField>
              <div class="grid gap-3 sm:grid-cols-4 items-end">
                <UFormField label="Дата начала">
                  <UInput
                    :model-value="t.startDate ?? ''"
                    type="date"
                    class="w-full"
                    @update:model-value="t.startDate = String($event) || null"
                  />
                </UFormField>
                <UFormField label="Дата окончания">
                  <UInput
                    :model-value="t.endDate ?? ''"
                    type="date"
                    class="w-full"
                    @update:model-value="t.endDate = String($event) || null"
                  />
                </UFormField>
                <div class="text-sm pb-2">
                  <span class="text-(--ui-text-muted)">Продолжительность</span><br><b>{{ nights !== null ? `${nights + 1} ${plural(nights + 1, 'день', 'дня', 'дней')} / ${nights} ${plural(nights, 'ночь', 'ночи', 'ночей')}` : '—' }}</b>
                </div>
                <UFormField label="Мест в группе">
                  <UInputNumber
                    v-model="t.seats"
                    :min="1"
                    class="w-full"
                  />
                </UFormField>
              </div>
              <div class="grid gap-3 sm:grid-cols-4">
                <UFormField label="Цена за туриста, ₸">
                  <UInputNumber
                    v-model="t.price"
                    :min="0"
                    :step="10000"
                    class="w-full"
                  />
                </UFormField>
                <UFormField label="Предоплата, ₸">
                  <UInputNumber
                    v-model="t.prepay"
                    :min="0"
                    :step="10000"
                    class="w-full"
                  />
                </UFormField>
                <UFormField label="Повышение цены после">
                  <UInput
                    :model-value="t.riseDate ?? ''"
                    type="date"
                    class="w-full"
                    @update:model-value="t.riseDate = String($event) || null"
                  />
                </UFormField>
                <UFormField label="на, ₸">
                  <UInputNumber
                    :model-value="t.riseAmount ?? undefined"
                    :min="0"
                    :step="10000"
                    class="w-full"
                    @update:model-value="t.riseAmount = $event ?? null"
                  />
                </UFormField>
              </div>
              <div
                v-if="!t.price && t.canFinance"
                class="rounded-lg bg-indigo-50 dark:bg-indigo-500/10 px-3 py-2 text-sm flex flex-wrap items-center gap-2"
              >
                <template v-if="calc?.suggestPrice">
                  Рекомендуемая цена <b>{{ formatMoney(calc.suggestPrice) }}</b> — себестоимость + 25%
                  <UButton
                    size="xs"
                    label="Установить"
                    @click="t.price = calc.suggestPrice!"
                  />
                </template>
                <template v-else>
                  Заполните цены перелётов и проживания — система предложит цену продажи
                </template>
              </div>
              <UFormField label="Условие оплаты остатка">
                <UInput
                  :model-value="t.payRule ?? ''"
                  placeholder="Остаток после получения визы"
                  class="w-full"
                  @update:model-value="t.payRule = String($event) || null"
                />
              </UFormField>
              <UFormField label="Описание путешествия">
                <UTextarea
                  v-model="t.description"
                  :rows="4"
                  autoresize
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Обложка">
                <div class="flex items-center gap-3">
                  <img
                    v-if="t.coverKey"
                    :src="`/api/public/media/${t.coverKey}`"
                    alt="Обложка"
                    class="h-20 w-32 object-cover rounded-lg"
                  >
                  <label class="cursor-pointer text-sm text-(--ui-primary)">
                    <input
                      type="file"
                      accept="image/*"
                      class="hidden"
                      @change="upload('cover', $event)"
                    >{{ t.coverKey ? 'Заменить фото' : 'Загрузить фото' }}
                  </label>
                </div>
              </UFormField>
              <div class="flex justify-end gap-2 pt-3 border-t border-(--ui-border-muted)">
                <UButton
                  v-if="t.status !== 'ARCHIVE'"
                  size="sm"
                  color="neutral"
                  variant="ghost"
                  label="В архив"
                  @click="setStatus('ARCHIVE', 'Тур в архиве')"
                />
                <template v-if="!confirmDel">
                  <UButton
                    size="sm"
                    color="error"
                    variant="ghost"
                    label="Удалить"
                    @click="confirmDel = true"
                  />
                </template>
                <template v-else>
                  <span class="text-sm text-bad-text self-center">Удалить тур безвозвратно?</span>
                  <UButton
                    size="sm"
                    color="neutral"
                    variant="ghost"
                    label="Нет"
                    @click="confirmDel = false"
                  />
                  <UButton
                    size="sm"
                    color="error"
                    label="Удалить"
                    @click="remove"
                  />
                </template>
              </div>
            </div>

            <!-- Days -->
            <div
              v-else-if="tab === 'days'"
              class="space-y-3"
            >
              <div class="flex justify-between items-center">
                <p class="text-sm text-(--ui-text-muted)">
                  Перед публикацией отметьте, что активности доступны в эти даты. Порядок дней — перетаскиванием.
                </p>
                <UButton
                  size="sm"
                  icon="i-lucide-plus"
                  label="День"
                  @click="addDay"
                />
              </div>
              <VueDraggable
                v-model="t.days"
                handle=".drag"
                :animation="180"
                class="space-y-3"
              >
                <div
                  v-for="(d, i) in t.days"
                  :key="i"
                  class="rounded-lg border border-(--ui-border) p-4 space-y-3"
                >
                  <div class="flex items-center gap-3">
                    <UIcon
                      name="i-lucide-grip-vertical"
                      class="drag cursor-grab text-(--ui-text-dimmed)"
                      aria-label="Перетащить день"
                    />
                    <span class="font-semibold text-sm">День {{ i + 1 }}<span
                      v-if="t.startDate"
                      class="text-(--ui-text-muted) font-normal"
                    > · {{ formatDayMonth(new Date(+new Date(t.startDate) + i * 86400000), { dateOnly: true }) }}</span></span>
                    <UInput
                      v-model="d.city"
                      size="sm"
                      placeholder="Город"
                      class="w-48"
                    />
                    <UCheckbox
                      v-model="d.availabilityChecked"
                      label="Доступность проверена"
                      class="ml-auto"
                    />
                    <UButton
                      size="xs"
                      variant="ghost"
                      color="error"
                      icon="i-lucide-trash-2"
                      aria-label="Удалить день"
                      @click="t.days.splice(i, 1)"
                    />
                  </div>
                  <div class="flex flex-wrap gap-1.5">
                    <UBadge
                      v-for="(it, j) in d.items"
                      :key="j"
                      variant="soft"
                      color="neutral"
                      class="gap-1"
                    >
                      {{ it }}<button
                        :aria-label="`Убрать ${it}`"
                        @click="d.items.splice(j, 1)"
                      >
                        <UIcon
                          name="i-lucide-x"
                          class="size-3"
                        />
                      </button>
                    </UBadge>
                    <input
                      v-model="itemInput[i]"
                      class="text-sm bg-transparent border-b border-dashed border-(--ui-border) focus:outline-none focus:border-(--ui-primary) w-56"
                      placeholder="+ достопримечательность, Enter"
                      @keydown.enter.prevent="addItem(i)"
                    >
                  </div>
                  <UTextarea
                    v-model="d.description"
                    :rows="2"
                    autoresize
                    placeholder="Описание дня"
                    class="w-full"
                  />
                  <div class="flex items-center gap-3">
                    <UInput
                      :model-value="d.transfer ?? ''"
                      size="sm"
                      icon="i-lucide-bus"
                      placeholder="Переезды"
                      class="flex-1"
                      @update:model-value="d.transfer = String($event) || null"
                    />
                    <div class="flex gap-1">
                      <img
                        v-for="k in d.mediaKeys.filter(x => !/\.(mp4|mov|webm)$/i.test(x))"
                        :key="k"
                        :src="`/api/public/media/${k}`"
                        alt=""
                        class="size-9 rounded object-cover"
                      >
                    </div>
                    <label class="text-xs text-(--ui-primary) cursor-pointer">
                      <input
                        type="file"
                        accept="image/*,video/*"
                        class="hidden"
                        @change="upload(i, $event)"
                      >+ Фото/видео
                    </label>
                  </div>
                </div>
              </VueDraggable>
              <EmptyState
                v-if="!t.days.length"
                icon="i-lucide-route"
                text="Добавьте дни программы."
                action="Добавить день"
                @action="addDay"
              />
            </div>

            <!-- Flights -->
            <div
              v-else-if="tab === 'flights'"
              class="space-y-3 overflow-x-auto"
            >
              <table class="w-full text-sm min-w-[900px]">
                <thead class="text-left text-xs text-(--ui-text-muted)">
                  <tr>
                    <th class="py-1 font-medium">
                      Откуда
                    </th><th class="py-1 font-medium">
                      Куда
                    </th><th class="py-1 font-medium">
                      Дата и время
                    </th><th class="py-1 font-medium">
                      Авиакомпания
                    </th><th
                      v-if="t.canFinance"
                      class="py-1 font-medium"
                    >
                      Билет
                    </th><th
                      v-if="t.canFinance"
                      class="py-1 font-medium"
                    >
                      Багаж
                    </th><th class="py-1 font-medium">
                      Валюта
                    </th><th
                      v-if="t.canFinance"
                      class="py-1 font-medium text-right"
                    >
                      ₸ на туриста
                    </th><th />
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(f, i) in t.flights"
                    :key="i"
                    class="border-t border-(--ui-border-muted)"
                  >
                    <td class="py-1.5 pr-1">
                      <UInput
                        v-model="f.from"
                        size="sm"
                      />
                    </td>
                    <td class="py-1.5 pr-1">
                      <UInput
                        v-model="f.to"
                        size="sm"
                      />
                    </td>
                    <td class="py-1.5 pr-1">
                      <UInput
                        :model-value="f.departAt ?? ''"
                        type="datetime-local"
                        size="sm"
                        @update:model-value="f.departAt = String($event) || null"
                      />
                    </td>
                    <td class="py-1.5 pr-1">
                      <UInput
                        :model-value="f.airline ?? ''"
                        size="sm"
                        @update:model-value="f.airline = String($event) || null"
                      />
                    </td>
                    <td
                      v-if="t.canFinance"
                      class="py-1.5 pr-1 w-24"
                    >
                      <UInputNumber
                        :model-value="f.ticket ?? undefined"
                        size="sm"
                        :min="0"
                        @update:model-value="f.ticket = $event ?? null"
                      />
                    </td>
                    <td
                      v-if="t.canFinance"
                      class="py-1.5 pr-1 w-24"
                    >
                      <UInputNumber
                        :model-value="f.baggage ?? undefined"
                        size="sm"
                        :min="0"
                        @update:model-value="f.baggage = $event ?? null"
                      />
                    </td>
                    <td class="py-1.5 pr-1 w-20">
                      <USelect
                        v-model="f.currency"
                        :items="CURS"
                        size="sm"
                      />
                    </td>
                    <td
                      v-if="t.canFinance"
                      class="py-1.5 text-right tabular"
                    >
                      {{ formatMoney(kzt(f.ticket, f.currency) + kzt(f.baggage, f.currency)) }}
                    </td>
                    <td class="py-1.5 pl-1">
                      <UButton
                        size="xs"
                        variant="ghost"
                        color="error"
                        icon="i-lucide-x"
                        aria-label="Удалить перелёт"
                        @click="t.flights.splice(i, 1)"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
              <div class="flex justify-between items-center">
                <UButton
                  size="sm"
                  variant="soft"
                  icon="i-lucide-plus"
                  label="Перелёт"
                  @click="addFlight"
                />
                <p
                  v-if="t.canFinance && calc"
                  class="text-sm"
                >
                  Итого: <b>{{ formatMoney(calc.flights) }}</b> на туриста · <b>{{ formatMoney(calc.flights * t.seats) }}</b> на группу
                </p>
              </div>
            </div>

            <!-- Stays -->
            <div
              v-else-if="tab === 'stays'"
              class="space-y-3"
            >
              <div
                v-for="(s, i) in t.stays"
                :key="i"
                class="rounded-lg border border-(--ui-border) p-3 grid gap-2 md:grid-cols-6 items-end"
              >
                <UFormField
                  label="Город"
                  size="sm"
                >
                  <UInput
                    v-model="s.city"
                    size="sm"
                  />
                </UFormField>
                <UFormField
                  label="Отель / апартаменты"
                  size="sm"
                  class="md:col-span-2"
                >
                  <UInput
                    v-model="s.name"
                    size="sm"
                  />
                </UFormField>
                <UFormField
                  label="Заезд"
                  size="sm"
                >
                  <UInput
                    :model-value="s.checkIn ?? ''"
                    type="date"
                    size="sm"
                    @update:model-value="s.checkIn = String($event) || null"
                  />
                </UFormField>
                <UFormField
                  :label="`Выезд · ${stayNights(s)} н.`"
                  size="sm"
                >
                  <UInput
                    :model-value="s.checkOut ?? ''"
                    type="date"
                    size="sm"
                    @update:model-value="s.checkOut = String($event) || null"
                  />
                </UFormField>
                <div class="flex gap-2">
                  <UFormField
                    label="Номеров"
                    size="sm"
                  >
                    <UInputNumber
                      v-model="s.rooms"
                      size="sm"
                      :min="0"
                    />
                  </UFormField>
                </div>
                <template v-if="t.canFinance">
                  <UFormField
                    label="Стоимость за срок"
                    size="sm"
                  >
                    <UInputNumber
                      :model-value="s.total ?? undefined"
                      size="sm"
                      :min="0"
                      @update:model-value="s.total = $event ?? null"
                    />
                  </UFormField>
                  <UFormField
                    label="Валюта"
                    size="sm"
                  >
                    <USelect
                      v-model="s.currency"
                      :items="CURS"
                      size="sm"
                    />
                  </UFormField>
                </template>
                <UFormField
                  label="Сезон, события"
                  size="sm"
                  class="md:col-span-3"
                >
                  <UInput
                    :model-value="s.note ?? ''"
                    size="sm"
                    placeholder="Пик сезона — цены растут"
                    @update:model-value="s.note = String($event) || null"
                  />
                </UFormField>
                <div class="flex items-center justify-end gap-2">
                  <span
                    v-if="t.canFinance"
                    class="text-sm tabular"
                  >{{ formatMoney(kzt(s.total, s.currency)) }}</span>
                  <UButton
                    size="xs"
                    variant="ghost"
                    color="error"
                    icon="i-lucide-trash-2"
                    aria-label="Удалить проживание"
                    @click="t.stays.splice(i, 1)"
                  />
                </div>
              </div>
              <div class="flex justify-between items-center">
                <UButton
                  size="sm"
                  variant="soft"
                  icon="i-lucide-plus"
                  label="Проживание"
                  @click="addStay"
                />
                <p
                  v-if="t.canFinance && calc"
                  class="text-sm"
                >
                  Итого: <b>{{ formatMoney(calc.stays / Math.max(1, t.seats)) }}</b> на человека · <b>{{ formatMoney(calc.stays) }}</b> на группу
                </p>
              </div>
            </div>

            <!-- Finance -->
            <div
              v-else-if="tab === 'finance' && calc"
              class="space-y-5"
            >
              <div class="flex flex-wrap items-center gap-3">
                <div class="flex rounded-lg border border-(--ui-border) p-0.5">
                  <UButton
                    size="sm"
                    :variant="mode === 'plan' ? 'soft' : 'ghost'"
                    :color="mode === 'plan' ? 'primary' : 'neutral'"
                    label="План"
                    @click="mode = 'plan'"
                  />
                  <UButton
                    size="sm"
                    :variant="mode === 'fact' ? 'soft' : 'ghost'"
                    :color="mode === 'fact' ? 'primary' : 'neutral'"
                    label="Факт"
                    @click="mode = 'fact'"
                  />
                </div>
                <span class="text-xs text-(--ui-text-muted)">Курсы:</span>
                <label
                  v-for="c in (['EUR', 'USD', 'CHF'] as const)"
                  :key="c"
                  class="flex items-center gap-1 text-xs"
                >{{ c }}
                  <UInputNumber
                    v-model="t.rates[c]"
                    size="xs"
                    :min="1"
                    class="w-24"
                    :aria-label="`Курс ${c}`"
                  />
                </label>
                <UButton
                  size="xs"
                  variant="ghost"
                  label="Зафиксировать сегодня"
                  @click="t.ratesFixedAt = isoDay(new Date())"
                />
                <span class="text-xs text-(--ui-text-muted)">{{ t.ratesFixedAt ? `от ${formatDate(t.ratesFixedAt, { dateOnly: true })}` : '' }}</span>
                <UButton
                  class="ml-auto"
                  size="sm"
                  variant="outline"
                  color="neutral"
                  icon="i-lucide-file-spreadsheet"
                  label="Excel"
                  :to="`/api/tours/${id}/export`"
                  external
                />
              </div>
              <UAlert
                v-if="pricesStale"
                color="warning"
                variant="subtle"
                icon="i-lucide-alert-triangle"
                :title="t.pricesCheckedAt ? `Цены проверялись ${formatDate(t.pricesCheckedAt, { dateOnly: true })} — больше 14 дней назад` : 'Цены ещё не проверялись'"
                :actions="[{ label: 'Цены проверены', onClick: () => { t!.pricesCheckedAt = isoDay(new Date()) } }]"
              />
              <div class="grid gap-3 grid-cols-2 lg:grid-cols-4">
                <div
                  v-for="k in kpis"
                  :key="k.l"
                  class="rounded-lg border border-(--ui-border) px-3 py-2"
                >
                  <p class="text-xs text-(--ui-text-muted)">
                    {{ k.l }}
                  </p>
                  <p
                    class="font-semibold tabular"
                    :class="k.tone"
                  >
                    {{ k.v }}
                  </p>
                  <p
                    v-if="k.s"
                    class="text-[11px] text-(--ui-text-muted)"
                  >
                    {{ k.s }}
                  </p>
                </div>
              </div>
              <div>
                <p class="text-sm font-medium mb-2">
                  Сценарии наполнения
                </p>
                <table class="w-full text-sm">
                  <thead class="text-left text-xs text-(--ui-text-muted)">
                    <tr>
                      <th class="py-1 font-medium">
                        Сценарий
                      </th><th class="py-1 font-medium text-right">
                        Туристов
                      </th><th class="py-1 font-medium text-right">
                        Выручка
                      </th><th class="py-1 font-medium text-right">
                        Себестоимость
                      </th><th class="py-1 font-medium text-right">
                        Прибыль
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="s in scenarios"
                      :key="s.label"
                      class="border-t border-(--ui-border-muted)"
                      :class="s.label === 'Безубыточность' && 'bg-(--ui-bg-muted)'"
                    >
                      <td class="py-1.5">
                        {{ s.label }}
                      </td><td class="py-1.5 text-right tabular">
                        {{ s.n }}
                      </td><td class="py-1.5 text-right tabular">
                        {{ formatMoney(s.result.revenue) }}
                      </td><td class="py-1.5 text-right tabular">
                        {{ formatMoney(s.result.cost) }}
                      </td>
                      <td
                        class="py-1.5 text-right tabular font-medium"
                        :class="s.result.profit < 0 ? 'text-bad-text' : 'text-ok-text'"
                      >
                        {{ formatMoney(s.result.profit) }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div>
                <p class="text-sm font-medium mb-2">
                  Прочие расходы
                </p>
                <div
                  v-for="(c, i) in t.costs"
                  :key="i"
                  class="grid gap-2 grid-cols-[1fr_110px_110px_90px_130px_auto] items-center py-1"
                >
                  <UInput
                    v-model="c.category"
                    size="sm"
                    placeholder="Статья"
                  />
                  <UInputNumber
                    :model-value="c.plan ?? undefined"
                    size="sm"
                    placeholder="План"
                    :min="0"
                    @update:model-value="c.plan = $event ?? null"
                  />
                  <UInputNumber
                    :model-value="c.fact ?? undefined"
                    size="sm"
                    placeholder="Факт"
                    :min="0"
                    @update:model-value="c.fact = $event ?? null"
                  />
                  <USelect
                    v-model="c.unit"
                    size="sm"
                    :items="[...CURS, { value: 'PERCENT', label: '%' }]"
                  />
                  <USelect
                    v-model="c.per"
                    size="sm"
                    :items="[{ value: 'tourist', label: 'на туриста' }, { value: 'group', label: 'на группу' }]"
                  />
                  <UButton
                    size="xs"
                    variant="ghost"
                    color="error"
                    icon="i-lucide-x"
                    aria-label="Удалить статью"
                    @click="t.costs.splice(i, 1)"
                  />
                </div>
                <div class="flex flex-wrap gap-1 mt-2">
                  <UButton
                    size="xs"
                    variant="soft"
                    icon="i-lucide-plus"
                    label="Статья"
                    @click="addCost()"
                  />
                  <UButton
                    v-for="q in QUICK_COSTS.filter(x => !t!.costs.some(c => c.category === x))"
                    :key="q"
                    size="xs"
                    variant="ghost"
                    color="neutral"
                    :label="`+ ${q}`"
                    @click="addCost(q)"
                  />
                </div>
              </div>
              <p
                v-if="!pricesComplete(calcIn!)"
                class="text-xs text-warn-text"
              >
                Не все цены перелётов и проживания заполнены — расчёт неполный.
              </p>
            </div>

            <!-- Included -->
            <div
              v-else-if="tab === 'included'"
              class="grid gap-6 md:grid-cols-2"
            >
              <div
                v-for="list in [{ key: 'included' as const, title: 'Включено' }, { key: 'extra' as const, title: 'Дополнительно' }]"
                :key="list.key"
              >
                <p class="text-sm font-medium mb-2">
                  {{ list.title }}
                </p>
                <ul class="space-y-1">
                  <li
                    v-for="(x, i) in t[list.key]"
                    :key="i"
                    class="flex items-center gap-2 text-sm"
                  >
                    <UIcon
                      :name="list.key === 'included' ? 'i-lucide-check' : 'i-lucide-plus'"
                      :class="list.key === 'included' ? 'text-ok' : 'text-(--ui-text-muted)'"
                    />
                    <span class="flex-1">{{ x }}</span>
                    <UButton
                      size="xs"
                      variant="ghost"
                      icon="i-lucide-x"
                      :aria-label="`Убрать ${x}`"
                      @click="t[list.key].splice(i, 1)"
                    />
                  </li>
                </ul>
                <UInput
                  v-model="listInput[list.key]"
                  size="sm"
                  class="w-full mt-2"
                  placeholder="Добавить, Enter"
                  @keydown.enter.prevent="addListItem(list.key)"
                />
              </div>
            </div>

            <!-- Publish -->
            <div
              v-else-if="tab === 'publish'"
              class="space-y-5"
            >
              <div>
                <div class="flex items-center justify-between mb-2">
                  <p class="text-sm font-medium">
                    Текст для Instagram
                  </p>
                  <div class="flex gap-1">
                    <UButton
                      size="xs"
                      variant="soft"
                      icon="i-lucide-sparkles"
                      label="Сгенерировать"
                      @click="genInstagram"
                    />
                    <UButton
                      v-if="t.instagramText"
                      size="xs"
                      variant="ghost"
                      icon="i-lucide-copy"
                      label="Копировать"
                      @click="copy(t.instagramText!)"
                    />
                  </div>
                </div>
                <UTextarea
                  :model-value="t.instagramText ?? ''"
                  :rows="10"
                  autoresize
                  class="w-full"
                  placeholder="Нажмите «Сгенерировать» — текст соберётся из программы и цены"
                  @update:model-value="t.instagramText = String($event) || null"
                />
              </div>
              <div>
                <p class="text-sm font-medium mb-2">
                  Посты и Reels
                </p>
                <TourPostsEditor v-model="t.posts" />
              </div>
              <div class="rounded-lg border border-(--ui-border) p-4 flex flex-wrap items-center gap-3">
                <UIcon
                  name="i-lucide-globe"
                  class="text-(--ui-primary)"
                />
                <span class="text-sm flex-1 min-w-0">Публичная страница: <code class="text-xs">{{ t.publicUrl }}</code></span>
                <UButton
                  size="sm"
                  variant="soft"
                  icon="i-lucide-copy"
                  label="Копировать"
                  @click="copy(t.publicUrl)"
                />
                <UButton
                  size="sm"
                  icon="i-lucide-external-link"
                  :label="t.status === 'DRAFT' ? 'Доступна после публикации' : 'Открыть'"
                  :to="`/t/${t.slug}`"
                  target="_blank"
                  :disabled="t.status === 'DRAFT'"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Side summary -->
        <aside class="space-y-4 xl:sticky xl:top-14">
          <div
            v-if="t.canFinance && calc"
            class="card p-5 space-y-3"
          >
            <p class="font-semibold">
              Экономика тура
            </p>
            <div class="text-sm space-y-1.5">
              <div class="flex justify-between">
                <span class="text-(--ui-text-muted)">Себестоимость / турист</span><span class="tabular">{{ formatMoney(calc.costPer) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-(--ui-text-muted)">Цена</span><span class="tabular">{{ t.price ? formatMoney(t.price) : '—' }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-(--ui-text-muted)">Прибыль группы</span><span
                  class="tabular font-semibold"
                  :class="calc.profit < 0 ? 'text-bad-text' : 'text-ok-text'"
                >{{ formatMoney(calc.profit) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-(--ui-text-muted)">Безубыточность</span><span class="tabular">{{ calc.breakEven ? `${calc.breakEven} из ${t.seats}` : '—' }}</span>
              </div>
            </div>
            <div
              v-if="calc.breakEven"
              class="h-2 rounded-full bg-(--ui-bg-accented) overflow-hidden relative"
            >
              <div
                class="absolute inset-y-0 left-0 bg-warn/60"
                :style="{ width: `${Math.min(100, (calc.breakEven / t.seats) * 100)}%` }"
              />
              <div
                v-if="t.departure"
                class="absolute inset-y-0 left-0 bg-ok transition-[width] duration-500"
                :style="{ width: `${Math.min(100, (t.departure.sold / t.seats) * 100)}%` }"
              />
            </div>
          </div>
          <div class="card p-5 space-y-2">
            <p class="font-semibold">
              Публикация
            </p>
            <ul class="text-sm space-y-1">
              <li
                v-for="req in ['название', 'даты', 'цена', 'программа', 'доступность всех дней программы']"
                :key="req"
                class="flex items-center gap-2"
              >
                <UIcon
                  :name="publishCheck.missing.includes(req) ? 'i-lucide-circle' : 'i-lucide-check-circle-2'"
                  :class="publishCheck.missing.includes(req) ? 'text-(--ui-text-dimmed)' : 'text-ok'"
                />{{ req.charAt(0).toUpperCase() + req.slice(1) }}
              </li>
            </ul>
            <UButton
              v-if="t.departure"
              block
              size="sm"
              variant="soft"
              icon="i-lucide-bus"
              label="Открыть выезд"
              :to="`/departures/${t.departure.id}`"
            />
          </div>
        </aside>
      </div>
    </template>
  </AppPage>
  <AppPage
    v-else-if="error"
    title="Тур"
    back="/tours"
  >
    <div class="card">
      <EmptyState :text="error.statusMessage || 'Тур не найден'" />
    </div>
  </AppPage>
</template>
