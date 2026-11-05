<script setup lang="ts">
import { EVENT_TYPES } from '#shared/schemas/events'

definePageMeta({ middleware: 'role', permission: 'calendar' })
useHead({ title: 'Календарь — Tourflow' })

interface CalEvent { id: string, kind: 'event' | 'auto', type: keyof typeof EVENT_TYPES, title: string, startAt: string, endAt: string | null, place: string | null, who: string | null, link: string | null, sub: string | null }

const { me } = useMe()
const view = ref<'month' | 'week' | 'list'>('month')
const cursor = ref(startOfAlmatyDay())
const who = ref('all')
const types = reactive<Record<string, boolean>>(Object.fromEntries(Object.keys(EVENT_TYPES).map(k => [k, true])))
const TYPE_STYLE: Record<string, string> = {
  meeting: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200',
  call: 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200',
  visa: 'bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200',
  flight: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
  pay: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
  task: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/20 dark:text-zinc-200',
  briefing: 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200',
}

// Visible range
const range = computed(() => {
  const p = almatyPartsOf(cursor.value)
  if (view.value === 'week') {
    const dow = (p.dow + 6) % 7
    const start = new Date(+cursor.value - dow * 86_400_000)
    return { from: start, days: 7 }
  }
  const first = new Date(Date.UTC(p.y, p.m, 1) - 5 * 3_600_000)
  const firstDow = (almatyPartsOf(first).dow + 6) % 7
  const start = new Date(+first - firstDow * 86_400_000)
  const daysInMonth = new Date(Date.UTC(p.y, p.m + 1, 0)).getUTCDate()
  return { from: start, days: Math.ceil((firstDow + daysInMonth) / 7) * 7 }
})
const days = computed(() => Array.from({ length: range.value.days }, (_, i) => new Date(+range.value.from + i * 86_400_000)))
const query = computed(() => ({ from: isoDay(days.value[0]!), to: isoDay(days.value.at(-1)!), who: who.value }))
const { data: events, refresh } = await useFetch<CalEvent[]>('/api/calendar', { query, default: () => [] })
const shown = computed(() => events.value.filter(e => types[e.type] !== false))
const byDay = computed(() => {
  const m: Record<string, CalEvent[]> = {}
  for (const e of shown.value) (m[isoDay(e.startAt)] ??= []).push(e)
  return m
})
const monthTitle = computed(() => {
  const s = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric', timeZone: 'Asia/Almaty' }).format(cursor.value)
  return s.charAt(0).toUpperCase() + s.slice(1)
})
function almatyPartsOf(d: Date) {
  const t = new Date(+d + 5 * 3_600_000)
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate(), dow: t.getUTCDay() }
}
function shift(n: number) {
  const p = almatyPartsOf(cursor.value)
  cursor.value = view.value === 'week' ? new Date(+cursor.value + n * 7 * 86_400_000) : new Date(Date.UTC(p.y, p.m + n, 1) - 5 * 3_600_000 + 86_400_000)
}
const todayIso = isoDay(new Date())
const curMonth = computed(() => almatyPartsOf(cursor.value).m)
const selected = ref<CalEvent | null>(null)

// Create
const open = ref(false)
const ev = reactive({ type: 'meeting' as keyof typeof EVENT_TYPES, title: '', date: todayIso, time: '10:00', duration: 60, place: '', assigneeId: undefined as string | undefined, remind: 'За 1 час в Telegram', description: '' })
const conflict = ref<string | null>(null)
function create(day?: Date) {
  Object.assign(ev, { type: 'meeting', title: '', date: day ? isoDay(day) : todayIso, time: '10:00', duration: 60, place: '', assigneeId: me.value?.member.id, remind: 'За 1 час в Telegram', description: '' })
  conflict.value = null
  open.value = true
}
async function save(force = false) {
  const startAt = new Date(`${ev.date}T${ev.time}:00+05:00`)
  const body = { type: ev.type, title: ev.title, description: ev.description, startAt: startAt.toISOString(), endAt: new Date(+startAt + ev.duration * 60_000).toISOString(), place: ev.place, assigneeId: ev.assigneeId ?? null, remind: ev.remind === 'Без напоминания' ? null : ev.remind, force }
  try {
    await api('/api/events', { method: 'POST', body })
    open.value = false
    useNotify().ok('Событие добавлено', ev.remind !== 'Без напоминания' ? `Напоминание: ${ev.remind.toLowerCase()}` : undefined)
    refresh()
  }
  catch (e) {
    const err = e as { statusCode?: number }
    if (err.statusCode === 409) conflict.value = errorMessage(e)
    else useNotify().fail(e)
  }
}
async function remove(id: string) {
  if (await mutate(() => api(`/api/events/${id}`, { method: 'DELETE' }), 'Событие удалено')) {
    selected.value = null
    refresh()
  }
}
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const REMINDS = ['Без напоминания', 'За 15 минут в Telegram', 'За 1 час в Telegram', 'Клиенту в WhatsApp за 1 день']
const listDays = computed(() => Object.keys(byDay.value).sort())
</script>

