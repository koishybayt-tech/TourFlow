<script setup lang="ts">
import { BLANK } from '#shared/domain/templates'
import type { DealChanged, DealView } from '~/types/deal'

const props = defineProps<{ view: DealView, kind: 'contract' | 'receipt', templateId?: string }>()
const emit = defineEmits<{ changed: Parameters<DealChanged> }>()
const open = defineModel<boolean>('open', { default: false })

interface Tpl { id: string, name: string, missing: number, forPipeline: boolean, short: string | null }
interface Field { placeholder: string, field: string, label: string, group: string, value: string, fromDeal: string, manual: boolean, auto: boolean }
interface Preview { name: string, kind: string, text: string, empty: string[], fields: Field[] }

const step = ref(1)
const STEPS = ['Шаблон', 'Предпросмотр', 'Заполнение полей', 'Подписание']
const templates = ref<Tpl[]>([])
const tq = ref('')
const scope = ref<'pipeline' | 'all'>('pipeline')
const selected = ref<string | null>(null)
const preview = ref<Preview | null>(null)
const overrides = ref<Record<string, string>>({})
const showAll = ref(false)
const sending = ref(false)
const result = ref<{ number: string, links: { client: string, agency: string }, empty: string[] } | null>(null)

watch(open, async (v) => {
  if (!v) return
  step.value = 1
  result.value = null
  preview.value = null
  showAll.value = false
  overrides.value = {}
  templates.value = await api<Tpl[]>(`/api/deals/${props.view.deal.id}/doc-templates`, { query: { kind: props.kind } })
  selected.value = props.templateId ?? templates.value.find(t => t.forPipeline)?.id ?? templates.value[0]?.id ?? null
  if (props.templateId) await goPreview()
})
const shown = computed(() => templates.value.filter(t => (scope.value === 'all' || t.forPipeline) && t.name.toLowerCase().includes(tq.value.toLowerCase())))

async function loadPreview() {
  if (!selected.value) return
  preview.value = await mutate(() => api<Preview>(`/api/deals/${props.view.deal.id}/contract-preview`, { method: 'POST', body: { templateId: selected.value, overrides: overrides.value } })) ?? null
}
async function goPreview() {
  await loadPreview()
  if (preview.value) step.value = 2
}
const emptyFields = computed(() => preview.value?.fields.filter(f => !f.value && !f.auto) ?? [])
const fieldsShown = computed(() => (showAll.value ? preview.value?.fields.filter(f => !f.auto) : emptyFields.value) ?? [])
function setField(f: Field, v: string) {
  overrides.value = { ...overrides.value, [f.field]: v }
  f.value = v
  f.manual = v !== f.fromDeal
}
function resetField(f: Field) {
  overrides.value = Object.fromEntries(Object.entries(overrides.value).filter(([k]) => k !== f.field))
  f.value = f.fromDeal
  f.manual = false
}
async function goSign() {
  await loadPreview()
  step.value = 4
}
// Highlight substituted values in the A4 preview.
const html = computed(() => {
  if (!preview.value) return ''
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  let out = esc(preview.value.text)
  const vals = [...new Set(preview.value.fields.map(f => f.value).filter(v => v && v.length > 2))].sort((a, b) => b.length - a.length)
  for (const v of vals) out = out.split(esc(v)).join(`<mark class="sub">${esc(v)}</mark>`)
  out = out.split(BLANK).join(`<mark class="blank">${BLANK}</mark>`)
  return out.split('\n').map((l, i) => (i === 0 ? `<p class="title">${l}</p>` : l ? `<p>${l}</p>` : '<br>')).join('')
})

