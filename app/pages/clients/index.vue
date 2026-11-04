<script setup lang="ts">
definePageMeta({ middleware: 'role', permission: 'clients' })
useHead({ title: 'Клиенты — Tourflow' })

interface Row {
  id: string
  name: string
  fullName: string | null
  phone: string
  status: string
  dealsCount: number
  lastDeal: { id: string, number: number, title: string, stage: string } | null
  manager: string | null
  paid: number
  debt: number
  source: string
  attention: string[]
}

const route = useRoute()
const router = useRouter()
const { can } = usePermissions()
const filters = [
  { value: 'all', label: 'Все' },
  { value: 'active', label: 'В работе' },
  { value: 'trips', label: 'С поездками' },
  { value: 'debt', label: 'С долгом' },
  { value: 'dupes', label: 'Дубли' },
]
const filter = computed({ get: () => String(route.query.filter || 'all'), set: v => router.replace({ query: { ...route.query, filter: v } }) })
const q = ref(String(route.query.q || ''))
const qDebounced = refDebounced(q, 250)
const { data: rows, status } = await useFetch<Row[]>('/api/clients', { query: { filter, q: qDebounced }, default: () => [] })

const STATUS_COLORS: Record<string, 'neutral' | 'success' | 'primary'> = { 'Новый': 'neutral', 'Был в поездке': 'primary', 'Постоянный': 'success' }

// New client
const createOpen = ref(false)
const form = reactive({ name: '', phone: '', email: '', source: 'MANUAL' })
const duplicate = ref<{ id: string, name: string } | null>(null)
async function create() {
  duplicate.value = null
  try {
    const r = await api<{ id: string }>('/api/clients', { method: 'POST', body: form })
    createOpen.value = false
    useNotify().ok('Клиент добавлен')
    await navigateTo(`/clients/${r.id}`)
  }
  catch (e) {
    const err = e as { statusCode?: number, data?: { data?: { id: string, name: string } } }
    if (err.statusCode === 409 && err.data?.data) duplicate.value = err.data.data
    else useNotify().fail(e)
  }
}
const SOURCES = [
  { value: 'MANUAL', label: 'Вручную' }, { value: 'CALL', label: 'Звонок' }, { value: 'OFFICE', label: 'Офис' },
  { value: 'REFERRAL', label: 'Рекомендация' }, { value: 'WHATSAPP', label: 'WhatsApp' }, { value: 'INSTAGRAM', label: 'Instagram' }, { value: 'SITE', label: 'Сайт' },
]
</script>