<template>
  <AppPage
    title="Календарь"
    :subtitle="monthTitle"
  >
    <template #actions>
      <UButton
        icon="i-lucide-plus"
        label="Событие"
        @click="create()"
      />
    </template>

    <div class="flex flex-wrap items-center gap-3">
      <div class="flex items-center gap-1">
        <UButton
          icon="i-lucide-chevron-left"
          variant="ghost"
          color="neutral"
          aria-label="Назад"
          @click="shift(-1)"
        />
        <UButton
          variant="outline"
          color="neutral"
          size="sm"
          label="Сегодня"
          @click="cursor = startOfAlmatyDay()"
        />
        <UButton
          icon="i-lucide-chevron-right"
          variant="ghost"
          color="neutral"
          aria-label="Вперёд"
          @click="shift(1)"
        />
      </div>
      <div class="flex rounded-lg border border-(--ui-border) p-0.5">
        <UButton
          v-for="v in [{ v: 'month', l: 'Месяц' }, { v: 'week', l: 'Неделя' }, { v: 'list', l: 'Список' }]"
          :key="v.v"
          size="sm"
          :variant="view === v.v ? 'soft' : 'ghost'"
          :color="view === v.v ? 'primary' : 'neutral'"
          :label="v.l"
          @click="view = v.v as 'month' | 'week' | 'list'"
        />
      </div>
      <USelect
        v-model="who"
        size="sm"
        :items="[{ value: 'all', label: 'Все сотрудники' }, ...(me?.members ?? []).map(m => ({ value: m.id, label: m.name }))]"
        class="w-44"
      />
      <div class="flex flex-wrap gap-1">
        <button
          v-for="(label, k) in EVENT_TYPES"
          :key="k"
          class="rounded-md px-2 py-0.5 text-xs font-medium transition-opacity"
          :class="[TYPE_STYLE[k], types[k] ? '' : 'opacity-35']"
          :aria-pressed="types[k]"
          @click="types[k] = !types[k]"
        >
          {{ label }}
        </button>
      </div>
    </div>

    <!-- Month / week grid -->
    <div
      v-if="view !== 'list'"
      class="card overflow-hidden"
    >
      <div class="grid grid-cols-7 border-b border-(--ui-border) text-xs text-(--ui-text-muted)">
        <div
          v-for="d in WEEKDAYS"
          :key="d"
          class="px-2 py-1.5"
        >
          {{ d }}
        </div>
      </div>
      <div class="grid grid-cols-7">
        <div
          v-for="d in days"
          :key="d.toISOString()"
          class="border-b border-r border-(--ui-border-muted) p-1.5 group cursor-pointer hover:bg-(--ui-bg-muted)/50"
          :class="[view === 'week' ? 'min-h-72' : 'min-h-28', view === 'month' && almatyPartsOf(d).m !== curMonth ? 'bg-(--ui-bg-muted)/40 text-(--ui-text-dimmed)' : '']"
          @click.self="create(d)"
        >
          <div class="flex items-center justify-between mb-1">
            <span
              class="text-xs size-6 grid place-items-center rounded-full"
              :class="isoDay(d) === todayIso ? 'bg-(--ui-primary) text-white font-semibold' : ''"
            >{{ almatyPartsOf(d).d }}</span>
            <button
              class="opacity-0 group-hover:opacity-100 text-(--ui-text-muted)"
              aria-label="Добавить событие"
              @click="create(d)"
            >
              <UIcon
                name="i-lucide-plus"
                class="size-3.5"
              />
            </button>
          </div>
          <div class="space-y-0.5">
            <button
              v-for="e in (byDay[isoDay(d)] ?? []).slice(0, view === 'week' ? 12 : 3)"
              :key="e.id"
              class="w-full text-left truncate rounded px-1.5 py-0.5 text-[11px]"
              :class="TYPE_STYLE[e.type]"
              @click="selected = e"
            >
              <span
                v-if="e.kind === 'event' || e.type !== 'pay'"
                class="tabular font-medium"
              >{{ formatTime(e.startAt) }}</span> {{ e.title }}
            </button>
            <p
              v-if="view === 'month' && (byDay[isoDay(d)]?.length ?? 0) > 3"
              class="text-[11px] text-(--ui-text-muted) px-1"
            >
              ещё {{ byDay[isoDay(d)]!.length - 3 }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- List -->
    <div
      v-else
      class="space-y-4"
    >
      <div
        v-for="day in listDays"
        :key="day"
        class="card"
      >
        <p
          class="px-5 pt-4 pb-2 text-sm font-semibold"
          :class="day === todayIso && 'text-(--ui-primary)'"
        >
          {{ formatDayMonth(byDay[day]![0]!.startAt) }}{{ day === todayIso ? ' · сегодня' : '' }}
        </p>
        <button
          v-for="e in byDay[day]"
          :key="e.id"
          class="w-full text-left flex items-center gap-3 px-5 py-2 border-t border-(--ui-border-muted) hover:bg-(--ui-bg-muted)"
          @click="selected = e"
        >
          <span class="text-sm tabular w-12 font-medium">{{ formatTime(e.startAt) }}</span>
          <span
            class="rounded px-1.5 py-0.5 text-[11px]"
            :class="TYPE_STYLE[e.type]"
          >{{ EVENT_TYPES[e.type] }}</span>
          <span class="flex-1 min-w-0 truncate text-sm">{{ e.title }}</span>
          <span class="text-xs text-(--ui-text-muted)">{{ [e.place, e.who].filter(Boolean).join(' · ') }}</span>
        </button>
      </div>
      <div
        v-if="!listDays.length"
        class="card"
      >
        <EmptyState
          icon="i-lucide-calendar-check"
          text="Событий в этом периоде нет."
          action="Добавить событие"
          @action="create()"
        />
      </div>
    </div>

    <USlideover
      :open="!!selected"
      :title="selected?.title"
      @update:open="v => !v && (selected = null)"
    >
      <template #body>
        <div
          v-if="selected"
          class="space-y-3 text-sm"
        >
          <span
            class="rounded px-2 py-0.5 text-xs"
            :class="TYPE_STYLE[selected.type]"
          >{{ EVENT_TYPES[selected.type] }}{{ selected.kind === 'auto' ? ' · автоматически' : '' }}</span>
          <p>
            <UIcon name="i-lucide-clock" /> {{ formatDateTime(selected.startAt) }}<template v-if="selected.endAt">
              – {{ formatTime(selected.endAt) }}
            </template>
          </p>
          <p v-if="selected.place">
            <UIcon name="i-lucide-map-pin" /> {{ selected.place }}
          </p>
          <p v-if="selected.who">
            <UIcon name="i-lucide-user" /> {{ selected.who }}
          </p>
          <p
            v-if="selected.sub"
            class="text-(--ui-text-muted)"
          >
            {{ selected.sub }}
          </p>
          <div class="flex gap-2 pt-2">
            <UButton
              v-if="selected.link"
              :to="selected.link"
              label="Открыть"
              trailing-icon="i-lucide-arrow-right"
            />
            <UButton
              v-if="selected.kind === 'event'"
              color="error"
              variant="ghost"
              label="Удалить"
              @click="remove(selected.id)"
            />
          </div>
        </div>
      </template>
    </USlideover>

    <UModal
      v-model:open="open"
      title="Новое событие"
    >
      <template #body>
        <form
          class="space-y-4"
          @submit.prevent="save()"
        >
          <div class="grid grid-cols-[160px_1fr] gap-3">
            <UFormField label="Тип">
              <USelect
                v-model="ev.type"
                :items="Object.entries(EVENT_TYPES).map(([value, label]) => ({ value, label }))"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Название">
              <UInput
                v-model="ev.title"
                class="w-full"
                autofocus
              />
            </UFormField>
          </div>
          <div class="grid grid-cols-3 gap-3">
            <UFormField label="Дата">
              <UInput
                v-model="ev.date"
                type="date"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Время">
              <UInput
                v-model="ev.time"
                type="time"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Длительность, мин">
              <UInputNumber
                v-model="ev.duration"
                :min="15"
                :step="15"
                class="w-full"
              />
            </UFormField>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Сотрудник">
              <USelect
                v-model="ev.assigneeId"
                :items="(me?.members ?? []).map(m => ({ value: m.id, label: m.name }))"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Напоминание">
              <USelect
                v-model="ev.remind"
                :items="REMINDS.map(r => ({ value: r, label: r }))"
                class="w-full"
              />
            </UFormField>
          </div>
          <UFormField label="Место">
            <UInput
              v-model="ev.place"
              class="w-full"
            />
          </UFormField>
          <UAlert
            v-if="conflict"
            color="warning"
            variant="subtle"
            icon="i-lucide-calendar-x"
            :title="conflict"
            :actions="[{ label: 'Всё равно добавить', onClick: () => save(true) }]"
          />
          <div class="flex justify-end gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              label="Отмена"
              @click="open = false"
            />
            <UButton
              type="submit"
              label="Добавить"
            />
          </div>
        </form>
      </template>
    </UModal>
  </AppPage>
</template>
