<script setup lang="ts">
useHead({ title: 'Мой день — Tourflow' })
const { me } = useMe()
const { can } = usePermissions()
const { data, status } = await useFetch('/api/dashboard', { lazy: true })

const today = computed(() => {
  const s = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Almaty' }).format(new Date())
  return s.charAt(0).toUpperCase() + s.slice(1)
})
const hello = computed(() => {
  const h = Number(new Intl.DateTimeFormat('ru-RU', { hour: 'numeric', hour12: false, timeZone: 'Asia/Almaty' }).format(new Date()))
  return h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер'
})

const EVENT_ICONS: Record<string, string> = { meeting: 'i-lucide-users', call: 'i-lucide-phone', visa: 'i-lucide-stamp', flight: 'i-lucide-plane', pay: 'i-lucide-wallet', task: 'i-lucide-check-square', briefing: 'i-lucide-megaphone' }
const PRIO: Record<string, string> = { HIGH: 'bg-bad', MEDIUM: 'bg-warn', LOW: 'bg-(--ui-border)' }
</script>

<template>
  <AppPage
    id="home"
    :title="`${hello}, ${me?.user.name ?? ''}`"
    :subtitle="today"
  >
    <div
      v-if="status === 'pending' && !data"
      class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <div
        v-for="i in 4"
        :key="i"
        class="skeleton h-24"
      />
    </div>
    <template v-else-if="data">
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          v-if="can('inbox')"
          :index="0"
          label="Ждут ответа"
          :value="data.focus.waiting"
          icon="i-lucide-message-circle"
          :tone="data.focus.waiting ? 'primary' : 'neutral'"
          to="/inbox?filter=new"
        />
        <StatCard
          :index="1"
          label="Задачи на сегодня"
          :value="data.focus.tasksToday"
          :hint="data.focus.overdue ? `просрочено: ${data.focus.overdue}` : 'просроченных нет'"
          icon="i-lucide-check-square"
          :tone="data.focus.overdue ? 'error' : 'neutral'"
          to="/tasks?quick=today"
        />
        <StatCard
          v-if="can('payments')"
          :index="2"
          label="Оплаты на неделе"
          :value="data.focus.paymentsWeek"
          hint="доплаты клиентов и операторам"
          icon="i-lucide-wallet"
          :tone="data.focus.paymentsWeek ? 'warning' : 'neutral'"
          to="#payments"
        />
        <StatCard
          :index="3"
          label="Новые заявки"
          :value="data.focus.newDeals"
          hint="на первом этапе"
          icon="i-lucide-sparkles"
          :tone="data.focus.newDeals ? 'success' : 'neutral'"
          to="/deals"
        />
      </div>

      <div class="grid gap-6 xl:grid-cols-2">
        <section class="card">
          <header class="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 class="font-semibold text-[15px]">
              Мои задачи на сегодня
            </h2>
            <UButton
              to="/tasks"
              size="xs"
              variant="ghost"
              label="Все задачи"
              trailing-icon="i-lucide-arrow-right"
            />
          </header>
          <EmptyState
            v-if="!data.tasks.length"
            icon="i-lucide-party-popper"
            text="На сегодня задач нет — можно заняться новыми заявками."
            compact
          />
          <ul v-else>
            <li
              v-for="t in data.tasks"
              :key="t.id"
            >
              <NuxtLink
                :to="`/tasks?task=${t.id}`"
                class="flex items-center gap-3 px-5 py-2.5 hover:bg-(--ui-bg-muted)"
              >
                <span
                  class="size-2 rounded-full shrink-0"
                  :class="PRIO[t.priority]"
                />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm">{{ t.title }}</span>
                  <span
                    v-if="t.deal"
                    class="block truncate text-xs text-(--ui-text-muted)"
                  >№{{ t.deal.number }} · {{ t.deal.client }}</span>
                </span>
                <UBadge
                  v-if="t.isSystem"
                  size="sm"
                  variant="subtle"
                  class="bg-sys-bg text-sys-text"
                  label="Системная"
                />
                <span
                  class="text-xs tabular"
                  :class="t.dueAt && new Date(t.dueAt) < startOfAlmatyDay() ? 'text-bad-text font-medium' : 'text-(--ui-text-muted)'"
                >{{ relativeDay(t.dueAt) }}</span>
              </NuxtLink>
            </li>
          </ul>
        </section>

        <section
          v-if="can('inbox')"
          class="card"
        >
          <header class="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 class="font-semibold text-[15px]">
              Ждут ответа
            </h2>
            <UButton
              to="/inbox"
              size="xs"
              variant="ghost"
              label="Сообщения"
              trailing-icon="i-lucide-arrow-right"
            />
          </header>
          <EmptyState
            v-if="!data.waiting.length"
            icon="i-lucide-check-check"
            text="Все клиенты получили ответ."
            compact
          />
          <ul v-else>
            <li
              v-for="c in data.waiting"
              :key="c.id"
            >
              <NuxtLink
                :to="`/inbox?c=${c.id}`"
                class="flex items-center gap-3 px-5 py-2.5 hover:bg-(--ui-bg-muted)"
              >
                <UAvatar
                  :text="initials(c.name)"
                  size="sm"
                />
                <span class="min-w-0 flex-1">
                  <span class="flex items-center gap-2">
                    <span class="font-medium text-sm truncate">{{ c.name }}</span>
                    <ChannelBadge :channel="c.channel" />
                  </span>
                  <span class="block truncate text-xs text-(--ui-text-muted)">{{ c.text }}</span>
                </span>
                <span class="text-xs text-(--ui-text-muted) tabular">{{ formatTime(c.at) }}</span>
              </NuxtLink>
            </li>
          </ul>
        </section>

        <section class="card">
          <header class="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 class="font-semibold text-[15px]">
              Сегодня в календаре
            </h2>
            <UButton
              to="/calendar"
              size="xs"
              variant="ghost"
              label="Календарь"
              trailing-icon="i-lucide-arrow-right"
            />
          </header>
          <EmptyState
            v-if="!data.events.length"
            icon="i-lucide-calendar-check"
            text="Встреч и записей на сегодня нет."
            compact
          />
          <ul v-else>
            <li
              v-for="e in data.events"
              :key="e.id"
              class="flex items-center gap-3 px-5 py-2.5"
            >
              <span class="text-sm font-semibold tabular w-12">{{ formatTime(e.startAt) }}</span>
              <UIcon
                :name="EVENT_ICONS[e.type] || 'i-lucide-calendar'"
                class="size-4 text-(--ui-text-muted)"
              />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm">{{ e.title }}</span>
                <span class="block truncate text-xs text-(--ui-text-muted)">{{ [e.place, e.who].filter(Boolean).join(' · ') }}</span>
              </span>
              <UButton
                v-if="e.deal"
                :to="`/deals/${e.deal.id}`"
                size="xs"
                variant="ghost"
                :label="`№${e.deal.number}`"
              />
            </li>
          </ul>
        </section>

        <section
          id="payments"
          class="card"
        >
          <header class="px-5 pt-5 pb-3">
            <h2 class="font-semibold text-[15px]">
              Оплаты и вылеты на неделе
            </h2>
          </header>
          <EmptyState
            v-if="!data.clientPayments.length && !data.operatorPayments.length && !data.departures.length"
            icon="i-lucide-calendar-clock"
            text="Ближайших оплат и вылетов нет."
            compact
          />
          <ul class="pb-2">
            <li
              v-for="p in data.clientPayments"
              :key="`c${p.dealId}`"
            >
              <NuxtLink
                :to="`/deals/${p.dealId}`"
                class="flex items-center gap-3 px-5 py-2 hover:bg-(--ui-bg-muted)"
              >
                <UIcon
                  name="i-lucide-arrow-down-left"
                  class="size-4 text-ok"
                />
                <span class="min-w-0 flex-1 text-sm truncate">Доплата · {{ p.client }} <span class="text-(--ui-text-muted)">· {{ p.title }}</span></span>
                <span class="text-sm tabular font-medium">{{ formatMoney(p.debt) }}</span>
                <span class="text-xs text-(--ui-text-muted) w-16 text-right">до {{ formatDate(p.deadline, { dateOnly: true }).slice(0, 5) }}</span>
              </NuxtLink>
            </li>
            <li
              v-for="p in data.operatorPayments"
              :key="`o${p.dealId}`"
            >
              <NuxtLink
                :to="`/deals/${p.dealId}`"
                class="flex items-center gap-3 px-5 py-2 hover:bg-(--ui-bg-muted)"
              >
                <UIcon
                  name="i-lucide-arrow-up-right"
                  class="size-4 text-warn"
                />
                <span class="min-w-0 flex-1 text-sm truncate">{{ p.operator }} · {{ p.bookingNo }} <span class="text-(--ui-text-muted)">· {{ p.client }}</span></span>
                <span class="text-sm tabular font-medium">{{ formatMoney(p.debt) }}</span>
                <span class="text-xs text-(--ui-text-muted) w-16 text-right">до {{ formatDate(p.deadline, { dateOnly: true }).slice(0, 5) }}</span>
              </NuxtLink>
            </li>
            <li
              v-for="d in data.departures"
              :key="`d${d.id}`"
            >
              <NuxtLink
                :to="`/departures/${d.id}`"
                class="flex items-center gap-3 px-5 py-2 hover:bg-(--ui-bg-muted)"
              >
                <UIcon
                  name="i-lucide-plane-takeoff"
                  class="size-4 text-(--ui-primary)"
                />
                <span class="min-w-0 flex-1 text-sm truncate">Вылет · {{ d.name }}</span>
                <span class="text-xs text-(--ui-text-muted)">{{ d.participants }} / {{ d.maxSeats }}</span>
                <span class="text-xs text-(--ui-text-muted) w-24 text-right">{{ formatRange(d.startDate, d.endDate) }}</span>
              </NuxtLink>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </AppPage>
</template>
