<script setup lang="ts">
definePageMeta({ middleware: 'role', permission: 'clients' })

interface Dossier {
  client: {
    id: string
    name: string
    phone: string
    extraPhones: string[]
    email: string | null
    fullName: string | null
    iinMasked: string | null
    hasIin: boolean
    birthDate: string | null
    address: string | null
    source: string
    tags: string[]
    note: string | null
    pdConsentAt: string | null
    managerId: string | null
    manager: string | null
    firstContact: string
    lastContact: string
    contractFilled: number
    contractTotal: number
    badges: string[]
  }
  stats: { paid: number | null, trips: number, active: number, avgCheck: number | null, debt: number | null, lost: number }
  activeDeals: { id: string, number: number, title: string, dates: string | null, stage: string, stageIndex: number, stagesCount: number, done: number, total: number, next: string | null, price: number | null, paid: number | null, debt: number | null, manager: string | null }[]
  deals: { id: string, number: number, title: string, dates: string | null, createdAt: string, status: string, stage: string, price: number | null, paid: number | null, manager: string | null }[]
  timeline: { id: string, at: string, text: string, kind: string, actor: string, deal: { id: string, number: number } }[]
  travelers: { name: string, passport: string | null, expiry: string | null, isChild: boolean }[]
  messages: { id: string, channel: string, direction: string, text: string, sentAt: string }[]
  payments: { id: string, amount: number, type: string, method: string, paidAt: string, deal: { id: string, number: number } }[]
  documents: { id: string, name: string, type: string, createdAt: string, deal: { id: string, number: number } }[]
}

const route = useRoute()
const id = computed(() => String(route.params.id))
const { data, refresh, error } = await useFetch<Dossier>(() => `/api/clients/${id.value}`)
useHead(() => ({ title: `${data.value?.client.name ?? 'Клиент'} — Tourflow` }))
const { can, isOwner } = usePermissions()
const { me } = useMe()

const tab = ref('deals')
const tabs = computed(() => [
  { value: 'deals', label: `Все заявки · ${data.value?.deals.length ?? 0}` },
  { value: 'timeline', label: 'Хронология' },
  { value: 'travelers', label: 'Туристы' },
  { value: 'messages', label: 'Переписка' },
  ...(can('payments') ? [{ value: 'payments', label: 'Оплаты' }] : []),
  ...(can('documents') ? [{ value: 'documents', label: 'Документы' }] : []),
])

// IIN reveal (audited)
const iin = ref<string | null>(null)
async function revealIin() {
  const r = await mutate(() => api<{ iin: string | null }>(`/api/clients/${id.value}/iin`))
  if (r) iin.value = r.iin
}

// Edit
const editOpen = ref(false)
const edit = reactive({ name: '', phone: '', extraPhones: '', email: '', fullName: '', iin: '', birthDate: '', address: '', note: '', managerId: null as string | null, pdConsent: false })
async function openEdit() {
  const c = data.value!.client
  if (c.hasIin && iin.value === null) await revealIin()
  Object.assign(edit, {
    name: c.name, phone: formatPhone(c.phone), extraPhones: c.extraPhones.map(formatPhone).join(', '), email: c.email ?? '', fullName: c.fullName ?? '',
    iin: iin.value ?? '', birthDate: c.birthDate?.slice(0, 10) ?? '', address: c.address ?? '', note: c.note ?? '', managerId: c.managerId, pdConsent: !!c.pdConsentAt,
  })
  editOpen.value = true
}
async function save() {
  const payload = {
    ...edit,
    extraPhones: edit.extraPhones.split(',').map(s => s.trim()).filter(Boolean),
    birthDate: edit.birthDate || null,
  }
  if (!isOwner.value) delete (payload as Partial<typeof payload>).managerId
  const r = await mutate(() => api<{ advanced: { dealId: string, from: string, to: string }[] }>(`/api/clients/${id.value}`, { method: 'PUT', body: payload }), 'Данные клиента обновлены во всех заявках')
  if (r) {
    editOpen.value = false
    iin.value = edit.iin || null
    for (const a of r.advanced) useNotify().info('Статус обновлён автоматически', `${a.from} → ${a.to}`)
    await refresh()
  }
}

