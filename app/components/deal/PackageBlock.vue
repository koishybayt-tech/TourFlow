<script setup lang="ts">
import type { DealChanged, DealView } from '~/types/deal'

const props = defineProps<{ view: DealView }>()
const emit = defineEmits<{ changed: Parameters<DealChanged>, upload: [type: string] }>()
const { can } = usePermissions()
const d = computed(() => props.view.deal)
const { data: operators } = useFetch<{ id: string, name: string, commissionPct: number, paymentTerms: string }[]>('/api/operators', { default: () => [] })

type Offer = DealView['offers'][number]
const STATUS: Record<Offer['status'], { label: string, color: 'neutral' | 'primary' | 'success' }> = { DRAFT: { label: 'Черновик', color: 'neutral' }, SENT: { label: 'Отправлен', color: 'primary' }, CHOSEN: { label: 'Выбран клиентом', color: 'success' }, REJECTED: { label: 'Не выбран', color: 'neutral' } }
const nightsOf = (o: { fromDate: string, toDate: string }) => Math.round((+new Date(o.toDate) - +new Date(o.fromDate)) / 86_400_000)

// ── Offer form ──
const formOpen = ref(false)
const editId = ref<string | null>(null)
const form = reactive({ operatorId: '', hotel: '', stars: 5, resort: '', fromDate: '', toDate: '', meal: 'Всё включено', room: 'Standard', flight: true, transfer: true, insurance: true, net: 0, price: 0, note: '', source: 'manual' as 'manual' | 'import' })
const markupPct = computed(() => (form.net ? Math.round(((form.price - form.net) / form.net) * 1000) / 10 : 0))
function openForm(o?: Partial<Omit<Offer, 'source'>> & { source?: string | null }) {
  editId.value = o?.id ?? null
  Object.assign(form, {
    operatorId: o?.operatorId ?? operators.value[0]?.id ?? '', hotel: o?.hotel ?? '', stars: o?.stars ?? 5, resort: o?.resort ?? '',
    fromDate: o?.fromDate?.slice(0, 10) ?? '', toDate: o?.toDate?.slice(0, 10) ?? '', meal: o?.meal ?? 'Всё включено', room: o?.room ?? 'Standard',
    flight: o?.flight ?? true, transfer: o?.transfer ?? true, insurance: o?.insurance ?? true, net: o?.net ?? 0, price: o?.price ?? 0, note: o?.note ?? '', source: o?.source === 'import' ? 'import' : 'manual',
  })
  formOpen.value = true
}
function applyCommission() {
  const op = operators.value.find(o => o.id === form.operatorId)
  if (op && form.price) form.net = Math.round(form.price * (1 - op.commissionPct / 100))
  else if (op && form.net) form.price = Math.round(form.net / (1 - op.commissionPct / 100) / 1000) * 1000
}
async function saveOffer() {
  const r = await mutate(() => editId.value ? api(`/api/offers/${editId.value}`, { method: 'PATCH', body: form }) : api(`/api/deals/${d.value.id}/offers`, { method: 'POST', body: form }), editId.value ? 'Вариант сохранён' : 'Вариант добавлен')
  if (r) {
    formOpen.value = false
    emit('changed')
  }
}
async function removeOffer(id: string) {
  if (await mutate(() => api(`/api/offers/${id}`, { method: 'DELETE' }), 'Вариант удалён')) emit('changed')
}
async function choose(o: Offer) {
  const r = await mutate(() => api<{ advanced: null }>(`/api/offers/${o.id}/choose`, { method: 'POST' }), `Клиент выбрал: ${o.hotel}`)
  if (r) emit('changed', r)
}

// ── Import ──
const importOpen = ref(false)
const importText = ref('')
const importing = ref(false)
async function runImport(file?: File) {
  importing.value = true
  let r: { draft: Partial<Record<string, unknown>> | null, message: string | null } | undefined
  if (file) {
    const fd = new FormData()
    fd.append('file', file)
    r = await mutate(() => $fetch<{ draft: Record<string, unknown> | null, message: string | null }>(`/api/deals/${d.value.id}/offers-import`, { method: 'POST', body: fd }))
  }
  else {
    r = await mutate(() => api<{ draft: Record<string, unknown> | null, message: string | null }>(`/api/deals/${d.value.id}/offers-import`, { method: 'POST', body: { text: importText.value } }))
  }
  importing.value = false
  if (!r) return
  if (r.message) useNotify().info(r.message)
  const x = (r.draft ?? {}) as Record<string, string | number | boolean | null>
  const op = operators.value.find(o => x.operator && o.name.toLowerCase() === String(x.operator).toLowerCase())
  importOpen.value = false
  openForm({ source: 'import', operatorId: op?.id, hotel: (x.hotel as string) ?? '', stars: (x.stars as number) ?? 5, resort: (x.resort as string) ?? '', fromDate: (x.fromDate as string) ?? '', toDate: (x.toDate as string) ?? '', meal: (x.meal as string) ?? 'Всё включено', room: (x.room as string) ?? 'Standard', flight: (x.flight as boolean) ?? true, transfer: (x.transfer as boolean) ?? true, insurance: (x.insurance as boolean) ?? true, price: (x.price as number) ?? 0, net: 0 })
  nextTick(applyCommission)
}

