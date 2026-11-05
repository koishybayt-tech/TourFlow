<script setup lang="ts">
definePageMeta({ middleware: 'role', permission: 'tickets' })
useHead({ title: 'Авиабилеты и отели — Tourflow' })

interface Flight { source: string, airline: string, flightNo: string, depart: string, arrive: string, stops: number, price: number, link: string }
interface Hotel { source: string, hotel: string, stars: number, rating: number, nights: number, price: number, link: string }
interface Watch { id: string, kind: 'flight' | 'hotel', query: Record<string, string | number>, lastPrice: number, createdAt: string }

const mode = ref<'air' | 'hotel'>('air')
const plus = (n: number) => isoDay(new Date(Date.now() + n * 86_400_000))
const fq = reactive({ from: 'Алматы', to: 'Стамбул', depart: plus(10), ret: plus(17), roundTrip: true, pax: 2, cabin: 'Эконом' as 'Эконом' | 'Бизнес' })
const hq = reactive({ city: 'Стамбул', checkIn: plus(10), checkOut: plus(17), guests: 2 })
const flights = ref<Flight[]>([])
const hotels = ref<Hotel[]>([])
const loading = ref(false)
const searched = ref(false)
const { data: watches, refresh: refreshWatches } = await useFetch<Watch[]>('/api/tickets/watches', { default: () => [] })

const flightQuery = computed(() => ({ from: fq.from, to: fq.to, depart: fq.depart, ret: fq.roundTrip ? fq.ret : null, pax: fq.pax, cabin: fq.cabin }))
async function search() {
  loading.value = true
  searched.value = true
  if (mode.value === 'air') flights.value = (await mutate(() => api<Flight[]>('/api/tickets/flights', { method: 'POST', body: flightQuery.value }))) ?? []
  else hotels.value = (await mutate(() => api<Hotel[]>('/api/tickets/hotels', { method: 'POST', body: hq }))) ?? []
  loading.value = false
}
async function watch() {
  const r = await mutate(() => api<{ lastPrice: number }>('/api/tickets/watches', { method: 'POST', body: { kind: mode.value === 'air' ? 'flight' : 'hotel', query: mode.value === 'air' ? flightQuery.value : { ...hq } } }))
  if (r) {
    useNotify().ok('Следим за ценой', `Сейчас ${formatMoney(r.lastPrice)}. Сообщим, когда станет дешевле.`)
    refreshWatches()
  }
}
async function unwatch(id: string) {
  await mutate(() => api(`/api/tickets/watches/${id}`, { method: 'DELETE' }))
  refreshWatches()
}
const describeWatch = (w: Watch) => (w.kind === 'flight' ? `${w.query.from} → ${w.query.to}, ${w.query.depart}${w.query.ret ? ` – ${w.query.ret}` : ''}, ${w.query.pax} пасс.` : `${w.query.city}, ${w.query.checkIn} – ${w.query.checkOut}, ${w.query.guests} гостя`)
</script>