// Tags
const tagInput = ref('')
const TAG_SUGGESTIONS = ['Шенген есть', 'Путешествует с детьми', 'Предпочитает WhatsApp', 'VIP', 'Только всё включено', 'Боится перелётов']
async function setTags(tags: string[]) {
  await mutate(() => api(`/api/clients/${id.value}`, { method: 'PUT', body: { tags } }))
  await refresh()
}
function addTag(t: string) {
  const v = t.trim()
  if (!v || data.value!.client.tags.includes(v)) return
  tagInput.value = ''
  setTags([...data.value!.client.tags, v])
}

// Merge
const mergeOpen = ref(false)
const mergeQuery = ref('')
const { data: mergeCandidates } = useFetch<{ id: string, name: string, phone: string, attention: string[] }[]>('/api/clients', { query: { q: refDebounced(mergeQuery, 250), filter: 'all' }, default: () => [], immediate: false, watch: [mergeOpen, refDebounced(mergeQuery, 250)] })
const mergeTarget = ref<{ id: string, name: string, phone: string } | null>(null)
async function doMerge() {
  if (!mergeTarget.value) return
  const ok = await mutate(() => api(`/api/clients/${id.value}/merge`, { method: 'POST', body: { otherId: mergeTarget.value!.id } }), 'Клиенты объединены')
  if (ok) {
    mergeOpen.value = false
    mergeTarget.value = null
    await refresh()
  }
}

const passportWarn = (d: string | null) => d && new Date(d).getTime() < Date.now() + 180 * 86_400_000
</script>

