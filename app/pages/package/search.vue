<script setup lang="ts">
import { allocateRooms, describeRooms } from '#shared/domain/roomAllocation'

definePageMeta({ middleware: 'role', permission: 'package' })
useHead({ title: 'Поиск туров — Tourflow' })

interface Offer { operator: string, date: string, nights: number, meal: string, room: string, price: number, commissionPct: number, flight: boolean, transfer: boolean, insurance: boolean, deeplink: string | null, externalRef: string }
interface Hotel { hotel: string, stars: number, resort: string, rating: number, offers: Offer[] }
interface Poll { status: 'running' | 'done', progress: number, operatorsDone: string[], hotels: Hotel[] }

const route = useRoute()
const dealId = computed(() => (route.query.deal as string) || null)
const { data: deal } = await useFetch<{ deal: { number: number, title: string, people: number }, client: { name: string } }>(() => `/api/deals/${dealId.value}`, { immediate: !!dealId.value })
const { data: operators } = await useFetch<{ id: string, name: string }[]>('/api/operators', { default: () => [] })

const today = new Date()
const plusDays = (n: number) => isoDay(new Date(+today + n * 86_400_000))
const q = reactive({ from: 'Алматы', country: 'Турция', dateFrom: plusDays(14), dateTo: plusDays(24), nightsFrom: 7, nightsTo: 10, adults: deal.value?.deal.people ?? 2, childAges: [] as number[], meal: 'Любое', stars: 0, operator: 'all', priceMax: null as number | null })
const rooms = computed(() => {
  try {
    return describeRooms(allocateRooms(q.adults, q.childAges))
  }
  catch (e) {
    return (e as Error).message
  }
})

const result = ref<Poll | null>(null)
const searching = ref(false)
let pollTimer: ReturnType<typeof setTimeout> | null = null
async function search() {
  if (pollTimer) clearTimeout(pollTimer)
  searching.value = true
  result.value = null
  const r = await mutate(() => api<{ id: string }>('/api/package/search', { method: 'POST', body: { ...q, meal: q.meal === 'Любое' ? null : q.meal, stars: q.stars || null, operator: q.operator === 'all' ? null : operators.value.find(o => o.id === q.operator)?.name ?? null } }))
  if (!r) {
    searching.value = false
    return
  }
  const tick = async () => {
    const p = await api<Poll>(`/api/package/search/${r.id}`).catch(() => null)
    if (!p) {
      searching.value = false
      return
    }
    result.value = p
    if (p.status === 'running') pollTimer = setTimeout(tick, 700)
    else searching.value = false
  }
  await tick()
}
onBeforeUnmount(() => pollTimer && clearTimeout(pollTimer))

const pax = computed(() => q.adults + q.childAges.length)
const added = ref<Set<string>>(new Set())
async function addToSelection(h: Hotel, o: Offer) {
  if (!dealId.value) return
  const op = operators.value.find(x => x.name === o.operator)
  if (!op) return useNotify().fail({ data: { statusMessage: `Туроператора «${o.operator}» нет в справочнике` } })
  const markup = Math.round((o.price * o.commissionPct) / 100)
  const to = isoDay(new Date(+new Date(`${o.date}T00:00:00Z`) + o.nights * 86_400_000))
  const r = await mutate(() => api(`/api/deals/${dealId.value}/offers`, {
    method: 'POST',
    body: { operatorId: op.id, hotel: h.hotel, stars: h.stars, resort: h.resort, fromDate: o.date, toDate: to, meal: o.meal, room: o.room, flight: o.flight, transfer: o.transfer, insurance: o.insurance, net: o.price - markup, price: o.price, source: 'search', externalRef: o.externalRef },
  }), 'Добавлено в подборку')
  if (r) added.value = new Set([...added.value, o.externalRef])
}
const childInput = ref<number | null>(null)
function addChild() {
  if (childInput.value === null || q.childAges.length >= 4) return
  q.childAges.push(childInput.value)
  childInput.value = null
}
const OPS_TOTAL = computed(() => (q.operator === 'all' ? operators.value.length || 4 : 1))
</script>

