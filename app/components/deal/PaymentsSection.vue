<script setup lang="ts">
import { PAYMENT_METHODS, PAYMENT_TYPES } from '#shared/domain/types'
import type { DealChanged, DealView } from '~/types/deal'

const props = defineProps<{ view: DealView, num: number }>()
const emit = defineEmits<{ changed: Parameters<DealChanged> }>()
const open = defineModel<boolean>('open', { default: true })
const m = computed(() => props.view.money!)
const pct = computed(() => (m.value.price ? Math.min(100, Math.round((m.value.paid / m.value.price) * 100)) : 0))
// Count-up and growing bar animation.
const paidSource = computed(() => m.value.paid)
const paidAnimated = useTransition(paidSource, { duration: 400 })
const done = computed(() => m.value.price > 0 && m.value.paid >= m.value.price)

const editPrice = ref(false)
const priceInput = ref(0)
async function savePrice() {
  const r = await mutate(() => api<{ advanced: null }>(`/api/deals/${props.view.deal.id}`, { method: 'PATCH', body: { price: priceInput.value } }), 'Стоимость сохранена')
  editPrice.value = false
  if (r) emit('changed', r)
}
async function saveDeadline(v: string) {
  const r = await mutate(() => api<{ advanced: null }>(`/api/deals/${props.view.deal.id}`, { method: 'PATCH', body: { fullPayDeadline: v || null } }))
  if (r) emit('changed', r)
}

const payOpen = ref(false)
const pay = reactive({ amount: 0, type: 'Предоплата', method: 'Kaspi', comment: '' })
function openPay() {
  const prepay = 100_000 * props.view.deal.people
  pay.amount = m.value.paid === 0 ? Math.min(prepay, m.value.debt || prepay) : m.value.debt
  pay.type = m.value.paid === 0 ? 'Предоплата' : pay.amount >= m.value.debt ? 'Полная оплата' : 'Доплата'
  pay.method = 'Kaspi'
  pay.comment = ''
  payOpen.value = true
}
async function savePay() {
  const r = await mutate(() => api<{ advanced: null }>(`/api/deals/${props.view.deal.id}/payments`, { method: 'POST', body: pay }), `Оплата ${formatMoney(pay.amount)} принята`)
  if (r) {
    payOpen.value = false
    emit('changed', r)
  }
}

const refundOpen = ref(false)
const refund = reactive({ kind: 'refund' as 'refund' | 'transfer' | 'replace', hold: 0, amount: 0, method: 'Перевод на счёт', comment: '', toDepartureId: undefined as string | undefined, replaceName: '' })
const { me } = useMe()
async function openRefund() {
  const company = await api<{ refundHoldPct: number }>('/api/settings/hold').catch(() => ({ refundHoldPct: 10 }))
  refund.hold = Math.round((m.value.paid * company.refundHoldPct) / 100)
  refund.amount = Math.max(0, m.value.paid - refund.hold)
  refundOpen.value = true
}
watch(() => refund.hold, h => refund.kind === 'refund' && (refund.amount = Math.max(0, m.value.paid - h)))
async function saveRefund() {
  const r = await mutate(() => api(`/api/deals/${props.view.deal.id}/refund`, { method: 'POST', body: refund }), refund.kind === 'refund' ? 'Возврат оформлен' : refund.kind === 'transfer' ? 'Перенос оформлен' : 'Замена записана')
  if (r) {
    refundOpen.value = false
    emit('changed')
  }
}
void me
</script>