<template>
  <AppPage
    title="Авиабилеты и отели"
    subtitle="Поиск по нескольким источникам и мониторинг цен"
  >
    <div class="grid gap-6 xl:grid-cols-[1fr_320px] items-start">
      <div class="space-y-4 min-w-0">
        <form
          class="card p-5 space-y-4"
          @submit.prevent="search"
        >
          <div class="flex rounded-lg border border-(--ui-border) p-0.5 w-fit">
            <UButton
              size="sm"
              icon="i-lucide-plane"
              :variant="mode === 'air' ? 'soft' : 'ghost'"
              :color="mode === 'air' ? 'primary' : 'neutral'"
              label="Авиабилеты"
              @click="mode = 'air'; searched = false"
            />
            <UButton
              size="sm"
              icon="i-lucide-hotel"
              :variant="mode === 'hotel' ? 'soft' : 'ghost'"
              :color="mode === 'hotel' ? 'primary' : 'neutral'"
              label="Отели"
              @click="mode = 'hotel'; searched = false"
            />
          </div>
          <div
            v-if="mode === 'air'"
            class="grid gap-3 grid-cols-2 lg:grid-cols-6 items-end"
          >
            <UFormField label="Откуда">
              <UInput
                v-model="fq.from"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Куда">
              <UInput
                v-model="fq.to"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Туда">
              <UInput
                v-model="fq.depart"
                type="date"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Обратно">
              <UInput
                v-model="fq.ret"
                type="date"
                :disabled="!fq.roundTrip"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Пассажиры">
              <UInputNumber
                v-model="fq.pax"
                :min="1"
                :max="9"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Класс">
              <USelect
                v-model="fq.cabin"
                :items="[{ value: 'Эконом', label: 'Эконом' }, { value: 'Бизнес', label: 'Бизнес' }]"
                class="w-full"
              />
            </UFormField>
            <UCheckbox
              v-model="fq.roundTrip"
              label="Туда и обратно"
            />
          </div>
          <div
            v-else
            class="grid gap-3 grid-cols-2 lg:grid-cols-4 items-end"
          >
            <UFormField label="Город">
              <UInput
                v-model="hq.city"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Заезд">
              <UInput
                v-model="hq.checkIn"
                type="date"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Выезд">
              <UInput
                v-model="hq.checkOut"
                type="date"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Гостей">
              <UInputNumber
                v-model="hq.guests"
                :min="1"
                :max="12"
                class="w-full"
              />
            </UFormField>
          </div>
          <div class="flex justify-end gap-2">
            <UButton
              v-if="searched"
              variant="ghost"
              icon="i-lucide-bell-plus"
              label="Следить за ценой"
              @click="watch"
            />
            <UButton
              type="submit"
              icon="i-lucide-search"
              label="Найти"
              :loading="loading"
            />
          </div>
        </form>

        <div
          v-if="searched"
          class="card overflow-x-auto"
        >
          <table
            v-if="mode === 'air'"
            class="w-full text-sm min-w-[720px]"
          >
            <thead class="text-left text-xs text-(--ui-text-muted) border-b border-(--ui-border)">
              <tr>
                <th class="px-5 py-2.5 font-medium">
                  Рейс
                </th><th class="px-3 py-2.5 font-medium">
                  Вылет → прилёт
                </th><th class="px-3 py-2.5 font-medium">
                  Пересадки
                </th><th class="px-3 py-2.5 font-medium">
                  Источник
                </th><th class="px-3 py-2.5 font-medium text-right">
                  Цена
                </th><th class="px-5 py-2.5" />
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(f, i) in flights"
                :key="i"
                class="border-b border-(--ui-border-muted) last:border-0"
              >
                <td class="px-5 py-2.5">
                  {{ f.airline }}<p class="text-xs text-(--ui-text-muted)">
                    {{ f.flightNo }}
                  </p>
                </td>
                <td class="px-3 py-2.5 tabular">
                  {{ f.depart.slice(11) }} → {{ f.arrive.slice(11) }}
                </td>
                <td class="px-3 py-2.5">
                  {{ f.stops ? `${f.stops} пересадка` : 'прямой' }}
                </td>
                <td class="px-3 py-2.5">
                  <UBadge
                    variant="subtle"
                    color="neutral"
                    :label="f.source"
                  />
                </td>
                <td class="px-3 py-2.5 text-right tabular font-medium">
                  {{ formatMoney(f.price) }}
                </td>
                <td class="px-5 py-2.5 text-right">
                  <UButton
                    size="xs"
                    variant="ghost"
                    label="Открыть ↗"
                    :to="f.link"
                    target="_blank"
                  />
                </td>
              </tr>
            </tbody>
          </table>
          <table
            v-else
            class="w-full text-sm min-w-[640px]"
          >
            <thead class="text-left text-xs text-(--ui-text-muted) border-b border-(--ui-border)">
              <tr>
                <th class="px-5 py-2.5 font-medium">
                  Отель
                </th><th class="px-3 py-2.5 font-medium">
                  Рейтинг
                </th><th class="px-3 py-2.5 font-medium">
                  Источник
                </th><th class="px-3 py-2.5 font-medium text-right">
                  За {{ hotels[0]?.nights ?? '' }} ноч.
                </th><th class="px-5 py-2.5" />
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(h, i) in hotels"
                :key="i"
                class="border-b border-(--ui-border-muted) last:border-0"
              >
                <td class="px-5 py-2.5">
                  {{ h.hotel }} <span class="text-warn">{{ '★'.repeat(h.stars) }}</span>
                </td>
                <td class="px-3 py-2.5 tabular">
                  {{ h.rating }}
                </td>
                <td class="px-3 py-2.5">
                  <UBadge
                    variant="subtle"
                    color="neutral"
                    :label="h.source"
                  />
                </td>
                <td class="px-3 py-2.5 text-right tabular font-medium">
                  {{ formatMoney(h.price) }}
                </td>
                <td class="px-5 py-2.5 text-right">
                  <UButton
                    size="xs"
                    variant="ghost"
                    label="Открыть ↗"
                    :to="h.link"
                    target="_blank"
                  />
                </td>
              </tr>
            </tbody>
          </table>
          <EmptyState
            v-if="!loading && !(mode === 'air' ? flights : hotels).length"
            text="Ничего не нашли — измените даты"
            compact
          />
        </div>
        <p class="text-xs text-(--ui-text-muted)">
          Демо-источники. Реальные источники подключатся по списку от эксперта.
        </p>
      </div>
      <aside class="card p-5 space-y-3">
        <p class="font-semibold flex items-center gap-2">
          <UIcon name="i-lucide-bell-ring" /> Слежу за ценой
        </p>
        <p class="text-xs text-(--ui-text-muted)">
          Проверка каждый час; при снижении — уведомление в приложении и Telegram.
        </p>
        <ul class="space-y-2">
          <li
            v-for="w in watches"
            :key="w.id"
            class="rounded-lg border border-(--ui-border) p-2.5 text-sm flex items-start gap-2"
          >
            <UIcon
              :name="w.kind === 'flight' ? 'i-lucide-plane' : 'i-lucide-hotel'"
              class="mt-0.5 text-(--ui-text-muted)"
            />
            <span class="flex-1">{{ describeWatch(w) }}<span class="block text-xs tabular">сейчас {{ formatMoney(w.lastPrice) }}</span></span>
            <UButton
              size="xs"
              variant="ghost"
              color="error"
              icon="i-lucide-x"
              aria-label="Не следить"
              @click="unwatch(w.id)"
            />
          </li>
        </ul>
        <p
          v-if="!watches.length"
          class="text-sm text-(--ui-text-muted)"
        >
          Найдите билет или отель и нажмите «Следить за ценой».
        </p>
      </aside>
    </div>
  </AppPage>
</template>
