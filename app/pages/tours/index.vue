<script setup lang="ts">
definePageMeta({ middleware: 'role', permission: 'tours' })
useHead({ title: 'Мои туры — Tourflow' })

interface TourRow { id: string, slug: string, name: string, flags: string | null, route: string, startDate: string | null, endDate: string | null, seats: number, price: number, status: 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'ARCHIVE', coverKey: string | null, sold: number, profitFull: number | null, breakEven: number | null, costPer: number | null }
const status = ref('all')
const { data: tours, refresh } = await useFetch<TourRow[]>('/api/tours', { query: { status }, default: () => [] })
const STATUS: Record<string, { label: string, color: 'neutral' | 'success' | 'warning' }> = { DRAFT: { label: 'Черновик', color: 'neutral' }, PUBLISHED: { label: 'Опубликован', color: 'success' }, CLOSED: { label: 'Набор закрыт', color: 'warning' }, ARCHIVE: { label: 'Архив', color: 'neutral' } }
const FILTERS = [{ v: 'all', l: 'Все' }, { v: 'DRAFT', l: 'Черновик' }, { v: 'PUBLISHED', l: 'Опубликован' }, { v: 'CLOSED', l: 'Набор закрыт' }, { v: 'ARCHIVE', l: 'Архив' }]
const COVERS = ['from-sky-500 to-indigo-600', 'from-emerald-500 to-teal-700', 'from-amber-500 to-rose-600', 'from-violet-500 to-fuchsia-600']

const createOpen = ref(false)
const name = ref('')
async function create() {
  const r = await mutate(() => api<{ id: string }>('/api/tours', { method: 'POST', body: { name: name.value } }))
  if (r) await navigateTo(`/tours/${r.id}`)
}
async function duplicate(id: string) {
  const r = await mutate(() => api<{ id: string }>(`/api/tours/${id}/duplicate`, { method: 'POST' }), 'Тур скопирован: программа сохранена, цены очищены')
  if (r) await navigateTo(`/tours/${r.id}`)
}
const dates = (t: TourRow) => (t.startDate && t.endDate ? formatRange(t.startDate, t.endDate) : 'даты не заданы')
void refresh
</script>

<template>
  <AppPage
    title="Мои туры"
    subtitle="Конструктор авторских туров"
  >
    <template #actions>
      <UButton
        icon="i-lucide-plus"
        label="Создать тур"
        @click="createOpen = true; name = ''"
      />
    </template>
    <div class="flex gap-1 flex-wrap">
      <UButton
        v-for="f in FILTERS"
        :key="f.v"
        size="sm"
        :variant="status === f.v ? 'soft' : 'ghost'"
        :color="status === f.v ? 'primary' : 'neutral'"
        :label="f.l"
        @click="status = f.v"
      />
    </div>
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      <div
        v-for="(t, i) in tours"
        :key="t.id"
        class="card overflow-hidden flex flex-col tour-card"
        :style="{ animationDelay: `${i * 30}ms` }"
      >
        <NuxtLink
          :to="`/tours/${t.id}`"
          class="block h-36 relative bg-gradient-to-br"
          :class="COVERS[i % COVERS.length]"
        >
          <img
            v-if="t.coverKey"
            :src="`/api/public/media/${t.coverKey}`"
            alt=""
            class="absolute inset-0 size-full object-cover"
            loading="lazy"
          >
          <span class="absolute left-3 top-3"><UBadge
            :color="STATUS[t.status]!.color"
            variant="solid"
            :label="STATUS[t.status]!.label"
          /></span>
          <span class="absolute right-3 top-3 text-xl drop-shadow">{{ t.flags }}</span>
        </NuxtLink>
        <div class="p-4 flex-1 flex flex-col gap-2">
          <NuxtLink
            :to="`/tours/${t.id}`"
            class="font-semibold leading-snug hover:underline"
          >{{ t.name }}</NuxtLink>
          <p class="text-xs text-(--ui-text-muted) line-clamp-2">
            {{ t.route || 'маршрут не задан' }}
          </p>
          <p class="text-sm">
            {{ dates(t) }}
          </p>
          <div class="mt-auto pt-2 grid grid-cols-2 gap-2 text-sm border-t border-(--ui-border-muted)">
            <div>
              <p class="text-xs text-(--ui-text-muted)">
                Места
              </p><p class="tabular">
                {{ t.sold }} / {{ t.seats }}
              </p>
            </div>
            <div>
              <p class="text-xs text-(--ui-text-muted)">
                Цена
              </p><p class="tabular">
                {{ t.price ? formatMoney(t.price) : '—' }}
              </p>
            </div>
            <div v-if="t.profitFull !== null">
              <p class="text-xs text-(--ui-text-muted)">
                Прибыль при полной группе
              </p><p
                class="tabular"
                :class="t.profitFull < 0 ? 'text-bad-text' : 'text-ok-text'"
              >
                {{ t.price ? formatMoney(t.profitFull) : '—' }}
              </p>
            </div>
            <div v-if="t.profitFull !== null">
              <p class="text-xs text-(--ui-text-muted)">
                Безубыточность
              </p><p class="tabular">
                {{ t.breakEven ? `от ${t.breakEven} чел.` : '—' }}
              </p>
            </div>
          </div>
          <div class="flex gap-1">
            <UButton
              size="xs"
              variant="ghost"
              icon="i-lucide-pencil"
              label="Редактировать"
              :to="`/tours/${t.id}`"
            />
            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-lucide-copy"
              label="Дублировать"
              @click="duplicate(t.id)"
            />
          </div>
        </div>
      </div>
    </div>
    <div
      v-if="!tours.length"
      class="card"
    >
      <EmptyState
        icon="i-lucide-map"
        text="Соберите авторский тур: программа по дням, перелёты, проживание и расчёт себестоимости."
        action="Создать тур"
        @action="createOpen = true"
      />
    </div>
    <UModal
      v-model:open="createOpen"
      title="Новый тур"
    >
      <template #body>
        <form
          class="space-y-4"
          @submit.prevent="create"
        >
          <UFormField label="Название тура">
            <UInput
              v-model="name"
              placeholder="GRAND TOUR"
              class="w-full"
              autofocus
            />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              label="Отмена"
              @click="createOpen = false"
            />
            <UButton
              type="submit"
              :disabled="name.trim().length < 2"
              label="Создать"
            />
          </div>
        </form>
      </template>
    </UModal>
  </AppPage>
</template>

<style scoped>
.tour-card { animation: rise 220ms ease-out both; }
@keyframes rise { from { opacity: 0; transform: translateY(6px); } }
@media (prefers-reduced-motion: reduce) { .tour-card { animation: fadein 200ms both; } @keyframes fadein { from { opacity: 0; } } }
</style>