<template>
  <StepSection
    id="pay"
    v-model:open="open"
    :num="num"
    title="Цена и оплаты"
    :done="done"
    :summary="`${formatMoney(m.price)} · оплачено ${pct}%${m.debt ? ` · долг ${formatMoney(m.debt)}` : ''}`"
  >
    <div class="grid gap-3 sm:grid-cols-4">
      <div>
        <p class="text-xs text-(--ui-text-muted)">
          Стоимость
        </p>
        <button
          v-if="!editPrice"
          class="text-lg font-semibold tabular hover:text-(--ui-primary)"
          title="Изменить стоимость"
          @click="editPrice = true; priceInput = m.price"
        >
          {{ formatMoney(m.price) }}
        </button>
        <form
          v-else
          class="flex gap-1"
          @submit.prevent="savePrice"
        >
          <UInputNumber
            v-model="priceInput"
            :min="0"
            :step="10000"
            size="sm"
            class="w-36"
          />
          <UButton
            type="submit"
            size="sm"
            icon="i-lucide-check"
            aria-label="Сохранить"
          />
        </form>
      </div>
      <div>
        <p class="text-xs text-(--ui-text-muted)">
          Оплачено
        </p><p class="text-lg font-semibold tabular text-ok-text">
          {{ formatMoney(paidAnimated) }}
        </p>
      </div>
      <div>
        <p class="text-xs text-(--ui-text-muted)">
          Долг
        </p><p
          class="text-lg font-semibold tabular"
          :class="m.debt ? 'text-bad-text' : ''"
        >
          {{ formatMoney(m.debt) }}
        </p>
      </div>
      <div>
        <p class="text-xs text-(--ui-text-muted)">
          Срок полной оплаты
        </p>
        <input
          type="date"
          class="text-sm bg-transparent border-b border-dashed border-(--ui-border) focus:outline-none focus:border-(--ui-primary)"
          :value="m.deadline?.slice(0, 10) ?? ''"
          aria-label="Срок полной оплаты"
          @change="saveDeadline(($event.target as HTMLInputElement).value)"
        >
      </div>
    </div>
    <div class="h-2 rounded-full bg-(--ui-bg-accented) mt-4 overflow-hidden">
      <div
        class="h-full rounded-full transition-[width] duration-500 ease-out"
        :class="pct >= 100 ? 'bg-ok' : 'bg-(--ui-primary)'"
        :style="{ width: `${pct}%` }"
      />
    </div>
    <table
      v-if="m.payments.length"
      class="w-full text-sm mt-4"
    >
      <tbody>
        <tr
          v-for="p in m.payments"
          :key="p.id"
          class="border-b border-(--ui-border-muted) last:border-0"
        >
          <td class="py-2 tabular text-(--ui-text-muted) w-28">
            {{ formatDate(p.paidAt) }}
          </td>
          <td class="py-2">
            {{ p.type }} · {{ p.method }}<span
              v-if="p.comment"
              class="text-(--ui-text-muted)"
            > · {{ p.comment }}</span>
          </td>
          <td
            class="py-2 text-right tabular font-medium"
            :class="p.amount < 0 ? 'text-bad-text' : ''"
          >
            {{ formatMoney(p.amount, { sign: true }) }}
          </td>
        </tr>
      </tbody>
    </table>
    <div class="flex gap-2 mt-4">
      <UButton
        icon="i-lucide-wallet"
        label="Принять оплату"
        @click="openPay"
      />
      <UButton
        icon="i-lucide-undo-2"
        color="neutral"
        variant="outline"
        label="Возврат / перенос"
        :disabled="!m.paid"
        @click="openRefund"
      />
    </div>

    <UModal
      v-model:open="payOpen"
      title="Принять оплату"
      :description="`Долг: ${formatMoney(m.debt)}`"
    >
      <template #body>
        <form
          class="space-y-4"
          @submit.prevent="savePay"
        >
          <UFormField label="Сумма, ₸">
            <UInputNumber
              v-model="pay.amount"
              :min="1"
              :step="10000"
              class="w-full"
              autofocus
            />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Тип">
              <USelect
                v-model="pay.type"
                :items="PAYMENT_TYPES.filter(t => t !== 'Возврат').map(t => ({ value: t as string, label: t as string }))"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Способ">
              <USelect
                v-model="pay.method"
                :items="PAYMENT_METHODS.map(t => ({ value: t as string, label: t as string }))"
                class="w-full"
              />
            </UFormField>
          </div>
          <UFormField label="Комментарий">
            <UInput
              v-model="pay.comment"
              class="w-full"
            />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              label="Отмена"
              @click="payOpen = false"
            />
            <UButton
              type="submit"
              label="Принять оплату"
            />
          </div>
        </form>
      </template>
    </UModal>

    <UModal
      v-model:open="refundOpen"
      title="Возврат / перенос"
      :description="`Оплачено клиентом: ${formatMoney(m.paid)}`"
    >
      <template #body>
        <form
          class="space-y-4"
          @submit.prevent="saveRefund"
        >
          <URadioGroup
            v-model="refund.kind"
            orientation="horizontal"
            :items="[{ value: 'refund', label: 'Возврат' }, { value: 'transfer', label: 'Перенос на другой выезд' }, { value: 'replace', label: 'Замена туриста' }]"
          />
          <UFormField
            label="Удержание по правилу агентства, ₸"
            hint="можно изменить"
          >
            <UInputNumber
              v-model="refund.hold"
              :min="0"
              :step="5000"
              class="w-full"
            />
          </UFormField>
          <template v-if="refund.kind === 'refund'">
            <div class="grid grid-cols-2 gap-3">
              <UFormField label="Сумма возврата, ₸">
                <UInputNumber
                  v-model="refund.amount"
                  :min="0"
                  :step="5000"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Способ">
                <USelect
                  v-model="refund.method"
                  :items="PAYMENT_METHODS.map(t => ({ value: t as string, label: t as string }))"
                  class="w-full"
                />
              </UFormField>
            </div>
          </template>
          <UFormField
            v-else-if="refund.kind === 'transfer'"
            label="Новый выезд"
          >
            <USelect
              v-model="refund.toDepartureId"
              :items="view.departures.filter(x => x.id !== view.departure?.id).map(x => ({ value: x.id, label: x.label }))"
              placeholder="Выберите выезд"
              class="w-full"
            />
          </UFormField>
          <UFormField
            v-else
            label="Новый турист (ФИО)"
          >
            <UInput
              v-model="refund.replaceName"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Комментарий">
            <UInput
              v-model="refund.comment"
              class="w-full"
              placeholder="Например: отказ в визе"
            />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              label="Отмена"
              @click="refundOpen = false"
            />
            <UButton
              type="submit"
              :color="refund.kind === 'refund' ? 'error' : 'primary'"
              :label="refund.kind === 'refund' ? `Вернуть ${formatMoney(refund.amount)}` : 'Оформить'"
            />
          </div>
        </form>
      </template>
    </UModal>
  </StepSection>
</template>
