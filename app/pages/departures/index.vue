<script setup lang="ts">
definePageMeta({ middleware: 'role', permission: 'departures' })
useHead({ title: 'Выезды — Tourflow' })
interface Dep { id: string, name: string, route: string | null, month: string, dates: string, daysLeft: number, type: string, visa: boolean, minSeats: number, maxSeats: number, price: number, guide: string | null, total: number, ready: number, risk: boolean }
const scope = ref('upcoming')
const { data: deps } = await useFetch<Dep[]>('/api/departures', { query: { scope }, default: () => [] })
const months = computed(() => {
  const m = new Map<string, Dep[]>()
  for (const d of deps.value) m.set(d.month, [...(m.get(d.month) ?? []), d])
  return [...m]
})
</script>

<template>
  <AppPage
    title="Выезды"
    subtitle="Группы на конкретные даты"
  >
    <div class="flex gap-1">
      <UButton
        v-for="s in [{ v: 'upcoming', l: 'Предстоящие' }, { v: 'past', l: 'Прошедшие' }, { v: 'all', l: 'Все' }]"
        :key="s.v"
        size="sm"
        :variant="scope === s.v ? 'soft' : 'ghost'"
        :color="scope === s.v ? 'primary' : 'neutral'"
        :label="s.l"
        @click="scope = s.v"
      />
    </div>
    <div
      v-for="[month, list] in months"
      :key="month"
      class="space-y-2"
    >
      <p class="text-xs font-semibold uppercase tracking-wide text-(--ui-text-muted)">
        {{ month }}
      </p>
      <div class="card divide-y divide-(--ui-border-muted)">
        <NuxtLink
          v-for="d in list"
          :key="d.id"
          :to="`/departures/${d.id}`"
          class="flex flex-wrap items-center gap-4 px-5 py-4 hover:bg-(--ui-bg-muted)"
        >
          <div class="min-w-0 flex-1">
            <p class="font-medium flex items-center gap-2">
              {{ d.name }}
              <UBadge
                v-if="d.risk"
                size="sm"
                color="warning"
                variant="subtle"
                icon="i-lucide-alert-triangle"
                label="Риск недобора"
              />
              <UBadge
                v-if="d.visa"
                size="sm"
                color="neutral"
                variant="subtle"
                label="Виза"
              />
            </p>
            <p class="text-sm text-(--ui-text-muted)">
              {{ d.dates }} · {{ d.type }} · {{ d.daysLeft >= 0 ? `через ${d.daysLeft} дн.` : 'прошёл' }}
            </p>
          </div>
          <div class="w-48">
            <div class="flex justify-between text-xs text-(--ui-text-muted) mb-1">
              <span>готовы {{ d.ready }} · всего {{ d.total }}</span><span>мин. {{ d.minSeats }} / {{ d.maxSeats }}</span>
            </div>
            <div class="h-2 rounded-full bg-(--ui-bg-accented) overflow-hidden relative">
              <div
                class="absolute inset-y-0 left-0 bg-(--ui-primary)/35"
                :style="{ width: `${(d.total / d.maxSeats) * 100}%` }"
              />
              <div
                class="absolute inset-y-0 left-0 bg-ok"
                :style="{ width: `${(d.ready / d.maxSeats) * 100}%` }"
              />
              <div
                class="absolute inset-y-0 w-0.5 bg-(--ui-text-muted)"
                :style="{ left: `${(d.minSeats / d.maxSeats) * 100}%` }"
              />
            </div>
          </div>
          <span class="text-sm w-36 truncate">
            <UIcon
              name="i-lucide-flag"
              class="text-(--ui-text-muted)"
            /> {{ d.guide ?? 'без гида' }}
          </span>
          <span class="text-sm tabular w-28 text-right">{{ formatMoney(d.price) }}</span>
        </NuxtLink>
      </div>
    </div>
    <div
      v-if="!deps.length"
      class="card"
    >
      <EmptyState
        icon="i-lucide-bus"
        text="Выезды появляются при публикации тура в конструкторе."
        action="Мои туры"
        to="/tours"
      />
    </div>
  </AppPage>
</template>