<template>
  <AppPage
    title="Поиск туров"
    :subtitle="deal ? `Подборка для заявки №${deal.deal.number} · ${deal.client.name}` : 'Предложения туроператоров'"
    :back="dealId ? `/deals/${dealId}` : undefined"
  >
    <form
      class="card p-5 space-y-4"
      @submit.prevent="search"
    >
      <div class="grid gap-3 grid-cols-2 md:grid-cols-4 xl:grid-cols-8 items-end">
        <UFormField label="Откуда">
          <USelect
            v-model="q.from"
            :items="['Алматы', 'Астана', 'Шымкент']"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Страна">
          <USelect
            v-model="q.country"
            :items="['Турция', 'ОАЭ', 'Египет']"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Вылет с">
          <UInput
            v-model="q.dateFrom"
            type="date"
            class="w-full"
          />
        </UFormField>
        <UFormField label="по">
          <UInput
            v-model="q.dateTo"
            type="date"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Ночей от">
          <UInputNumber
            v-model="q.nightsFrom"
            :min="1"
            :max="30"
            class="w-full"
          />
        </UFormField>
        <UFormField label="до">
          <UInputNumber
            v-model="q.nightsTo"
            :min="1"
            :max="30"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Взрослые">
          <UInputNumber
            v-model="q.adults"
            :min="1"
            :max="9"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Дети (возраст)">
          <div class="flex gap-1">
            <UInputNumber
              v-model="childInput"
              :min="0"
              :max="17"
              placeholder="лет"
              class="w-20"
            />
            <UButton
              icon="i-lucide-plus"
              variant="soft"
              aria-label="Добавить ребёнка"
              @click="addChild"
            />
          </div>
        </UFormField>
      </div>
      <div class="grid gap-3 grid-cols-2 md:grid-cols-4 items-end">
        <UFormField label="Питание">
          <USelect
            v-model="q.meal"
            :items="['Любое', 'Всё включено', 'Ультра всё включено', 'Полупансион', 'Завтраки']"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Звёздность от">
          <USelect
            v-model="q.stars"
            :items="[{ value: 0, label: 'Любая' }, { value: 3, label: '3★' }, { value: 4, label: '4★' }, { value: 5, label: '5★' }]"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Туроператор">
          <USelect
            v-model="q.operator"
            :items="[{ value: 'all', label: 'Все' }, ...operators.map(o => ({ value: o.id, label: o.name }))]"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Цена до, ₸">
          <UInputNumber
            :model-value="q.priceMax ?? undefined"
            :min="0"
            :step="100000"
            class="w-full"
            @update:model-value="q.priceMax = $event ?? null"
          />
        </UFormField>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <span class="text-sm flex items-center gap-2"><UIcon
          name="i-lucide-bed-double"
          class="text-(--ui-primary)"
        /> Размещение: <b>{{ rooms }}</b></span>
        <span class="flex gap-1">
          <UBadge
            v-for="(a, i) in q.childAges"
            :key="i"
            variant="soft"
            color="neutral"
            class="gap-1"
          >реб. {{ a }} <button
            type="button"
            :aria-label="`Убрать ребёнка ${a} лет`"
            @click="q.childAges.splice(i, 1)"
          ><UIcon
            name="i-lucide-x"
            class="size-3"
          /></button></UBadge>
        </span>
        <UButton
          type="submit"
          class="ml-auto"
          icon="i-lucide-search"
          label="Найти туры"
          :loading="searching"
        />
      </div>
    </form>

    <div
      v-if="result || searching"
      class="space-y-3"
    >
      <div class="flex items-center gap-3 text-sm">
        <div class="h-1.5 flex-1 rounded-full bg-(--ui-bg-accented) overflow-hidden">
          <div
            class="h-full bg-(--ui-primary) transition-[width] duration-500"
            :style="{ width: `${result?.progress ?? 5}%` }"
          />
        </div>
        <span class="text-(--ui-text-muted)">{{ searching ? `Опрашиваем операторов: ${result?.operatorsDone.length ?? 0} из ${OPS_TOTAL}` : `Готово · ${result?.hotels.length ?? 0} отелей` }}</span>
      </div>
      <TransitionGroup
        name="list"
        tag="div"
        class="space-y-3"
      >
        <div
          v-for="h in result?.hotels ?? []"
          :key="h.hotel"
          class="card"
        >
          <div class="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-(--ui-border-muted)">
            <div class="flex-1 min-w-0">
              <p class="font-semibold">
                {{ h.hotel }} <span class="text-warn">{{ '★'.repeat(h.stars) }}</span>
              </p>
              <p class="text-xs text-(--ui-text-muted)">
                {{ h.resort }} · рейтинг {{ h.rating }}
              </p>
            </div>
            <p class="text-sm">
              от <b class="tabular">{{ formatMoney(h.offers[0]!.price) }}</b>
            </p>
          </div>
          <table class="w-full text-sm">
            <tbody>
              <tr
                v-for="o in h.offers.slice(0, 6)"
                :key="o.externalRef"
                class="border-b border-(--ui-border-muted) last:border-0"
              >
                <td class="px-5 py-2 w-36">
                  {{ o.operator }}
                </td>
                <td class="px-3 py-2 tabular">
                  {{ formatDayMonth(o.date, { dateOnly: true }) }} · {{ o.nights }} {{ plural(o.nights, 'ночь', 'ночи', 'ночей') }}
                </td>
                <td class="px-3 py-2 text-(--ui-text-muted)">
                  {{ o.meal }} · {{ o.room }}
                </td>
                <td class="px-3 py-2 text-right tabular font-medium">
                  {{ formatMoney(o.price) }}
                </td>
                <td class="px-3 py-2 text-right tabular text-xs text-(--ui-text-muted)">
                  {{ formatMoney(Math.round(o.price / pax)) }}/чел.
                </td>
                <td class="px-3 py-2 text-right text-xs text-ok-text">
                  комиссия {{ o.commissionPct }}%
                </td>
                <td class="px-5 py-2 text-right whitespace-nowrap">
                  <UButton
                    v-if="dealId"
                    size="xs"
                    :variant="added.has(o.externalRef) ? 'ghost' : 'soft'"
                    :icon="added.has(o.externalRef) ? 'i-lucide-check' : 'i-lucide-plus'"
                    :label="added.has(o.externalRef) ? 'В подборке' : 'В подборку'"
                    :disabled="added.has(o.externalRef)"
                    @click="addToSelection(h, o)"
                  />
                  <UButton
                    v-if="o.deeplink"
                    size="xs"
                    variant="ghost"
                    color="neutral"
                    label="У оператора ↗"
                    :to="o.deeplink"
                    target="_blank"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </TransitionGroup>
      <div
        v-if="!searching && result && !result.hotels.length"
        class="card"
      >
        <EmptyState
          icon="i-lucide-search-x"
          text="Ничего не нашли. Расширьте даты, количество ночей или уберите фильтр по питанию."
        />
      </div>
    </div>
    <div
      v-else
      class="card"
    >
      <EmptyState
        icon="i-lucide-palmtree"
        text="Задайте параметры и нажмите «Найти туры». Результаты появляются по мере ответа операторов."
      />
    </div>
  </AppPage>
</template>

<style scoped>
.list-enter-active { transition: opacity 250ms ease-out, transform 250ms ease-out; }
.list-enter-from { opacity: 0; transform: translateY(6px); }
@media (prefers-reduced-motion: reduce) { .list-enter-from { transform: none; } }
</style>