async function send() {
  sending.value = true
  const r = await mutate(() => api<{ number: string, links: { client: string, agency: string }, empty: string[], advanced: null }>(`/api/deals/${props.view.deal.id}/contracts`, { method: 'POST', body: { templateId: selected.value, overrides: overrides.value, saveClient: true } }))
  sending.value = false
  if (r) {
    result.value = r
    emit('changed', r)
  }
}
function copy(t: string) {
  navigator.clipboard.writeText(t)
  useNotify().ok('Ссылка скопирована')
}
const waText = computed(() => result.value ? `Здравствуйте, ${props.view.client.name.split(' ')[0]}! Отправляем ${props.kind === 'receipt' ? 'расписку' : 'договор'} № ${result.value.number} на подпись: ${result.value.links.client}\nПодписать можно ЭЦП или через eGov Mobile.` : '')
async function sendWhatsApp() {
  if (props.view.chat) {
    await mutate(() => api(`/api/inbox/${props.view.chat!.id}/messages`, { method: 'POST', body: { text: waText.value } }), 'Отправлено клиенту')
  }
  else {
    window.open(`https://wa.me/${props.view.client.phone.replace(/\D/g, '')}?text=${encodeURIComponent(waText.value)}`, '_blank')
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="kind === 'receipt' ? 'Расписка на подпись' : 'Документ на подпись'"
    :ui="{ content: 'sm:max-w-4xl' }"
  >
    <template #body>
      <!-- Steps -->
      <ol class="flex items-center gap-2 mb-5 text-sm">
        <li
          v-for="(s, i) in STEPS"
          :key="s"
          class="flex items-center gap-2"
        >
          <span
            class="size-6 rounded-full grid place-items-center text-xs font-semibold"
            :class="result || step > i + 1 ? 'bg-ok text-white' : step === i + 1 ? 'bg-(--ui-primary) text-white' : 'bg-(--ui-bg-accented)'"
          >
            <UIcon
              v-if="result || step > i + 1"
              name="i-lucide-check"
              class="size-3.5"
            /><template v-else>{{ i + 1 }}</template>
          </span>
          <span :class="step === i + 1 ? 'font-medium' : 'text-(--ui-text-muted)'">{{ s }}</span>
          <UIcon
            v-if="i < STEPS.length - 1"
            name="i-lucide-chevron-right"
            class="text-(--ui-text-dimmed)"
          />
        </li>
      </ol>

      <!-- Result -->
      <div
        v-if="result"
        class="space-y-4"
      >
        <UAlert
          color="success"
          variant="subtle"
          icon="i-lucide-send"
          :title="`№ ${result.number} отправлен на подпись`"
          :description="`PDF сохранён в документах заявки.${result.empty.length ? ` Пустых полей: ${result.empty.length}.` : ''}`"
        />
        <div
          v-for="l in [{ k: 'client', t: 'Ссылка для клиента' }, { k: 'agency', t: 'Ссылка для подписанта агентства' }]"
          :key="l.k"
          class="rounded-lg border border-(--ui-border) p-3"
        >
          <p class="text-sm font-medium mb-1">
            {{ l.t }}
          </p>
          <div class="flex items-center gap-2">
            <code class="flex-1 truncate text-xs bg-(--ui-bg-muted) rounded px-2 py-1">{{ result.links[l.k as 'client' | 'agency'] }}</code>
            <UButton
              size="xs"
              variant="soft"
              icon="i-lucide-copy"
              label="Копировать"
              @click="copy(result.links[l.k as 'client' | 'agency'])"
            />
            <UButton
              v-if="l.k === 'client'"
              size="xs"
              color="success"
              icon="i-lucide-message-circle"
              label="Отправить в WhatsApp"
              @click="sendWhatsApp"
            />
            <UButton
              v-else
              size="xs"
              variant="ghost"
              icon="i-lucide-external-link"
              label="Открыть"
              :to="result.links.agency"
              target="_blank"
            />
          </div>
        </div>
        <div class="flex justify-end">
          <UButton
            label="Готово"
            @click="open = false"
          />
        </div>
      </div>

      <!-- 1. Template -->
      <div
        v-else-if="step === 1"
        class="space-y-3"
      >
        <div class="flex gap-2">
          <UInput
            v-model="tq"
            icon="i-lucide-search"
            placeholder="Поиск шаблона"
            class="flex-1"
          />
          <div class="flex rounded-lg border border-(--ui-border) p-0.5">
            <UButton
              size="sm"
              :variant="scope === 'pipeline' ? 'soft' : 'ghost'"
              :color="scope === 'pipeline' ? 'primary' : 'neutral'"
              label="Для этой воронки"
              @click="scope = 'pipeline'"
            />
            <UButton
              size="sm"
              :variant="scope === 'all' ? 'soft' : 'ghost'"
              :color="scope === 'all' ? 'primary' : 'neutral'"
              label="Все шаблоны"
              @click="scope = 'all'"
            />
          </div>
        </div>
        <div class="max-h-80 overflow-y-auto space-y-1.5">
          <button
            v-for="(t, i) in shown"
            :key="t.id"
            type="button"
            class="w-full text-left rounded-lg border px-3 py-2.5 flex items-center gap-3 transition-colors"
            :class="selected === t.id ? 'border-(--ui-primary) bg-indigo-50/60 dark:bg-indigo-500/10' : 'border-(--ui-border) hover:bg-(--ui-bg-muted)'"
            @click="selected = t.id"
          >
            <UIcon
              name="i-lucide-file-text"
              class="text-(--ui-text-muted)"
            />
            <span class="flex-1 text-sm font-medium">{{ t.name }}</span>
            <UBadge
              v-if="i === 0 && t.forPipeline"
              size="sm"
              variant="subtle"
              label="Рекомендуемый"
            />
            <span
              class="text-xs"
              :class="t.missing ? 'text-warn-text' : 'text-ok-text'"
            >{{ t.missing ? `Не хватает данных: ${t.missing}` : 'Все данные есть' }}</span>
          </button>
          <EmptyState
            v-if="!shown.length"
            text="Шаблонов нет. Добавьте их в Настройках → Шаблоны документов."
            compact
          />
        </div>
        <div class="flex justify-end">
          <UButton
            :disabled="!selected"
            label="Далее: предпросмотр"
            trailing-icon="i-lucide-arrow-right"
            @click="goPreview"
          />
        </div>
      </div>

      <!-- 2. Preview -->
      <div
        v-else-if="step === 2 && preview"
        class="space-y-3"
      >
        <div class="a4 mx-auto max-h-[55vh] overflow-y-auto">
          <!-- eslint-disable-next-line vue/no-v-html -- text is HTML-escaped in `html` before highlighting -->
          <div
            class="sheet"
            v-html="html"
          />
        </div>
        <p class="text-xs text-(--ui-text-muted)">
          <mark class="sub px-1">Подсветка</mark> — данные из заявки, <mark class="blank px-1">{{ BLANK }}</mark> — не заполнено.
        </p>
        <div class="flex justify-between">
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-arrow-left"
            label="Шаблон"
            @click="step = 1"
          />
          <UButton
            :label="emptyFields.length ? `Заполнить поля · ${emptyFields.length}` : 'Далее: проверка полей'"
            trailing-icon="i-lucide-arrow-right"
            @click="step = 3"
          />
        </div>
      </div>

      <!-- 3. Fields -->
      <div
        v-else-if="step === 3 && preview"
        class="space-y-3"
      >
        <div class="flex items-center justify-between">
          <p class="text-sm">
            {{ emptyFields.length ? `Не заполнено: ${emptyFields.length}. Данные клиента сохранятся в карточку.` : 'Все переменные заполнены.' }}
          </p>
          <UButton
            size="xs"
            variant="ghost"
            :label="showAll ? 'Только незаполненные' : 'Проверить заполнение переменных'"
            @click="showAll = !showAll"
          />
        </div>
        <div class="max-h-[50vh] overflow-y-auto space-y-2">
          <div
            v-for="f in fieldsShown"
            :key="f.field"
            class="grid grid-cols-[200px_1fr_auto] gap-3 items-center"
          >
            <span class="text-sm">{{ f.label }}<span class="block text-[11px] text-(--ui-text-dimmed)">{{ '{' + f.placeholder + '}' }}</span></span>
            <UInput
              :model-value="f.value"
              size="sm"
              :color="f.value ? 'neutral' : 'warning'"
              :highlight="!f.value"
              @update:model-value="setField(f, String($event))"
            />
            <span class="w-36 text-right">
              <UBadge
                v-if="f.manual"
                size="sm"
                variant="subtle"
                color="warning"
                label="вручную"
              />
              <UButton
                v-if="f.manual && f.fromDeal"
                size="xs"
                variant="ghost"
                label="↺ Вернуть из заявки"
                @click="resetField(f)"
              />
            </span>
          </div>
          <p
            v-if="!fieldsShown.length"
            class="text-sm text-(--ui-text-muted)"
          >
            Всё заполнено данными из заявки.
          </p>
        </div>
        <div class="flex justify-between">
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-arrow-left"
            label="Предпросмотр"
            @click="loadPreview().then(() => (step = 2))"
          />
          <UButton
            label="Далее: подписание"
            trailing-icon="i-lucide-arrow-right"
            @click="goSign"
          />
        </div>
      </div>

      <!-- 4. Sign -->
      <div
        v-else-if="step === 4 && preview"
        class="space-y-4"
      >
        <dl class="text-sm grid grid-cols-[160px_1fr] gap-y-1.5">
          <dt class="text-(--ui-text-muted)">
            Документ
          </dt><dd>{{ preview.name }}</dd>
          <dt class="text-(--ui-text-muted)">
            Клиент подписывает
          </dt><dd>{{ view.client.fullName || view.client.name }} — ЭЦП или eGov Mobile</dd>
          <dt class="text-(--ui-text-muted)">
            Агентство подписывает
          </dt><dd>директор или сотрудник с правом подписи</dd>
        </dl>
        <UAlert
          v-if="preview.empty.length"
          color="warning"
          variant="subtle"
          icon="i-lucide-alert-triangle"
          :title="`Не заполнено полей: ${preview.empty.length}`"
          description="В документе на их месте будут пустые строки для заполнения от руки."
        />
        <div class="flex justify-between">
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-arrow-left"
            label="Поля"
            @click="step = 3"
          />
          <UButton
            icon="i-lucide-send"
            :loading="sending"
            :color="preview.empty.length ? 'warning' : 'primary'"
            :label="preview.empty.length ? `Отправить без ${preview.empty.length} ${plural(preview.empty.length, 'поля', 'полей', 'полей')}` : 'Отправить на подпись'"
            @click="send"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.a4 { width: 100%; max-width: 640px; background: #fff; color: #111; box-shadow: 0 1px 3px rgba(0,0,0,.12), 0 8px 24px rgba(0,0,0,.08); border-radius: 4px; }
.sheet { padding: 40px 48px; font-family: 'Times New Roman', serif; font-size: 13px; line-height: 1.5; }
.sheet :deep(p) { margin: 0 0 6px; text-align: justify; }
.sheet :deep(.title) { text-align: center; font-weight: 700; }
:deep(mark.sub), mark.sub { background: #EEF2FF; color: #3730A3; border-radius: 3px; }
:deep(mark.blank), mark.blank { background: #FFFAEB; color: #B54708; border-radius: 3px; }
</style>
