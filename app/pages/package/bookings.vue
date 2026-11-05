<script setup lang="ts">
definePageMeta({ middleware: 'role', permission: 'package' })
useHead({ title: 'Брони у туроператоров — Tourflow' })
interface Row { id: string, number: string | null, status: 'REQUEST' | 'CONFIRMED' | 'PAID' | 'CANCELLED', operator: string, hotel: string, dates: { from: string, to: string }, deal: { id: string, number: number, client: string }, net: number, paid: number, debt: number, commission: number, paymentDeadline: string, cashGap: number, urgent: boolean }
const status = ref('active')
const operator = ref('all')
const { data: ops } = await useFetch<{ id: string, name: string }[]>('/api/operators', { default: () => [] })
const { data } = await useFetch<{ stats: { active: number, debt: number, payments7: number, commission: number }, bookings: Row[] }>('/api/bookings', { query: computed(() => ({ status: status.value, operator: operator.value === 'all' ? undefined : operator.value })) })
const ST = { REQUEST: { l: 'Запрос', c: 'neutral' }, CONFIRMED: { l: 'Подтверждена', c: 'primary' }, PAID: { l: 'Оплачена', c: 'success' }, CANCELLED: { l: 'Аннулирована', c: 'error' } } as const
</script>

<template>
  <AppPage
    title="Брони у туроператоров"
    subtitle="Реестр по срочности оплаты"
  >
    <div class="grid gap-4 grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Активные брони"
        :value="data?.stats.active ?? 0"
        icon="i-lucide-ticket"
      />
      <StatCard
        label="Долг операторам"
        :value="formatMoney(data?.stats.debt ?? 0)"
        icon="i-lucide-arrow-up-right"
        tone="warning"
      />
      <StatCard
        label="Оплатить в 7 дней"
        :value="formatMoney(data?.stats.payments7 ?? 0)"
        icon="i-lucide-alarm-clock"
        :tone="data?.stats.payments7 ? 'error' : 'neutral'"
      />
      <StatCard
        label="Комиссия"
        :value="formatMoney(data?.stats.commission ?? 0)"
        icon="i-lucide-percent"
        tone="success"
      />
    </div>
    <div class="flex flex-wrap gap-2">
      <UButton
        v-for="s in [{ v: 'active', l: 'Активные' }, { v: 'REQUEST', l: 'Запрос' }, { v: 'CONFIRMED', l: 'Подтверждены' }, { v: 'PAID', l: 'Оплачены' }, { v: 'CANCELLED', l: 'Аннулированы' }, { v: 'all', l: 'Все' }]"
        :key="s.v"
        size="sm"
        :variant="status === s.v ? 'soft' : 'ghost'"
        :color="status === s.v ? 'primary' : 'neutral'"
        :label="s.l"
        @click="status = s.v"
      />
      <USelect
        v-model="operator"
        size="sm"
        :items="[{ value: 'all', label: 'Все операторы' }, ...ops.map(o => ({ value: o.id, label: o.name }))]"
        class="w-48 ml-auto"
      />
    </div>
    <div class="card overflow-x-auto">
      <table class="w-full text-sm min-w-[900px]">
        <thead class="text-left text-xs text-(--ui-text-muted) border-b border-(--ui-border)">
          <tr>
            <th class="px-5 py-2.5 font-medium">
              Оплатить до
            </th><th class="px-3 py-2.5 font-medium">
              Бронь
            </th><th class="px-3 py-2.5 font-medium">
              Отель и даты
            </th><th class="px-3 py-2.5 font-medium">
              Заявка
            </th><th class="px-3 py-2.5 font-medium text-right">
              Нетто
            </th><th class="px-3 py-2.5 font-medium text-right">
              Долг
            </th><th class="px-5 py-2.5 font-medium">
              Статус
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="b in data?.bookings"
            :key="b.id"
            class="border-b border-(--ui-border-muted) last:border-0 hover:bg-(--ui-bg-muted) cursor-pointer"
            @click="navigateTo(`/deals/${b.deal.id}`)"
          >
            <td
              class="px-5 py-3 tabular"
              :class="b.urgent ? 'text-bad-text font-medium' : ''"
            >
              {{ formatDate(b.paymentDeadline, { dateOnly: true }) }}
            </td>
            <td class="px-3 py-3">
              {{ b.operator }}<p class="text-xs text-(--ui-text-muted)">
                {{ b.number ?? 'без номера' }}
              </p>
            </td>
            <td class="px-3 py-3">
              {{ b.hotel }}<p class="text-xs text-(--ui-text-muted)">
                {{ formatRange(b.dates.from, b.dates.to) }}
              </p>
            </td>
            <td class="px-3 py-3">
              №{{ b.deal.number }} · {{ b.deal.client }}<p
                v-if="b.cashGap"
                class="text-xs text-warn-text"
              >
                кассовый разрыв {{ formatMoney(b.cashGap) }}
              </p>
            </td>
            <td class="px-3 py-3 text-right tabular">
              {{ formatMoney(b.net) }}
            </td>
            <td
              class="px-3 py-3 text-right tabular"
              :class="b.debt ? 'text-bad-text' : ''"
            >
              {{ formatMoney(b.debt) }}
            </td>
            <td class="px-5 py-3">
              <UBadge
                :color="ST[b.status].c"
                variant="subtle"
                :label="ST[b.status].l"
              />
            </td>
          </tr>
        </tbody>
      </table>
      <EmptyState
        v-if="!data?.bookings.length"
        icon="i-lucide-ticket"
        text="Броней нет. Бронь создаётся в заявке после выбора варианта."
      />
    </div>
  </AppPage>
</template>