// ── Send selection ──
const sendOpen = ref(false)
const sendIds = ref<string[]>([])
const sendText = ref('')
function openSend() {
  const offers = props.view.offers.filter(o => o.status !== 'REJECTED')
  sendIds.value = offers.map(o => o.id)
  const name = props.view.client.name.split(' ')[0]
  sendText.value = `${name}, добрый день! Подобрала варианты:\n\n${offers.map((o, i) => `${i + 1}. ${o.hotel} ${'★'.repeat(o.stars)} — ${o.resort}\n   ${formatRange(o.fromDate, o.toDate)}, ${nightsOf(o)} ночей · ${o.meal} · ${o.room}\n   ${[o.flight && 'перелёт', o.transfer && 'трансфер', o.insurance && 'страховка'].filter(Boolean).join(', ')}\n   ${formatMoney(o.price)} за всех (${formatMoney(Math.round(o.price / d.value.people))}/чел.)`).join('\n\n')}\n\nЦены актуальны сегодня. Какой вариант нравится?`
  sendOpen.value = true
}
async function sendSelection() {
  const r = await mutate(() => api<{ advanced: null }>(`/api/deals/${d.value.id}/offers-send`, { method: 'POST', body: { text: sendText.value, offerIds: sendIds.value } }), 'Подборка отправлена клиенту')
  if (r) {
    sendOpen.value = false
    emit('changed', r)
  }
}

// ── Booking ──
const booking = computed(() => props.view.bookings.find(b => b.status !== 'CANCELLED') ?? null)
const chosen = computed(() => props.view.offers.find(o => o.status === 'CHOSEN') ?? null)
const travelersReady = computed(() => props.view.travelers.length >= d.value.people && props.view.travelers.every(t => t.hasPassport))
const clientPaid = computed(() => props.view.money?.paid ?? 0)
const operatorLink = computed(() => (chosen.value?.externalRef ? `https://example-operator.kz/booking/${chosen.value.externalRef}` : undefined))
const cashGap = computed(() => (booking.value && booking.value.net !== null && booking.value.status !== 'PAID' ? Math.max(0, booking.value.net - clientPaid.value) : 0))
const bookOpen = ref(false)
const bk = reactive({ offerId: '', number: '', paymentDeadline: '', comment: '' })
function openBooking() {
  const o = chosen.value ?? props.view.offers[0]
  bk.offerId = o?.id ?? ''
  bk.number = ''
  bk.comment = ''
  bk.paymentDeadline = isoDay(new Date(Date.now() + 3 * 86_400_000))
  bookOpen.value = true
}
async function createBooking() {
  const r = await mutate(() => api<{ advanced: null }>(`/api/deals/${d.value.id}/bookings`, { method: 'POST', body: bk }), 'Бронь создана')
  if (r) {
    bookOpen.value = false
    emit('changed', r)
  }
}
const confirmNo = ref('')
async function patchBooking(body: Record<string, unknown>, msg: string) {
  const r = await mutate(() => api<{ advanced: null }>(`/api/bookings/${booking.value!.id}`, { method: 'PATCH', body }), msg)
  if (r) emit('changed', r)
}
const payOpOpen = ref(false)
const payOp = reactive({ amount: 0, method: 'Перевод на счёт' })
async function payOperator() {
  const r = await mutate(() => api<{ advanced: null }>(`/api/bookings/${booking.value!.id}/payments`, { method: 'POST', body: payOp }), 'Оплата оператору проведена')
  if (r) {
    payOpOpen.value = false
    emit('changed', r)
  }
}
const cancelOpen = ref(false)
const cancel = reactive({ reason: '', penalty: 0 })
const BK_STATUS = { REQUEST: { l: 'Запрос', c: 'neutral' }, CONFIRMED: { l: 'Подтверждена', c: 'primary' }, PAID: { l: 'Оплачена', c: 'success' }, CANCELLED: { l: 'Аннулирована', c: 'error' } } as const
const opDocs = computed(() => props.view.documents.filter(x => ['Ваучер', 'Авиабилет', 'Страховой полис'].includes(x.type)))
</script>

