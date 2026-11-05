<script setup lang="ts">
import { REPLY_TEMPLATES, fillReply } from '#shared/domain/replyTemplates'
import type { Pipeline } from '#shared/domain/types'

definePageMeta({ middleware: 'role', permission: 'inbox' })
useHead({ title: 'Сообщения — Tourflow' })

interface Row { id: string, name: string, phone: string, channel: string, unread: boolean, lastMessageAt: string, preview: string, deal: { id: string, number: number, stage: string } | null, suggestion: Pipeline | null }
interface Detail {
  id: string
  name: string
  phone: string
  channel: string
  unread: boolean
  lead: Record<string, string>
  pipelineOverride: Pipeline | null
  deal: { id: string, number: number, title: string, stage: string } | null
  messages: { id: string, direction: string, text: string, sentAt: string, auto: boolean }[]
  routing: {
    pipeline: { pipeline: Pipeline | null, confidence: number, rule: string, matched: string[], departureId?: string | null }
    direction: { id: string, name: string, matched: string[] } | null
    manager: { id: string | null, name: string | null, reason: string }
  }
  client: { id: string, name: string, deals: { id: string, number: number, title: string, stage: string }[] } | null
  departures: { id: string, label: string }[]
}

const route = useRoute()
const router = useRouter()
const { me } = useMe()
const filters = [
  { value: 'all', label: 'Все' },
  { value: 'new', label: 'Новые' },
  { value: 'nopipe', label: 'Без воронки' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'INSTAGRAM', label: 'Instagram' },
]
const filter = computed({
  get: () => String(route.query.filter || 'all'),
  set: v => router.replace({ query: { ...route.query, filter: v } }),
})
const selectedId = computed(() => (route.query.c as string) || null)

const { data: rows, refresh: refreshRows, status: rowsStatus } = await useFetch<Row[]>('/api/inbox', { query: { filter }, default: () => [] })
const { data: conv, refresh: refreshConv } = await useFetch<Detail>(() => `/api/inbox/${selectedId.value}`, { immediate: !!selectedId.value, watch: false })
watch(selectedId, async (id) => {
  if (id) {
    await refreshConv()
    markRead()
  }
  else conv.value = undefined
})
onMounted(() => {
  if (!selectedId.value && rows.value[0] && window.innerWidth >= 1024) select(rows.value[0].id)
  else if (selectedId.value) markRead()
})

// J/K — next/previous dialog
function step(dir: 1 | -1) {
  const i = rows.value.findIndex(r => r.id === selectedId.value)
  const next = rows.value[Math.max(0, Math.min(rows.value.length - 1, i + dir))]
  if (next) select(next.id)
}
defineShortcuts({ j: () => step(1), k: () => step(-1) })

function select(id: string) {
  router.replace({ query: { ...route.query, c: id } })
}
async function markRead() {
  if (conv.value?.unread) {
    await api(`/api/inbox/${conv.value.id}`, { method: 'PATCH', body: { unread: false } })
    const r = rows.value.find(x => x.id === conv.value!.id)
    if (r) r.unread = false
    refreshNuxtData('badges')
  }
}

useLiveListener(async (e) => {
  if (e.type !== 'message') return
  await refreshRows()
  if (e.conversationId === selectedId.value) await refreshConv()
})

// Pipeline choice: override → suggestion
const PIPES: { value: Pipeline, label: string }[] = [
  { value: 'GROUP', label: 'Групповые туры' },
  { value: 'PACKAGE', label: 'Пакетные туры' },
  { value: 'BASE', label: 'Базовая' },
]
const chosenPipeline = computed<Pipeline | null>(() => conv.value?.pipelineOverride ?? conv.value?.routing.pipeline.pipeline ?? null)
async function setPipeline(p: Pipeline) {
  if (!conv.value) return
  conv.value.pipelineOverride = p
  await api(`/api/inbox/${conv.value.id}`, { method: 'PATCH', body: { pipelineOverride: p } })
  refreshRows()
}
const ruleText = computed(() => {
  const r = conv.value?.routing.pipeline
  if (!r) return ''
  if (r.rule === 'link') return `по метке ${r.matched[0]}`
  if (r.rule === 'channel') return 'по правилу канала'
  if (r.rule === 'keywords') return `по словам ${r.matched.map(m => `«${m}»`).join(', ')}`
  return 'правила не сработали'
})