<template>
  <AppPage
    title="Клиенты"
    :subtitle="`${rows.length} в списке`"
  >
    <template #actions>
      <UButton
        icon="i-lucide-user-plus"
        label="Клиент"
        @click="createOpen = true; duplicate = null"
      />
    </template>

    <div class="flex flex-wrap items-center gap-3">
      <UInput
        v-model="q"
        icon="i-lucide-search"
        placeholder="Имя, телефон или ИИН"
        class="w-full sm:w-80"
      />
      <div class="flex gap-1 flex-wrap">
        <UButton
          v-for="f in filters"
          :key="f.value"
          size="sm"
          :color="filter === f.value ? 'primary' : 'neutral'"
          :variant="filter === f.value ? 'soft' : 'ghost'"
          :label="f.label"
          @click="filter = f.value"
        />
      </div>
    </div>

    <div class="card overflow-x-auto">
      <table class="w-full text-sm min-w-[900px]">
        <thead class="text-left text-xs text-(--ui-text-muted) border-b border-(--ui-border)">
          <tr>
            <th class="px-5 py-2.5 font-medium">
              Клиент
            </th>
            <th class="px-3 py-2.5 font-medium">
              Статус
            </th>
            <th class="px-3 py-2.5 font-medium">
              Последняя заявка
            </th>
            <th class="px-3 py-2.5 font-medium">
              Менеджер
            </th>
            <th
              v-if="can('payments')"
              class="px-3 py-2.5 font-medium text-right"
            >
              Оплачено
            </th>
            <th class="px-3 py-2.5 font-medium">
              Источник
            </th>
            <th class="px-5 py-2.5 font-medium">
              Внимание
            </th>
          </tr>
        </thead>
        <tbody>
          <template v-if="status === 'pending' && !rows.length">
            <tr
              v-for="i in 8"
              :key="i"
            >
              <td
                colspan="7"
                class="px-5 py-2"
              >
                <div class="skeleton h-8" />
              </td>
            </tr>
          </template>
          <tr
            v-for="r in rows"
            :key="r.id"
            class="border-b border-(--ui-border-muted) last:border-0 hover:bg-(--ui-bg-muted) cursor-pointer"
            @click="navigateTo(`/clients/${r.id}`)"
          >
            <td class="px-5 py-3">
              <div class="flex items-center gap-3">
                <UAvatar
                  :text="initials(r.name)"
                  size="sm"
                />
                <div>
                  <NuxtLink
                    :to="`/clients/${r.id}`"
                    class="font-medium hover:underline"
                    @click.stop
                  >{{ r.name }}</NuxtLink>
                  <p class="text-xs text-(--ui-text-muted) tabular">
                    {{ formatPhone(r.phone) }}
                  </p>
                </div>
              </div>
            </td>
            <td class="px-3 py-3">
              <UBadge
                :color="STATUS_COLORS[r.status]"
                variant="subtle"
                :label="r.status"
              />
              <p class="text-xs text-(--ui-text-muted) mt-1">
                {{ r.dealsCount }} {{ plural(r.dealsCount, 'заявка', 'заявки', 'заявок') }}
              </p>
            </td>
            <td class="px-3 py-3 max-w-64">
              <template v-if="r.lastDeal">
                <p class="truncate">
                  №{{ r.lastDeal.number }} · {{ r.lastDeal.title }}
                </p>
                <p class="text-xs text-(--ui-text-muted)">
                  {{ r.lastDeal.stage }}
                </p>
              </template>
              <span
                v-else
                class="text-(--ui-text-dimmed)"
              >—</span>
            </td>
            <td class="px-3 py-3">
              {{ r.manager ?? '—' }}
            </td>
            <td
              v-if="can('payments')"
              class="px-3 py-3 text-right tabular"
            >
              {{ formatMoney(r.paid) }}
              <p
                v-if="r.debt"
                class="text-xs text-bad-text"
              >
                долг {{ formatMoney(r.debt) }}
              </p>
            </td>
            <td class="px-3 py-3">
              <ChannelBadge :channel="r.source" />
            </td>
            <td class="px-5 py-3">
              <div class="flex flex-wrap gap-1">
                <UBadge
                  v-for="a in r.attention"
                  :key="a"
                  size="sm"
                  variant="subtle"
                  :color="a === 'Возможный дубль' ? 'warning' : 'error'"
                  :label="a"
                />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <EmptyState
        v-if="status !== 'pending' && !rows.length"
        icon="i-lucide-users"
        :text="q ? 'Никого не нашли. Проверьте имя или телефон.' : 'Клиенты появятся, когда вы создадите первую заявку.'"
        action="Добавить клиента"
        @action="createOpen = true"
      />
    </div>

    <UModal
      v-model:open="createOpen"
      title="Новый клиент"
      description="Клиент ищется по телефону — дубль не создастся."
    >
      <template #body>
        <form
          class="space-y-4"
          @submit.prevent="create"
        >
          <UFormField label="Имя">
            <UInput
              v-model="form.name"
              class="w-full"
              autofocus
            />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Телефон">
              <UInput
                v-model="form.phone"
                placeholder="+7 701 000 00 00"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Email">
              <UInput
                v-model="form.email"
                type="email"
                class="w-full"
              />
            </UFormField>
          </div>
          <UFormField label="Источник">
            <USelect
              v-model="form.source"
              :items="SOURCES"
              class="w-full"
            />
          </UFormField>
          <UAlert
            v-if="duplicate"
            color="warning"
            variant="subtle"
            icon="i-lucide-copy"
            :title="`Клиент с этим телефоном уже есть: ${duplicate.name}`"
            :actions="[{ label: 'Открыть карточку', to: `/clients/${duplicate.id}` }]"
          />
          <div class="flex justify-end gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              label="Отмена"
              @click="createOpen = false"
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