<template>
  <div class="space-y-6">
    <!-- Offers -->
    <div>
      <div class="flex flex-wrap items-center gap-2 mb-3">
        <p class="text-sm font-medium mr-auto">
          Подборка · {{ view.offers.length }}
        </p>
        <UButton
          size="sm"
          icon="i-lucide-search"
          variant="soft"
          label="Найти туры"
          :to="`/package/search?deal=${d.id}`"
        />
        <UButton
          size="sm"
          icon="i-lucide-clipboard-paste"
          variant="ghost"
          label="Импорт варианта"
          @click="importOpen = true; importText = ''"
        />
        <UButton
          size="sm"
          icon="i-lucide-plus"
          variant="ghost"
          label="Вариант"
          @click="openForm()"
        />
        <UButton
          v-if="view.offers.some(o => o.status !== 'REJECTED')"
          size="sm"
          icon="i-lucide-send"
          :label="`Отправить подборку (${view.offers.filter(o => o.status !== 'REJECTED').length})`"
          @click="openSend"
        />
      </div>
      <div
        v-if="view.offers.length"
        class="grid gap-3 lg:grid-cols-2"
      >
        <div
          v-for="o in view.offers"
          :key="o.id"
          class="rounded-xl border p-4 space-y-2 transition-colors"
          :class="o.status === 'CHOSEN' ? 'border-ok bg-ok-bg/40' : o.status === 'REJECTED' ? 'border-(--ui-border) opacity-60' : 'border-(--ui-border)'"
        >
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="font-semibold">
                {{ o.hotel }} <span class="text-warn">{{ '★'.repeat(o.stars) }}</span>
              </p>
              <p class="text-xs text-(--ui-text-muted)">
                {{ o.resort }} · {{ o.operator }}
              </p>
            </div>
            <UBadge
              :color="STATUS[o.status].color"
              variant="subtle"
              :label="STATUS[o.status].label"
            />
          </div>
          <p class="text-sm">
            {{ formatRange(o.fromDate, o.toDate) }} · {{ nightsOf(o) }} {{ plural(nightsOf(o), 'ночь', 'ночи', 'ночей') }} · {{ o.meal }} · {{ o.room }}
          </p>
          <div class="flex flex-wrap gap-1">
            <UBadge
              v-for="inc in [o.flight && 'Перелёт', o.transfer && 'Трансфер', o.insurance && 'Страховка'].filter(Boolean)"
              :key="String(inc)"
              size="sm"
              variant="soft"
              color="neutral"
              :label="String(inc)"
            />
          </div>
          <div class="grid grid-cols-3 gap-2 text-sm pt-1">
            <div v-if="o.net !== null">
              <p class="text-[11px] text-(--ui-text-muted)">
                Нетто
              </p><p class="tabular">
                {{ formatMoney(o.net) }}
              </p>
            </div>
            <div v-if="o.net !== null">
              <p class="text-[11px] text-(--ui-text-muted)">
                Комиссия
              </p><p class="tabular text-ok-text">
                {{ formatMoney(o.price - o.net) }}
              </p>
            </div>
            <div>
              <p class="text-[11px] text-(--ui-text-muted)">
                Клиенту · {{ formatMoney(Math.round(o.price / d.people)) }}/чел.
              </p><p class="tabular font-semibold">
                {{ formatMoney(o.price) }}
              </p>
            </div>
          </div>
          <p
            v-if="o.note"
            class="text-xs text-(--ui-text-muted)"
          >
            {{ o.note }}
          </p>
          <div class="flex gap-1 pt-1">
            <UButton
              v-if="o.status !== 'CHOSEN'"
              size="xs"
              color="success"
              variant="soft"
              icon="i-lucide-check"
              label="Клиент выбрал"
              @click="choose(o)"
            />
            <UButton
              size="xs"
              variant="ghost"
              icon="i-lucide-pencil"
              aria-label="Изменить вариант"
              @click="openForm(o)"
            />
            <UButton
              size="xs"
              variant="ghost"
              color="error"
              icon="i-lucide-trash-2"
              aria-label="Удалить вариант"
              @click="removeOffer(o.id)"
            />
          </div>
        </div>
      </div>
      <p
        v-else
        class="text-sm text-(--ui-text-muted)"
      >
        Найдите туры у операторов или импортируйте вариант из ссылки, текста или скриншота.
      </p>
    </div>

    <!-- Booking -->
    <div
      v-if="view.offers.length"
      class="rounded-xl border border-(--ui-border) p-4 space-y-3"
    >
      <div class="flex items-center justify-between gap-2">
        <p class="text-sm font-medium">
          Бронь у туроператора
        </p>
        <UBadge
          v-if="booking"
          :color="BK_STATUS[booking.status].c"
          variant="subtle"
          :label="BK_STATUS[booking.status].l"
        />
      </div>
      <template v-if="!booking">
        <p class="text-xs text-(--ui-text-muted)">
          Порядок по рекомендации эксперта: туристы с паспортами → предоплата → бронь.
          <span :class="travelersReady ? 'text-ok-text' : 'text-warn-text'">Туристы {{ travelersReady ? 'внесены' : 'не внесены' }}</span> ·
          <span :class="clientPaid > 0 ? 'text-ok-text' : 'text-warn-text'">предоплата {{ clientPaid > 0 ? 'получена' : 'не получена' }}</span>
        </p>
        <UButton
          size="sm"
          icon="i-lucide-ticket"
          label="Создать бронь у оператора"
          @click="openBooking"
        />
      </template>
      <template v-else>
        <dl class="grid gap-2 sm:grid-cols-4 text-sm">
          <div>
            <dt class="text-xs text-(--ui-text-muted)">
              Оператор
            </dt><dd>{{ booking.operator }}</dd>
          </div>
          <div>
            <dt class="text-xs text-(--ui-text-muted)">
              Номер брони
            </dt><dd>{{ booking.number ?? '—' }}</dd>
          </div>
          <div>
            <dt class="text-xs text-(--ui-text-muted)">
              Оплатить оператору до
            </dt><dd :class="new Date(booking.paymentDeadline) < new Date(Date.now() + 3 * 86400000) && booking.status !== 'PAID' ? 'text-bad-text font-medium' : ''">
              {{ formatDate(booking.paymentDeadline, { dateOnly: true }) }}
            </dd>
          </div>
          <div v-if="booking.net !== null">
            <dt class="text-xs text-(--ui-text-muted)">
              Оплачено / нетто
            </dt><dd class="tabular">
              {{ formatMoney(booking.paid) }} / {{ formatMoney(booking.net) }}
            </dd>
          </div>
        </dl>
        <UAlert
          v-if="cashGap > 0 && can('payments')"
          color="warning"
          variant="subtle"
          icon="i-lucide-alert-triangle"
          :title="`Кассовый разрыв: клиент оплатил ${formatMoney(clientPaid)}, оператору нужно ${formatMoney(booking.net ?? 0)}`"
          :description="`Не хватает ${formatMoney(cashGap)} к ${formatDate(booking.paymentDeadline, { dateOnly: true })}. Попросите доплату у клиента.`"
        />
        <div class="flex flex-wrap items-center gap-2">
          <template v-if="booking.status === 'REQUEST'">
            <UInput
              v-model="confirmNo"
              size="sm"
              placeholder="Номер брони у оператора"
              class="w-56"
            />
            <UButton
              size="sm"
              :disabled="!confirmNo.trim()"
              label="Подтвердить"
              @click="patchBooking({ status: 'CONFIRMED', number: confirmNo }, 'Бронь подтверждена')"
            />
          </template>
          <UButton
            v-if="booking.status !== 'PAID' && can('payments')"
            size="sm"
            variant="soft"
            icon="i-lucide-wallet"
            label="Оплатить оператору"
            @click="payOp.amount = Math.max(0, (booking.net ?? 0) - (booking.paid ?? 0)); payOpOpen = true"
          />
          <UButton
            v-if="chosen?.externalRef"
            size="sm"
            variant="ghost"
            color="neutral"
            label="Открыть у оператора ↗"
            :to="operatorLink"
            target="_blank"
          />
          <UButton
            size="sm"
            variant="ghost"
            color="error"
            label="Аннулировать"
            @click="cancelOpen = true; cancel.reason = ''; cancel.penalty = 0"
          />
        </div>
        <ul
          v-if="booking.payments.length"
          class="text-xs text-(--ui-text-muted) space-y-0.5"
        >
          <li
            v-for="p in booking.payments"
            :key="p.id"
          >
            {{ formatDate(p.paidAt) }} · оплата оператору {{ formatMoney(p.amount) }} · {{ p.method }}
          </li>
        </ul>
      </template>
      <p
        v-for="b in view.bookings.filter(x => x.status === 'CANCELLED')"
        :key="b.id"
        class="text-xs text-(--ui-text-muted)"
      >
        Аннулирована бронь {{ b.number ?? '' }} у {{ b.operator }}: {{ b.cancelReason }}{{ b.penalty ? `, штраф ${formatMoney(b.penalty)}` : '' }}
      </p>
    </div>

    <!-- Operator documents -->
    <div v-if="booking">
      <p class="text-sm font-medium mb-2">
        Документы оператора
      </p>
      <div class="flex flex-wrap gap-2">
        <div
          v-for="t in ['Ваучер', 'Авиабилет', 'Страховой полис']"
          :key="t"
          class="rounded-lg border border-(--ui-border) px-3 py-2 text-sm flex items-center gap-2"
        >
          <UIcon
            :name="opDocs.some(x => x.type === t) ? 'i-lucide-check-circle-2' : 'i-lucide-circle'"
            :class="opDocs.some(x => x.type === t) ? 'text-ok' : 'text-(--ui-text-dimmed)'"
          />{{ t }}
          <UButton
            v-if="!opDocs.some(x => x.type === t)"
            size="xs"
            variant="ghost"
            label="Загрузить"
            @click="emit('upload', t)"
          />
        </div>
      </div>
    </div>

    <!-- Modals -->
    <UModal
      v-model:open="formOpen"
      :title="editId ? 'Вариант' : 'Новый вариант'"
      :ui="{ content: 'sm:max-w-2xl' }"
    >
      <template #body>
        <form
          class="space-y-4"
          @submit.prevent="saveOffer"
        >
          <div class="grid gap-3 sm:grid-cols-[1fr_2fr_80px]">
            <UFormField label="Туроператор">
              <USelect
                v-model="form.operatorId"
                :items="operators.map(o => ({ value: o.id, label: o.name }))"
                class="w-full"
                @update:model-value="applyCommission"
              />
            </UFormField>
            <UFormField label="Отель">
              <UInput
                v-model="form.hotel"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Звёзды">
              <UInputNumber
                v-model="form.stars"
                :min="0"
                :max="5"
                class="w-full"
              />
            </UFormField>
          </div>
          <div class="grid gap-3 sm:grid-cols-3">
            <UFormField label="Курорт">
              <UInput
                v-model="form.resort"
                placeholder="Турция, Кемер"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Заезд">
              <UInput
                v-model="form.fromDate"
                type="date"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Выезд">
              <UInput
                v-model="form.toDate"
                type="date"
                class="w-full"
              />
            </UFormField>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <UFormField label="Питание">
              <UInput
                v-model="form.meal"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Номер">
              <UInput
                v-model="form.room"
                class="w-full"
              />
            </UFormField>
          </div>
          <div class="flex gap-4">
            <UCheckbox
              v-model="form.flight"
              label="Перелёт"
            />
            <UCheckbox
              v-model="form.transfer"
              label="Трансфер"
            />
            <UCheckbox
              v-model="form.insurance"
              label="Страховка"
            />
          </div>
          <div class="grid gap-3 sm:grid-cols-3 items-end">
            <UFormField label="Нетто, ₸">
              <UInputNumber
                v-model="form.net"
                :min="0"
                :step="10000"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Цена клиенту, ₸"
              :error="form.price && form.price < form.net ? 'Цена ниже нетто' : undefined"
            >
              <UInputNumber
                v-model="form.price"
                :min="0"
                :step="10000"
                class="w-full"
              />
            </UFormField>
            <div class="text-sm pb-2">
              Наценка <b :class="markupPct < 0 ? 'text-bad-text' : 'text-ok-text'">{{ markupPct }}%</b>
              <UButton
                size="xs"
                variant="link"
                label="по комиссии оператора"
                @click="applyCommission"
              />
            </div>
          </div>
          <UFormField label="Заметка">
            <UInput
              v-model="form.note"
              class="w-full"
            />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              label="Отмена"
              @click="formOpen = false"
            />
            <UButton
              type="submit"
              label="Сохранить"
            />
          </div>
        </form>
      </template>
    </UModal>

    <UModal
      v-model:open="importOpen"
      title="Импорт варианта"
      description="Вставьте текст с сайта оператора или из мессенджера, либо загрузите скриншот/PDF — поля заполнятся для проверки."
    >
      <template #body>
        <div class="space-y-3">
          <UTextarea
            v-model="importText"
            :rows="6"
            class="w-full"
            placeholder="Coral Beach Resort 5*, Египет, Шарм-эль-Шейх, 02.11–09.11, 7 ночей, All Inclusive, 980 000 ₸"
          />
          <div class="flex items-center justify-between gap-2">
            <label class="text-sm text-(--ui-primary) cursor-pointer flex items-center gap-1">
              <UIcon name="i-lucide-image-up" />
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                class="hidden"
                @change="($event.target as HTMLInputElement).files?.[0] && runImport(($event.target as HTMLInputElement).files![0])"
              >Скриншот или PDF
            </label>
            <UButton
              :loading="importing"
              :disabled="!importText.trim()"
              label="Распознать текст"
              @click="runImport()"
            />
          </div>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="sendOpen"
      title="Отправить подборку"
      :description="`Уйдёт в канал клиента: ${view.chat ? CHANNEL_LABELS[view.chat.channel as keyof typeof CHANNEL_LABELS] : 'WhatsApp'}`"
      :ui="{ content: 'sm:max-w-2xl' }"
    >
      <template #body>
        <div class="space-y-3">
          <UTextarea
            v-model="sendText"
            :rows="14"
            class="w-full font-mono text-xs"
          />
          <div class="flex justify-end gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              label="Отмена"
              @click="sendOpen = false"
            />
            <UButton
              icon="i-lucide-send"
              label="Отправить клиенту"
              @click="sendSelection"
            />
          </div>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="bookOpen"
      title="Бронь у туроператора"
    >
      <template #body>
        <form
          class="space-y-4"
          @submit.prevent="createBooking"
        >
          <UFormField label="Вариант">
            <USelect
              v-model="bk.offerId"
              :items="view.offers.filter(o => o.status !== 'REJECTED').map(o => ({ value: o.id, label: `${o.hotel} · ${o.operator} · ${formatMoney(o.price)}` }))"
              class="w-full"
            />
          </UFormField>
          <p class="text-xs text-(--ui-text-muted)">
            Условия оператора: {{ operators.find(o => o.id === view.offers.find(x => x.id === bk.offerId)?.operatorId)?.paymentTerms ?? '—' }}
          </p>
          <div class="grid grid-cols-2 gap-3">
            <UFormField
              label="Номер брони"
              hint="если уже подтверждена"
            >
              <UInput
                v-model="bk.number"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Оплатить оператору до">
              <UInput
                v-model="bk.paymentDeadline"
                type="date"
                class="w-full"
              />
            </UFormField>
          </div>
          <UFormField label="Комментарий">
            <UInput
              v-model="bk.comment"
              class="w-full"
            />
          </UFormField>
          <div class="flex justify-end">
            <UButton
              type="submit"
              label="Создать бронь"
            />
          </div>
        </form>
      </template>
    </UModal>

    <UModal
      v-model:open="payOpOpen"
      title="Оплата туроператору"
    >
      <template #body>
        <form
          class="space-y-4"
          @submit.prevent="payOperator"
        >
          <UFormField label="Сумма, ₸">
            <UInputNumber
              v-model="payOp.amount"
              :min="1"
              :step="10000"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Способ">
            <USelect
              v-model="payOp.method"
              :items="['Перевод на счёт', 'Kaspi', 'Карта']"
              class="w-full"
            />
          </UFormField>
          <div class="flex justify-end">
            <UButton
              type="submit"
              label="Провести оплату"
            />
          </div>
        </form>
      </template>
    </UModal>

    <UModal
      v-model:open="cancelOpen"
      title="Аннулировать бронь"
    >
      <template #body>
        <form
          class="space-y-4"
          @submit.prevent="patchBooking({ status: 'CANCELLED', cancelReason: cancel.reason, penalty: cancel.penalty }, 'Бронь аннулирована'); cancelOpen = false"
        >
          <UFormField label="Причина">
            <UInput
              v-model="cancel.reason"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Штраф оператора, ₸">
            <UInputNumber
              v-model="cancel.penalty"
              :min="0"
              :step="10000"
              class="w-full"
            />
          </UFormField>
          <div class="flex justify-end">
            <UButton
              type="submit"
              color="error"
              :disabled="!cancel.reason.trim()"
              label="Аннулировать"
            />
          </div>
        </form>
      </template>
    </UModal>
  </div>
</template>