// Reply
const draft = ref('')
const sending = ref(false)
const messagesEl = ref<HTMLElement | null>(null)
watch(() => conv.value?.messages.length, () => nextTick(() => messagesEl.value?.scrollTo({ top: messagesEl.value.scrollHeight })))
const templateItems = computed(() => REPLY_TEMPLATES.map(t => ({
  label: t.title,
  onSelect: () => {
    draft.value = fillReply(t.text, { name: conv.value?.name, manager: me.value?.user.name })
  },
})))
async function send() {
  if (!conv.value || !draft.value.trim()) return
  sending.value = true
  const m = await mutate(() => api<Detail['messages'][number]>(`/api/inbox/${conv.value!.id}/messages`, { method: 'POST', body: { text: draft.value } }))
  sending.value = false
  if (m) {
    conv.value.messages.push(m)
    draft.value = ''
    refreshRows()
  }
}
const waLink = computed(() => conv.value && conv.value.channel === 'WHATSAPP' ? `https://wa.me/${conv.value.phone.replace(/\D/g, '')}` : null)

// Create deal
const createOpen = ref(false)
const createState = reactive<{ pipeline: Pipeline, departureId: string | null }>({ pipeline: 'GROUP', departureId: null })
const creating = ref(false)
function openCreate() {
  createState.pipeline = chosenPipeline.value ?? 'BASE'
  createState.departureId = conv.value?.routing.pipeline.departureId ?? null
  createOpen.value = true
}
async function createDeal() {
  creating.value = true
  const r = await mutate(() => api<{ id: string, number: number, clientCreated: boolean, manager: string | null }>(`/api/inbox/${conv.value!.id}/deal`, { method: 'POST', body: createState }))
  creating.value = false
  if (r) {
    useNotify().ok(`Заявка №${r.number} создана`, `${r.clientCreated ? 'Новый клиент добавлен' : 'Добавлена к карточке клиента'} · ответственный: ${r.manager ?? 'не назначен'}`)
    createOpen.value = false
    await navigateTo(`/deals/${r.id}`)
  }
}

// Lead data (editable, moves into the deal)
const LEAD_FIELDS: [string, string][] = [['direction', 'Направление'], ['dates', 'Даты'], ['people', 'Человек'], ['visa', 'Виза']]
async function saveLead(key: string, value: string) {
  if (!conv.value) return
  conv.value.lead = { ...conv.value.lead, [key]: value }
  await api(`/api/inbox/${conv.value.id}`, { method: 'PATCH', body: { lead: conv.value.lead } })
}

// Demo: simulate an incoming message (mock provider)
const simOpen = ref(false)
const sim = reactive({ channel: 'WHATSAPP', name: 'Асель Нурова', phone: '+7 701 777 12 34', text: 'Здравствуйте! Хотим в Анталью в мае, всё включено, двое взрослых.' })
async function simulate() {
  const r = await mutate(() => api<{ id: string }>('/api/inbox/simulate', { method: 'POST', body: sim }), 'Сообщение получено')
  if (r) {
    simOpen.value = false
    await refreshRows()
    select(r.id)
  }
}
</script>

