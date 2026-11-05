<script setup lang="ts">
definePageMeta({ middleware: 'role', permission: 'departures' })
interface Part { id: string, name: string, dealId: string | null, step: number, ready: boolean, paid: number | null, passportNote: string | null, stepLabel: string, manager: string | null }
interface Dep {
  id: string
  name: string
  route: string | null
  dates: string
  startDate: string
  type: string
  visa: boolean
  minSeats: number
  maxSeats: number
  price: number
  flightDeadline: string
  payDeadline: string
  briefingAt: string
  flightTaskDone: boolean
  hotelTaskDone: boolean
  tour: { id: string, slug: string, status: string } | null
  guide: { id: string, name: string, languages: string[], rate: number } | null
  steps: string[]
  participants: Part[]
  tasks: { id: string, title: string, status: 'TODO' | 'IN_PROGRESS' | 'DONE', dueAt: string | null, assignee: string | null }[]
}
interface Cand { id: string, fullName: string, languages: string[], rate: number, rating: number | null, experienceYears: number, fit: string, reasons: string[], current: boolean }
const route = useRoute()
const id = String(route.params.id)
const { data: d, refresh } = await useFetch<Dep>(`/api/departures/${id}`)
useHead(() => ({ title: `${d.value?.name ?? 'Выезд'} — Tourflow` }))
const { can } = usePermissions()
const ready = computed(() => d.value?.participants.filter(p => p.ready).length ?? 0)
const inProgress = computed(() => (d.value?.participants.length ?? 0) - ready.value)
const daysLeft = computed(() => (d.value ? Math.ceil((+new Date(d.value.startDate) - Date.now()) / 86_400_000) : 0))
const risk = computed(() => !!d.value && daysLeft.value <= 30 && ready.value < d.value.minSeats)
const seats = computed(() => {
  if (!d.value) return []
  const r = d.value.participants.filter(p => p.ready).length
  const p = d.value.participants.length
  return Array.from({ length: d.value.maxSeats }, (_, i) => (i < r ? 'ready' : i < p ? 'progress' : 'free'))
})

// Guide picker
const guideOpen = ref(false)
const { data: cands, execute: loadCands } = useFetch<Cand[]>(`/api/departures/${id}/guides`, { immediate: false, default: () => [] })
async function openGuides() {
  guideOpen.value = true
  await loadCands()
}
async function setGuide(guideId: string | null) {
  if (await mutate(() => api(`/api/departures/${id}`, { method: 'PATCH', body: { guideId } }), guideId ? 'Гид назначен' : 'Гид снят')) {
    guideOpen.value = false
    refresh()
  }
}
const FIT_COLOR: Record<string, 'success' | 'primary' | 'warning' | 'neutral'> = { 'Лучший выбор': 'success', 'Подходит': 'primary', 'С оговорками': 'warning', 'Недоступен': 'neutral' }

// Participants
const addOpen = ref(false)
const add = reactive({ name: '', passportNote: '', paid: 0 })
async function addParticipant() {
  if (await mutate(() => api(`/api/departures/${id}/participants`, { method: 'POST', body: add }), 'Участник добавлен')) {
    addOpen.value = false
    Object.assign(add, { name: '', passportNote: '', paid: 0 })
    refresh()
  }
}
const dealFor = ref<Part | null>(null)
const phone = ref('')
async function createDeal() {
  const r = await mutate(() => api<{ id: string }>(`/api/participants/${dealFor.value!.id}/deal`, { method: 'POST', body: { phone: phone.value } }), 'Заявка создана')
  if (r) navigateTo(`/deals/${r.id}`)
}
const taskId = ref<string | null>(null)
</script>