<template>
  <AppPage
    v-if="data"
    :title="data!.client.name"
    :subtitle="formatPhone(data!.client.phone)"
    back="/clients"
  >
    <template #actions>
      <UButton
        icon="i-lucide-pencil"
        color="neutral"
        variant="outline"
        label="Редактировать"
        @click="openEdit"
      />
    </template>

    <div class="grid gap-6 xl:grid-cols-[340px_1fr] items-start">
      <!-- Left column -->
      <aside class="card p-5 space-y-5 xl:sticky xl:top-0">
        <div class="flex items-center gap-3">
          <UAvatar
            :text="initials(data!.client.name)"
            size="xl"
          />
          <div>
            <p class="font-semibold text-lg leading-tight">
              {{ data!.client.name }}
            </p>
            <div class="flex gap-1 mt-1">
              <UBadge
                v-for="b in data!.client.badges"
                :key="b"
                variant="subtle"
                :label="b"
              />
              <ChannelBadge :channel="data!.client.source" />
            </div>
          </div>
        </div>
        <div class="flex gap-2">
          <UButton
            :to="`https://wa.me/${data!.client.phone.replace(/\D/g, '')}`"
            target="_blank"
            icon="i-lucide-message-circle"
            label="WhatsApp"
            size="sm"
            variant="soft"
            color="success"
          />
          <UButton
            :to="`tel:${data!.client.phone}`"
            icon="i-lucide-phone"
            label="Позвонить"
            size="sm"
            variant="soft"
            color="neutral"
          />
          <UButton
            v-if="data!.client.email"
            :to="`mailto:${data!.client.email}`"
            icon="i-lucide-mail"
            label="Email"
            size="sm"
            variant="soft"
            color="neutral"
          />
        </div>
        <dl class="text-sm space-y-2">
          <div class="flex justify-between gap-3">
            <dt class="text-(--ui-text-muted)">
              Телефон
            </dt><dd class="tabular text-right">
              {{ formatPhone(data!.client.phone) }}<span
                v-for="p in data!.client.extraPhones"
                :key="p"
                class="block text-(--ui-text-muted)"
              >{{ formatPhone(p) }}</span>
            </dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-(--ui-text-muted)">
              Email
            </dt><dd>{{ data!.client.email || '—' }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-(--ui-text-muted)">
              Ответственный
            </dt><dd>{{ data!.client.manager ?? '—' }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-(--ui-text-muted)">
              Первое обращение
            </dt><dd>{{ formatDate(data!.client.firstContact) }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-(--ui-text-muted)">
              Последнее
            </dt><dd>{{ formatDate(data!.client.lastContact) }}</dd>
          </div>
        </dl>

        <div class="border-t border-(--ui-border) pt-4">
          <div class="flex items-center justify-between mb-2">
            <p class="text-sm font-medium">
              Данные для договора
            </p>
            <span class="text-xs text-(--ui-text-muted)">{{ data!.client.contractFilled }} из {{ data!.client.contractTotal }}</span>
          </div>
          <UProgress
            :model-value="data!.client.contractFilled"
            :max="data!.client.contractTotal"
            size="sm"
            :color="data!.client.contractFilled === data!.client.contractTotal ? 'success' : 'primary'"
          />
          <dl class="text-sm space-y-1.5 mt-3">
            <div class="flex justify-between gap-3">
              <dt class="text-(--ui-text-muted)">
                ФИО
              </dt><dd class="text-right">
                {{ data!.client.fullName || '—' }}
              </dd>
            </div>
            <div class="flex justify-between gap-3 items-center">
              <dt class="text-(--ui-text-muted)">
                ИИН
              </dt>
              <dd class="tabular flex items-center gap-1">
                {{ iin ?? data!.client.iinMasked ?? '—' }}
                <UButton
                  v-if="data!.client.hasIin && iin === null"
                  size="xs"
                  variant="ghost"
                  icon="i-lucide-eye"
                  aria-label="Показать ИИН (просмотр записывается в журнал)"
                  title="Просмотр записывается в журнал"
                  @click="revealIin"
                />
              </dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-(--ui-text-muted)">
                Дата рождения
              </dt><dd>{{ data!.client.birthDate ? formatDate(data!.client.birthDate, { dateOnly: true }) : '—' }}</dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-(--ui-text-muted)">
                Адрес
              </dt><dd class="text-right">
                {{ data!.client.address || '—' }}
              </dd>
            </div>
          </dl>
          <p
            class="text-xs mt-3 flex items-center gap-1"
            :class="data!.client.pdConsentAt ? 'text-ok-text' : 'text-warn-text'"
          >
            <UIcon :name="data!.client.pdConsentAt ? 'i-lucide-shield-check' : 'i-lucide-shield-alert'" />
            {{ data!.client.pdConsentAt ? `Согласие на обработку ПДн от ${formatDate(data!.client.pdConsentAt)}` : 'Нет согласия на обработку ПДн' }}
          </p>
        </div>

        <div class="border-t border-(--ui-border) pt-4">
          <p class="text-sm font-medium mb-2">
            Метки
          </p>
          <div class="flex flex-wrap gap-1.5">
            <UBadge
              v-for="t in data!.client.tags"
              :key="t"
              variant="soft"
              color="neutral"
              class="gap-1"
            >
              {{ t }}
              <button
                class="opacity-60 hover:opacity-100"
                :aria-label="`Убрать метку ${t}`"
                @click="setTags(data!.client.tags.filter(x => x !== t))"
              >
                <UIcon
                  name="i-lucide-x"
                  class="size-3"
                />
              </button>
            </UBadge>
          </div>
          <UInput
            v-model="tagInput"
            size="sm"
            placeholder="Добавить метку…"
            class="w-full mt-2"
            @keydown.enter.prevent="addTag(tagInput)"
          />
          <div class="flex flex-wrap gap-1 mt-2">
            <button
              v-for="s in TAG_SUGGESTIONS.filter(x => !data!.client.tags.includes(x))"
              :key="s"
              class="text-xs text-(--ui-text-muted) hover:text-(--ui-primary)"
              @click="addTag(s)"
            >
              + {{ s }}
            </button>
          </div>
        </div>

        <div
          v-if="data!.client.note"
          class="border-t border-(--ui-border) pt-4"
        >
          <p class="text-sm font-medium mb-1">
            Заметка
          </p>
          <p class="text-sm text-(--ui-text-toned) whitespace-pre-wrap">
            {{ data!.client.note }}
          </p>
        </div>

        <div class="flex gap-2 border-t border-(--ui-border) pt-4">
          <UButton
            icon="i-lucide-pencil"
            label="Редактировать"
            size="sm"
            color="neutral"
            variant="outline"
            @click="openEdit"
          />
          <UButton
            icon="i-lucide-merge"
            label="Объединить"
            size="sm"
            color="neutral"
            variant="ghost"
            @click="mergeOpen = true"
          />
        </div>
      </aside>

      <!-- Right -->
      <div class="space-y-6 min-w-0">
        <div class="grid gap-3 grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          <div
            v-for="s in [
              { l: 'Оплачено за всё время', v: data!.stats.paid === null ? '—' : formatMoney(data!.stats.paid) },
              { l: 'Поездок', v: data!.stats.trips },
              { l: 'В работе', v: data!.stats.active },
              { l: 'Средний чек', v: data!.stats.avgCheck === null ? '—' : formatMoney(data!.stats.avgCheck) },
              { l: 'Текущий долг', v: data!.stats.debt === null ? '—' : formatMoney(data!.stats.debt), warn: !!data!.stats.debt },
              { l: 'Отказы', v: data!.stats.lost },
            ]"
            :key="s.l"
            class="card px-4 py-3"
          >
            <p class="text-xs text-(--ui-text-muted)">
              {{ s.l }}
            </p>
            <p
              class="text-lg font-semibold tabular"
              :class="'warn' in s && s.warn && 'text-bad-text'"
            >
              {{ s.v }}
            </p>
          </div>
        </div>

        <div
          v-if="data!.activeDeals.length"
          class="grid gap-4 lg:grid-cols-2"
        >
          <NuxtLink
            v-for="d in data!.activeDeals"
            :key="d.id"
            :to="`/deals/${d.id}`"
            class="card p-5 hover:border-(--ui-primary)/40 transition-colors"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="font-semibold">
                  №{{ d.number }} · {{ d.title }}
                </p>
                <p class="text-sm text-(--ui-text-muted)">
                  {{ d.dates || 'даты не указаны' }} · {{ d.manager ?? 'без ответственного' }}
                </p>
              </div>
              <UBadge
                variant="subtle"
                :label="d.stage"
              />
            </div>
            <div class="mt-3">
              <div class="flex justify-between text-xs text-(--ui-text-muted) mb-1">
                <span>Этап {{ d.stageIndex + 1 }} из {{ d.stagesCount }}</span><span>регламент {{ d.done }} из {{ d.total }}</span>
              </div>
              <UProgress
                :model-value="d.stageIndex + 1"
                :max="d.stagesCount"
                size="sm"
              />
            </div>
            <div
              v-if="d.price !== null"
              class="grid grid-cols-3 gap-2 mt-3 text-sm"
            >
              <div>
                <p class="text-xs text-(--ui-text-muted)">
                  Сумма
                </p><p class="tabular">
                  {{ formatMoney(d.price) }}
                </p>
              </div>
              <div>
                <p class="text-xs text-(--ui-text-muted)">
                  Оплачено
                </p><p class="tabular">
                  {{ formatMoney(d.paid) }}
                </p>
              </div>
              <div>
                <p class="text-xs text-(--ui-text-muted)">
                  Долг
                </p><p
                  class="tabular"
                  :class="d.debt ? 'text-bad-text' : ''"
                >
                  {{ formatMoney(d.debt) }}
                </p>
              </div>
            </div>
            <p
              v-if="d.next"
              class="mt-3 text-sm flex items-center gap-1.5 text-(--ui-primary)"
            >
              <UIcon name="i-lucide-arrow-right-circle" /> Следующий шаг: {{ d.next }}
            </p>
          </NuxtLink>
        </div>

        <div class="card">
          <UTabs
            v-model="tab"
            :items="tabs"
            variant="link"
            :content="false"
            class="px-5 pt-2"
          />
          <div class="p-5">
            <ul
              v-if="tab === 'deals'"
              class="divide-y divide-(--ui-border-muted)"
            >
              <li
                v-for="d in data!.deals"
                :key="d.id"
              >
                <NuxtLink
                  :to="`/deals/${d.id}`"
                  class="flex items-center gap-3 py-2.5 hover:bg-(--ui-bg-muted) -mx-2 px-2 rounded"
                >
                  <UIcon
                    :name="d.status === 'won' ? 'i-lucide-check-circle-2' : d.status === 'lost' ? 'i-lucide-x-circle' : 'i-lucide-circle-dot'"
                    :class="d.status === 'won' ? 'text-ok' : d.status === 'lost' ? 'text-bad' : 'text-(--ui-primary)'"
                  />
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-medium">№{{ d.number }} · {{ d.title }}</span>
                    <span class="block text-xs text-(--ui-text-muted)">{{ d.stage }} · {{ formatDate(d.createdAt) }}</span>
                  </span>
                  <span
                    v-if="d.price !== null"
                    class="text-sm tabular"
                  >{{ formatMoney(d.price) }}</span>
                </NuxtLink>
              </li>
            </ul>
            <ul
              v-else-if="tab === 'timeline'"
              class="space-y-3"
            >
              <li
                v-for="e in data!.timeline"
                :key="e.id"
                class="flex gap-3 text-sm"
              >
                <span class="text-xs text-(--ui-text-muted) w-28 shrink-0 tabular">{{ formatDateTime(e.at) }}</span>
                <span class="min-w-0">{{ e.text }} <span class="text-(--ui-text-muted)">· {{ e.actor }} · </span><NuxtLink
                  :to="`/deals/${e.deal.id}`"
                  class="text-(--ui-primary)"
                >№{{ e.deal.number }}</NuxtLink></span>
              </li>
              <EmptyState
                v-if="!data!.timeline.length"
                text="Событий пока нет"
                compact
              />
            </ul>
            <table
              v-else-if="tab === 'travelers'"
              class="w-full text-sm"
            >
              <thead class="text-left text-xs text-(--ui-text-muted)">
                <tr>
                  <th class="py-2 font-medium">
                    ФИО как в паспорте
                  </th><th class="py-2 font-medium">
                    Паспорт
                  </th><th class="py-2 font-medium">
                    Действует до
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="t in data!.travelers"
                  :key="t.name"
                  class="border-t border-(--ui-border-muted)"
                >
                  <td class="py-2">
                    {{ t.name }} <UBadge
                      v-if="t.isChild"
                      size="sm"
                      variant="subtle"
                      label="ребёнок"
                    />
                  </td>
                  <td class="py-2 tabular">
                    {{ t.passport ?? '—' }}
                  </td>
                  <td
                    class="py-2 tabular"
                    :class="passportWarn(t.expiry) && 'text-bad-text font-medium'"
                  >
                    {{ t.expiry ? formatDate(t.expiry, { dateOnly: true }) : '—' }}
                  </td>
                </tr>
              </tbody>
            </table>
            <div
              v-else-if="tab === 'messages'"
              class="space-y-2 max-h-[480px] overflow-y-auto"
            >
              <div
                v-for="m in data!.messages"
                :key="m.id"
                class="flex"
                :class="m.direction === 'out' ? 'justify-end' : ''"
              >
                <div
                  class="max-w-[75%] rounded-2xl px-3 py-2 text-sm"
                  :class="m.direction === 'out' ? 'bg-(--ui-primary) text-white' : 'bg-(--ui-bg-muted)'"
                >
                  {{ m.text }}<span class="block text-[11px] opacity-70 mt-1">{{ formatDateTime(m.sentAt) }}</span>
                </div>
              </div>
              <EmptyState
                v-if="!data!.messages.length"
                text="Переписки пока нет"
                compact
              />
            </div>
            <table
              v-else-if="tab === 'payments'"
              class="w-full text-sm"
            >
              <tbody>
                <tr
                  v-for="p in data!.payments"
                  :key="p.id"
                  class="border-b border-(--ui-border-muted) last:border-0"
                >
                  <td class="py-2 tabular">
                    {{ formatDate(p.paidAt) }}
                  </td>
                  <td class="py-2">
                    {{ p.type }} · {{ p.method }}
                  </td>
                  <td class="py-2">
                    <NuxtLink
                      :to="`/deals/${p.deal.id}`"
                      class="text-(--ui-primary)"
                    >№{{ p.deal.number }}</NuxtLink>
                  </td>
                  <td
                    class="py-2 text-right tabular"
                    :class="p.amount < 0 && 'text-bad-text'"
                  >
                    {{ formatMoney(p.amount) }}
                  </td>
                </tr>
              </tbody>
            </table>
            <ul
              v-else-if="tab === 'documents'"
              class="divide-y divide-(--ui-border-muted)"
            >
              <li
                v-for="d in data!.documents"
                :key="d.id"
                class="flex items-center gap-3 py-2 text-sm"
              >
                <UIcon
                  name="i-lucide-file-text"
                  class="text-(--ui-text-muted)"
                />
                <a
                  :href="`/api/documents/${d.id}/download`"
                  class="flex-1 truncate hover:underline"
                >{{ d.name }}</a>
                <UBadge
                  size="sm"
                  variant="subtle"
                  color="neutral"
                  :label="d.type"
                />
                <span class="text-xs text-(--ui-text-muted)">№{{ d.deal.number }} · {{ formatDate(d.createdAt) }}</span>
              </li>
              <EmptyState
                v-if="!data!.documents.length"
                text="Документов пока нет"
                compact
              />
            </ul>
          </div>
        </div>
      </div>
    </div>

    <USlideover
      v-model:open="editOpen"
      title="Данные клиента"
      description="Изменения применятся ко всем заявкам клиента и будущим договорам."
    >
      <template #body>
        <form
          id="client-edit"
          class="space-y-4"
          @submit.prevent="save"
        >
          <UFormField label="Имя (как в мессенджере)">
            <UInput
              v-model="edit.name"
              class="w-full"
            />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Телефон">
              <UInput
                v-model="edit.phone"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Email">
              <UInput
                v-model="edit.email"
                class="w-full"
              />
            </UFormField>
          </div>
          <UFormField
            label="Доп. телефоны"
            hint="через запятую"
          >
            <UInput
              v-model="edit.extraPhones"
              class="w-full"
            />
          </UFormField>
          <USeparator label="Для договора" />
          <UFormField label="ФИО полностью">
            <UInput
              v-model="edit.fullName"
              class="w-full"
            />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField
              label="ИИН"
              hint="12 цифр"
            >
              <UInput
                v-model="edit.iin"
                inputmode="numeric"
                maxlength="12"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Дата рождения">
              <UInput
                v-model="edit.birthDate"
                type="date"
                class="w-full"
              />
            </UFormField>
          </div>
          <UFormField label="Адрес">
            <UInput
              v-model="edit.address"
              class="w-full"
            />
          </UFormField>
          <UCheckbox
            v-model="edit.pdConsent"
            label="Есть согласие на обработку персональных данных"
          />
          <UFormField
            v-if="isOwner"
            label="Ответственный"
          >
            <USelect
              v-model="edit.managerId"
              :items="[{ value: null, label: 'Не назначен' }, ...(me?.members ?? []).map(m => ({ value: m.id, label: m.name }))]"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Заметка">
            <UTextarea
              v-model="edit.note"
              :rows="3"
              class="w-full"
            />
          </UFormField>
        </form>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton
            color="neutral"
            variant="ghost"
            label="Отмена"
            @click="editOpen = false"
          />
          <UButton
            type="submit"
            form="client-edit"
            label="Сохранить"
          />
        </div>
      </template>
    </USlideover>

    <UModal
      v-model:open="mergeOpen"
      title="Объединить с другим клиентом"
      description="Заявки, туристы и данные второго клиента перейдут сюда, его телефон станет дополнительным. Отменить нельзя."
    >
      <template #body>
        <div class="space-y-3">
          <UInput
            v-model="mergeQuery"
            icon="i-lucide-search"
            placeholder="Имя или телефон второго клиента"
            class="w-full"
            autofocus
          />
          <div class="max-h-64 overflow-y-auto divide-y divide-(--ui-border-muted)">
            <button
              v-for="c in mergeCandidates.filter(x => x.id !== data!.client.id)"
              :key="c.id"
              class="w-full text-left flex items-center gap-3 py-2 px-2 rounded hover:bg-(--ui-bg-muted)"
              :class="mergeTarget?.id === c.id && 'bg-(--ui-bg-muted)'"
              @click="mergeTarget = c"
            >
              <UAvatar
                :text="initials(c.name)"
                size="xs"
              />
              <span class="flex-1 text-sm">{{ c.name }} <span class="text-(--ui-text-muted)">· {{ formatPhone(c.phone) }}</span></span>
              <UBadge
                v-if="c.attention.includes('Возможный дубль')"
                size="sm"
                color="warning"
                variant="subtle"
                label="Возможный дубль"
              />
            </button>
          </div>
          <UAlert
            v-if="mergeTarget"
            color="warning"
            variant="subtle"
            icon="i-lucide-alert-triangle"
            :title="`«${mergeTarget.name}» будет объединён с «${data!.client.name}». Это необратимо.`"
          />
          <div class="flex justify-end gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              label="Отмена"
              @click="mergeOpen = false"
            />
            <UButton
              color="error"
              :disabled="!mergeTarget"
              label="Объединить"
              @click="doMerge"
            />
          </div>
        </div>
      </template>
    </UModal>
  </AppPage>
  <AppPage
    v-else-if="error"
    title="Клиент"
    back="/clients"
  >
    <div class="card">
      <EmptyState
        icon="i-lucide-user-x"
        :text="error.statusMessage || 'Клиент не найден'"
      />
    </div>
  </AppPage>
</template>