<template>
  <AppPage
    title="Сообщения"
    subtitle="WhatsApp, Instagram и форма сайта"
  >
    <template #actions>
      <UButton
        icon="i-lucide-flask-conical"
        color="neutral"
        variant="ghost"
        label="Тестовое сообщение"
        class="hidden md:inline-flex"
        @click="simOpen = true"
      />
    </template>

    <div class="card flex-1 min-h-[560px] grid lg:grid-cols-[340px_1fr] xl:grid-cols-[340px_1fr_280px] overflow-hidden">
      <!-- List -->
      <div
        class="border-r border-(--ui-border) flex flex-col min-h-0"
        :class="selectedId ? 'hidden lg:flex' : 'flex'"
      >
        <div class="p-3 border-b border-(--ui-border) flex gap-1 flex-wrap">
          <UButton
            v-for="f in filters"
            :key="f.value"
            size="xs"
            :color="filter === f.value ? 'primary' : 'neutral'"
            :variant="filter === f.value ? 'soft' : 'ghost'"
            :label="f.label"
            @click="filter = f.value"
          />
        </div>
        <div class="flex-1 overflow-y-auto">
          <div
            v-if="rowsStatus === 'pending' && !rows.length"
            class="p-3 space-y-3"
          >
            <div
              v-for="i in 6"
              :key="i"
              class="skeleton h-14"
            />
          </div>
          <EmptyState
            v-else-if="!rows.length"
            icon="i-lucide-message-circle"
            text="Здесь появятся сообщения клиентов из WhatsApp, Instagram и с сайта."
            compact
          />
          <button
            v-for="r in rows"
            :key="r.id"
            class="w-full text-left flex gap-3 px-3 py-3 border-b border-(--ui-border-muted) hover:bg-(--ui-bg-muted) transition-colors"
            :class="r.id === selectedId && 'bg-(--ui-bg-muted)'"
            @click="select(r.id)"
          >
            <UChip
              :show="r.unread"
              color="primary"
              size="md"
            >
              <UAvatar
                :text="initials(r.name)"
                size="md"
              />
            </UChip>
            <span class="min-w-0 flex-1">
              <span class="flex items-center gap-2">
                <span
                  class="truncate text-sm"
                  :class="r.unread ? 'font-semibold' : 'font-medium'"
                >{{ r.name }}</span>
                <span class="ml-auto text-xs text-(--ui-text-dimmed) tabular shrink-0">{{ relativeDay(r.lastMessageAt) === 'Сегодня' ? formatTime(r.lastMessageAt) : relativeDay(r.lastMessageAt) }}</span>
              </span>
              <span class="block truncate text-xs text-(--ui-text-muted) mt-0.5">{{ r.preview }}</span>
              <span class="flex items-center gap-1.5 mt-1.5">
                <ChannelBadge :channel="r.channel" />
                <UBadge
                  v-if="r.unread"
                  size="sm"
                  variant="subtle"
                  label="Новое"
                />
                <UBadge
                  v-if="r.deal"
                  size="sm"
                  color="success"
                  variant="subtle"
                  :label="`Есть заявка №${r.deal.number}`"
                />
                <span
                  v-else-if="r.suggestion"
                  class="text-xs text-(--ui-primary)"
                >→ {{ PIPELINE_LABELS[r.suggestion] }}</span>
              </span>
            </span>
          </button>
        </div>
      </div>

      <!-- Dialog -->
      <div
        class="flex flex-col min-h-0 min-w-0"
        :class="selectedId ? 'flex' : 'hidden lg:flex'"
      >
        <template v-if="conv">
          <div class="flex items-center gap-3 px-4 py-3 border-b border-(--ui-border)">
            <UButton
              icon="i-lucide-arrow-left"
              variant="ghost"
              color="neutral"
              class="lg:hidden"
              aria-label="К списку"
              @click="router.replace({ query: { filter } })"
            />
            <UAvatar
              :text="initials(conv.name)"
              size="md"
            />
            <div class="min-w-0 flex-1">
              <p class="font-semibold truncate">
                {{ conv.name }}
              </p>
              <p class="text-xs text-(--ui-text-muted) flex items-center gap-2">
                {{ formatPhone(conv.phone) }} <ChannelBadge :channel="conv.channel" />
              </p>
            </div>
            <UButton
              v-if="conv.deal"
              :to="`/deals/${conv.deal.id}`"
              :label="`Открыть заявку №${conv.deal.number}`"
              trailing-icon="i-lucide-arrow-right"
              variant="soft"
            />
            <UButton
              v-else
              icon="i-lucide-plus"
              label="Создать заявку из диалога"
              @click="openCreate"
            />
          </div>

          <div
            v-if="!conv.deal"
            class="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 border-b border-(--ui-border) bg-indigo-50/60 dark:bg-indigo-500/10 text-sm"
          >
            <UIcon
              name="i-lucide-sparkles"
              class="text-(--ui-primary) shrink-0"
            />
            <span
              v-if="conv.routing.pipeline.pipeline"
              class="min-w-0"
            >
              Рекомендация: <b>{{ PIPELINE_LABELS[conv.routing.pipeline.pipeline] }}</b>
              <span class="text-(--ui-text-muted)"> · {{ ruleText }} · {{ conv.routing.pipeline.confidence }}%</span>
              <template v-if="conv.routing.direction">
                <span class="text-(--ui-text-muted)"> · Направление: </span>{{ conv.routing.direction.name }} → {{ conv.routing.manager.name ?? 'не назначен' }}
              </template>
            </span>
            <span
              v-else
              class="text-(--ui-text-muted)"
            >Воронка не определена — выберите вручную</span>
            <USelect
              :model-value="chosenPipeline ?? undefined"
              :items="PIPES"
              placeholder="Воронка заявки"
              size="xs"
              class="ml-auto w-44"
              aria-label="Воронка заявки"
              @update:model-value="setPipeline($event as Pipeline)"
            />
          </div>

          <div
            ref="messagesEl"
            class="flex-1 overflow-y-auto px-4 py-4 space-y-2 bg-(--ui-bg)"
          >
            <div
              v-for="m in conv.messages"
              :key="m.id"
              class="flex"
              :class="m.direction === 'out' ? 'justify-end' : 'justify-start'"
            >
              <div
                class="max-w-[75%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap"
                :class="m.direction === 'out' ? 'bg-(--ui-primary) text-white rounded-br-md' : 'bg-(--ui-bg-elevated) border border-(--ui-border) rounded-bl-md'"
              >
                {{ m.text }}
                <span
                  class="block text-[11px] mt-1 text-right"
                  :class="m.direction === 'out' ? 'text-white/70' : 'text-(--ui-text-dimmed)'"
                >{{ m.auto ? 'Автоответ · ' : '' }}{{ formatTime(m.sentAt) }}</span>
              </div>
            </div>
          </div>

          <form
            class="border-t border-(--ui-border) p-3 space-y-2"
            @submit.prevent="send"
          >
            <UTextarea
              v-model="draft"
              :rows="2"
              autoresize
              :maxrows="8"
              placeholder="Ответ клиенту…"
              class="w-full"
              @keydown.enter.exact.prevent="send"
            />
            <div class="flex items-center gap-2">
              <UDropdownMenu :items="templateItems">
                <UButton
                  icon="i-lucide-file-text"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  label="Шаблоны"
                />
              </UDropdownMenu>
              <UButton
                v-if="waLink"
                :to="waLink"
                target="_blank"
                color="neutral"
                variant="ghost"
                size="sm"
                label="Открыть чат в WhatsApp ↗"
              />
              <UButton
                type="submit"
                class="ml-auto"
                icon="i-lucide-send"
                label="Отправить"
                :loading="sending"
                :disabled="!draft.trim()"
              />
            </div>
          </form>
        </template>
        <EmptyState
          v-else
          class="flex-1"
          icon="i-lucide-messages-square"
          text="Выберите диалог слева"
        />
      </div>

      <!-- Lead data -->
      <aside
        v-if="conv"
        class="hidden xl:block border-l border-(--ui-border) p-4 space-y-5 overflow-y-auto"
      >
        <div>
          <h3 class="text-xs font-semibold uppercase tracking-wide text-(--ui-text-muted) mb-3">
            Данные лида
          </h3>
          <div class="space-y-3">
            <UFormField
              v-for="[key, label] in LEAD_FIELDS"
              :key="key"
              :label="label"
              size="sm"
            >
              <UInput
                :model-value="conv.lead[key] ?? ''"
                size="sm"
                class="w-full"
                placeholder="—"
                @change="saveLead(key, ($event.target as HTMLInputElement).value)"
              />
            </UFormField>
            <p class="text-xs text-(--ui-text-muted)">
              Источник: {{ CHANNEL_LABELS[conv.channel as keyof typeof CHANNEL_LABELS] }}. Данные перейдут в заявку.
            </p>
          </div>
        </div>
        <div v-if="conv.client">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-(--ui-text-muted) mb-2">
            Клиент уже есть
          </h3>
          <NuxtLink
            :to="`/clients/${conv.client.id}`"
            class="text-sm font-medium text-(--ui-primary)"
          >{{ conv.client.name }} →</NuxtLink>
          <ul class="mt-2 space-y-1">
            <li
              v-for="d in conv.client.deals"
              :key="d.id"
            >
              <NuxtLink
                :to="`/deals/${d.id}`"
                class="block text-xs hover:underline"
              >
                №{{ d.number }} · {{ d.title }} · <span class="text-(--ui-text-muted)">{{ d.stage }}</span>
              </NuxtLink>
            </li>
          </ul>
        </div>
      </aside>
    </div>

    <UModal
      v-model:open="createOpen"
      title="Создать заявку из диалога"
      :description="conv ? `${conv.name} · ${formatPhone(conv.phone)}` : ''"
    >
      <template #body>
        <form
          class="space-y-4"
          @submit.prevent="createDeal"
        >
          <UFormField label="Воронка">
            <USelect
              v-model="createState.pipeline"
              :items="PIPES"
              class="w-full"
            />
          </UFormField>
          <UFormField
            v-if="createState.pipeline === 'GROUP'"
            label="Выезд"
            hint="можно выбрать позже"
          >
            <USelect
              v-model="createState.departureId"
              :items="[{ value: null, label: 'Не выбран' }, ...(conv?.departures ?? []).map(d => ({ value: d.id, label: d.label }))]"
              class="w-full"
            />
          </UFormField>
          <p class="text-sm text-(--ui-text-muted)">
            Клиент найдётся по телефону или будет создан. Ответственный: <b>{{ conv?.routing.manager.name ?? 'по умолчанию' }}</b><template v-if="conv?.routing.direction">
              (направление «{{ conv.routing.direction.name }}»)
            </template>.
          </p>
          <div class="flex justify-end gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              label="Отмена"
              @click="createOpen = false"
            />
            <UButton
              type="submit"
              :loading="creating"
              label="Создать заявку"
            />
          </div>
        </form>
      </template>
    </UModal>

    <UModal
      v-model:open="simOpen"
      title="Тестовое входящее сообщение"
      description="Демо-режим: сообщение придёт так, будто его написал клиент."
    >
      <template #body>
        <form
          class="space-y-4"
          @submit.prevent="simulate"
        >
          <UFormField label="Канал">
            <USelect
              v-model="sim.channel"
              :items="[{ value: 'WHATSAPP', label: 'WhatsApp' }, { value: 'INSTAGRAM', label: 'Instagram' }, { value: 'SITE', label: 'Сайт' }]"
              class="w-full"
            />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Имя">
              <UInput
                v-model="sim.name"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Телефон">
              <UInput
                v-model="sim.phone"
                class="w-full"
              />
            </UFormField>
          </div>
          <UFormField label="Текст">
            <UTextarea
              v-model="sim.text"
              :rows="3"
              class="w-full"
            />
          </UFormField>
          <div class="flex justify-end">
            <UButton
              type="submit"
              label="Получить сообщение"
            />
          </div>
        </form>
      </template>
    </UModal>
  </AppPage>
</template>