<template>
  <AppPage
    v-if="d"
    :title="d.name"
    :subtitle="`${d.dates} · ${d.type}${d.visa ? ' · визовый' : ''}`"
    back="/departures"
  >
    <template #actions>
      <UButton
        v-if="d.tour"
        :to="`/tours/${d.tour.id}`"
        color="neutral"
        variant="ghost"
        icon="i-lucide-map"
        label="Тур"
      />
    </template>
    <UAlert
      v-if="risk"
      color="warning"
      variant="subtle"
      icon="i-lucide-alert-triangle"
      :title="`Риск недобора: готовы ${ready} из минимальных ${d.minSeats}, до выезда ${daysLeft} дн.`"
      description="Варианты: добрать через партнёров, перенести даты или отменить с возвратом."
    />
    <div class="grid gap-4 grid-cols-2 lg:grid-cols-5">
      <StatCard
        label="Готовы к выезду"
        :value="`${ready} / ${d.minSeats}`"
        hint="минимум группы"
        icon="i-lucide-user-check"
        :tone="ready >= d.minSeats ? 'success' : 'warning'"
      />
      <StatCard
        label="В процессе"
        :value="inProgress"
        icon="i-lucide-loader"
      />
      <StatCard
        label="Свободно"
        :value="d.maxSeats - d.participants.length"
        :hint="`из ${d.maxSeats} мест`"
        icon="i-lucide-armchair"
      />
      <StatCard
        label="День X"
        :value="daysLeft >= 0 ? `через ${daysLeft} дн.` : 'прошёл'"
        :hint="`брифинг ${formatDate(d.briefingAt, { dateOnly: true })}`"
        icon="i-lucide-plane-takeoff"
      />
      <StatCard
        label="Цена"
        :value="formatMoney(d.price)"
        icon="i-lucide-wallet"
      />
    </div>

    <div class="grid gap-6 xl:grid-cols-[1fr_340px] items-start">
      <div class="space-y-6 min-w-0">
        <div class="card p-5">
          <p class="font-semibold mb-3">
            Места
          </p>
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="(s, i) in seats"
              :key="i"
              class="size-7 rounded-md grid place-items-center text-[11px] font-medium"
              :class="s === 'ready' ? 'bg-ok text-white' : s === 'progress' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300' : 'bg-(--ui-bg-accented) text-(--ui-text-dimmed)'"
              :title="s === 'ready' ? 'Готов' : s === 'progress' ? 'В процессе' : 'Свободно'"
            >{{ i + 1 }}</span>
          </div>
          <div class="flex gap-4 text-xs text-(--ui-text-muted) mt-3">
            <span class="flex items-center gap-1"><span class="size-2.5 rounded bg-ok" />готов</span>
            <span class="flex items-center gap-1"><span class="size-2.5 rounded bg-indigo-200" />в процессе</span>
            <span class="flex items-center gap-1"><span class="size-2.5 rounded bg-(--ui-bg-accented)" />свободно</span>
          </div>
        </div>

        <div class="card overflow-x-auto">
          <div class="flex items-center justify-between px-5 py-4">
            <p class="font-semibold">
              Участники · {{ d.participants.length }}
            </p>
            <UButton
              size="sm"
              variant="soft"
              icon="i-lucide-user-plus"
              label="Участник"
              @click="addOpen = true"
            />
          </div>
          <table class="w-full text-sm min-w-[720px]">
            <thead class="text-left text-xs text-(--ui-text-muted) border-y border-(--ui-border)">
              <tr>
                <th class="px-5 py-2 font-medium">
                  Участник
                </th><th class="px-3 py-2 font-medium">
                  Шаг процесса
                </th><th class="px-3 py-2 font-medium">
                  Ответственный
                </th><th
                  v-if="can('payments')"
                  class="px-3 py-2 font-medium text-right"
                >
                  Оплачено
                </th><th class="px-5 py-2" />
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="p in d.participants"
                :key="p.id"
                class="border-b border-(--ui-border-muted) last:border-0"
              >
                <td class="px-5 py-2.5">
                  <p class="font-medium">
                    {{ p.name }}
                  </p><p class="text-xs text-(--ui-text-muted)">
                    {{ p.passportNote }}
                  </p>
                </td>
                <td class="px-3 py-2.5">
                  <UTooltip :text="`Шаг ${p.step + 1} из ${d.steps.length}${p.dealId ? ' — по этапу заявки' : ''}`">
                    <div class="w-44">
                      <div class="flex gap-0.5 mb-1">
                        <span
                          v-for="(_, i) in d.steps"
                          :key="i"
                          class="h-1.5 flex-1 rounded-full"
                          :class="i <= p.step ? (p.ready ? 'bg-ok' : 'bg-(--ui-primary)') : 'bg-(--ui-bg-accented)'"
                        />
                      </div>
                      <span
                        class="text-xs"
                        :class="p.ready ? 'text-ok-text' : ''"
                      >{{ p.stepLabel }}</span>
                    </div>
                  </UTooltip>
                </td>
                <td class="px-3 py-2.5">
                  {{ p.manager ?? '—' }}
                </td>
                <td
                  v-if="can('payments')"
                  class="px-3 py-2.5 text-right tabular"
                >
                  {{ formatMoney(p.paid) }}
                </td>
                <td class="px-5 py-2.5 text-right">
                  <UButton
                    v-if="p.dealId"
                    size="xs"
                    variant="ghost"
                    :to="`/deals/${p.dealId}`"
                    label="Открыть заявку →"
                  />
                  <UButton
                    v-else
                    size="xs"
                    variant="soft"
                    label="Создать заявку"
                    @click="dealFor = p; phone = ''"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <aside class="space-y-4">
        <div class="card p-5 space-y-3">
          <p class="font-semibold">
            Гид
          </p>
          <template v-if="d.guide">
            <p class="text-sm font-medium">
              {{ d.guide.name }}
            </p>
            <p class="text-xs text-(--ui-text-muted)">
              {{ d.guide.languages.join(', ') }} · {{ formatMoney(d.guide.rate) }} за выезд
            </p>
          </template>
          <p
            v-else
            class="text-sm text-warn-text"
          >
            Гид не назначен
          </p>
          <UButton
            size="sm"
            variant="soft"
            icon="i-lucide-search"
            :label="d.guide ? 'Сменить гида' : 'Подобрать гида'"
            @click="openGuides"
          />
        </div>
        <div class="card p-5 space-y-2">
          <p class="font-semibold">
            Автоматизация
          </p>
          <p class="text-sm flex items-center gap-2">
            <UIcon
              :name="d.flightTaskDone ? 'i-lucide-check-circle-2' : 'i-lucide-circle'"
              :class="d.flightTaskDone ? 'text-ok' : 'text-(--ui-text-dimmed)'"
            /> При {{ d.minSeats }} готовых — задача «Купить авиабилеты» (до {{ formatDate(d.flightDeadline, { dateOnly: true }) }})
          </p>
          <p class="text-sm flex items-center gap-2">
            <UIcon
              :name="d.hotelTaskDone ? 'i-lucide-check-circle-2' : 'i-lucide-circle'"
              :class="d.hotelTaskDone ? 'text-ok' : 'text-(--ui-text-dimmed)'"
            /> Когда готовы все — «Забронировать гостиницу»
          </p>
          <p class="text-xs text-(--ui-text-muted)">
            Полная оплата до {{ formatDate(d.payDeadline, { dateOnly: true }) }} · брифинг {{ formatDate(d.briefingAt, { dateOnly: true }) }}
          </p>
        </div>
        <div class="card p-5">
          <p class="font-semibold mb-2">
            Задачи выезда
          </p>
          <ul class="space-y-1.5">
            <li
              v-for="tk in d.tasks"
              :key="tk.id"
            >
              <button
                class="flex items-center gap-2 text-sm text-left hover:text-(--ui-primary)"
                @click="taskId = tk.id"
              >
                <TaskStatusIcon :status="tk.status" />{{ tk.title }}
              </button>
            </li>
          </ul>
          <p
            v-if="!d.tasks.length"
            class="text-sm text-(--ui-text-muted)"
          >
            Задач нет
          </p>
        </div>
      </aside>
    </div>

    <USlideover
      v-model:open="guideOpen"
      title="Подбор гида"
      :description="`${d.dates} · языки маршрута и занятость`"
    >
      <template #body>
        <ul class="space-y-3">
          <li
            v-for="g in cands"
            :key="g.id"
            class="rounded-lg border border-(--ui-border) p-3"
            :class="g.fit === 'Недоступен' && 'opacity-60'"
          >
            <div class="flex items-center justify-between gap-2">
              <p class="font-medium">
                {{ g.fullName }}
              </p>
              <UBadge
                :color="FIT_COLOR[g.fit]"
                variant="subtle"
                :label="g.fit"
              />
            </div>
            <p class="text-xs text-(--ui-text-muted)">
              {{ g.languages.join(', ') }} · опыт {{ g.experienceYears }} лет · ★ {{ g.rating ?? '—' }} · {{ formatMoney(g.rate) }}
            </p>
            <p class="text-xs mt-1">
              {{ g.reasons.join(', ') }}
            </p>
            <UButton
              v-if="!g.current && g.fit !== 'Недоступен'"
              class="mt-2"
              size="xs"
              label="Назначить"
              @click="setGuide(g.id)"
            />
            <UButton
              v-else-if="g.current"
              class="mt-2"
              size="xs"
              color="error"
              variant="ghost"
              label="Снять с выезда"
              @click="setGuide(null)"
            />
          </li>
        </ul>
      </template>
    </USlideover>

    <UModal
      v-model:open="addOpen"
      title="Новый участник"
      description="Без заявки — например, если бронь оформлена вне системы. Заявку можно создать позже."
    >
      <template #body>
        <form
          class="space-y-4"
          @submit.prevent="addParticipant"
        >
          <UFormField label="ФИО">
            <UInput
              v-model="add.name"
              class="w-full"
              autofocus
            />
          </UFormField>
          <UFormField label="Паспорт (заметка)">
            <UInput
              v-model="add.passportNote"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Оплачено, ₸">
            <UInputNumber
              v-model="add.paid"
              :min="0"
              :step="10000"
              class="w-full"
            />
          </UFormField>
          <div class="flex justify-end">
            <UButton
              type="submit"
              label="Добавить"
            />
          </div>
        </form>
      </template>
    </UModal>
    <UModal
      :open="!!dealFor"
      :title="`Заявка для: ${dealFor?.name}`"
      @update:open="v => !v && (dealFor = null)"
    >
      <template #body>
        <form
          class="space-y-4"
          @submit.prevent="createDeal"
        >
          <UFormField label="Телефон клиента">
            <UInput
              v-model="phone"
              placeholder="+7 701 000 00 00"
              class="w-full"
              autofocus
            />
          </UFormField>
          <div class="flex justify-end">
            <UButton
              type="submit"
              label="Создать заявку"
            />
          </div>
        </form>
      </template>
    </UModal>
    <TaskSlideover
      :task-id="taskId"
      @close="taskId = null"
      @changed="refresh()"
    />
  </AppPage>
</template>
