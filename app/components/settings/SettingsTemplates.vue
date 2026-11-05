<script setup lang="ts">
import { TEMPLATE_FIELDS, type TemplateVariable } from '#shared/domain/templates'
import { RECEIPT_CONDITION_LABELS } from '#shared/domain/receipts'

interface Tpl { id: string, kind: 'contract' | 'receipt', name: string, short: string | null, pipeline: string | null, condition: string | null, enabled: boolean, hasFile: boolean, used: number, updatedAt: string }
const { data: list, refresh } = await useFetch<Tpl[]>('/api/settings/templates', { default: () => [] })
const contracts = computed(() => list.value.filter(t => t.kind === 'contract'))
const receipts = computed(() => list.value.filter(t => t.kind === 'receipt'))

async function toggle(t: Tpl, v: boolean) {
  t.enabled = v
  await mutate(() => api(`/api/settings/templates/${t.id}`, { method: 'PATCH', body: { enabled: v } }), v ? 'Шаблон включён' : 'Шаблон выключен')
}
async function remove(t: Tpl) {
  const r = await mutate(() => api<{ disabled?: boolean }>(`/api/settings/templates/${t.id}`, { method: 'DELETE' }))
  if (r) {
    useNotify().ok(r.disabled ? 'Шаблон уже использовался — он выключен и сохранён для истории' : 'Шаблон удалён')
    refresh()
  }
}

// Wizard
const open = ref(false)
const step = ref(1)
const w = reactive({ name: '', kind: 'contract' as 'contract' | 'receipt', pipeline: 'GROUP' as string | null, condition: 'all', short: '', mode: 'file' as 'file' | 'text', text: '' })
const parsed = ref<{ fileKey: string | null, fileName: string | null, text: string, variables: TemplateVariable[] } | null>(null)
const preview = ref<{ text: string, empty: string[], deal: string } | null>(null)
const file = ref<File | null>(null)
const fieldItems = TEMPLATE_FIELDS.map(f => ({ value: f.key, label: `${f.group} · ${f.label}` }))
function start() {
  Object.assign(w, { name: '', kind: 'contract', pipeline: 'GROUP', condition: 'all', short: '', mode: 'file', text: '' })
  parsed.value = null
  preview.value = null
  file.value = null
  step.value = 1
  open.value = true
}
async function parse() {
  let r
  if (w.mode === 'file') {
    if (!file.value) return useNotify().fail({ data: { statusMessage: 'Выберите файл DOCX' } })
    const fd = new FormData()
    fd.append('file', file.value)
    r = await mutate(() => $fetch<NonNullable<typeof parsed.value>>('/api/settings/templates/parse', { method: 'POST', body: fd }))
  }
  else {
    r = await mutate(() => api<NonNullable<typeof parsed.value>>('/api/settings/templates/parse', { method: 'POST', body: { text: w.text } }))
  }
  if (r) {
    parsed.value = r
    step.value = 4
  }
}
const unbound = computed(() => parsed.value?.variables.filter(v => !v.field).length ?? 0)
const example = (key: string | null) => TEMPLATE_FIELDS.find(f => f.key === key)?.example ?? ''
async function runPreview() {
  preview.value = await mutate(() => api<NonNullable<typeof preview.value>>('/api/settings/templates/preview', { method: 'POST', body: { body: parsed.value!.fileKey ? null : parsed.value!.text, fileKey: parsed.value!.fileKey, variables: parsed.value!.variables } })) ?? null
}
async function save() {
  const r = await mutate(() => api('/api/settings/templates', {
    method: 'POST',
    body: { name: w.name, kind: w.kind, pipeline: w.kind === 'contract' ? w.pipeline : null, condition: w.kind === 'receipt' ? w.condition : null, short: w.short, body: parsed.value!.fileKey ? null : parsed.value!.text, fileKey: parsed.value!.fileKey, variables: parsed.value!.variables },
  }), 'Шаблон сохранён')
  if (r) {
    open.value = false
    refresh()
  }
}
const PIPES = [{ value: 'GROUP', label: 'Групповые туры' }, { value: 'PACKAGE', label: 'Пакетные туры' }, { value: 'BASE', label: 'Базовая' }, { value: null, label: 'Все воронки' }]
</script>

<template>
  <div class="space-y-6">
    <div class="card">
      <div class="flex items-center justify-between px-5 py-4 border-b border-(--ui-border)">
        <div>
          <h2 class="font-semibold">
            Шаблоны договоров
          </h2>
          <p class="text-sm text-(--ui-text-muted)">
            DOCX с переменными вида {Любое_Имя}. Переменные связываются с полями заявки.
          </p>
        </div>
        <UButton
          icon="i-lucide-plus"
          label="Шаблон"
          @click="start"
        />
      </div>
      <div
        v-for="t in contracts"
        :key="t.id"
        class="flex items-center gap-3 px-5 py-3 border-b border-(--ui-border-muted) last:border-0"
      >
        <UIcon
          :name="t.hasFile ? 'i-lucide-file-type-2' : 'i-lucide-file-text'"
          class="text-(--ui-text-muted)"
        />
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium truncate">
            {{ t.name }}
          </p>
          <p class="text-xs text-(--ui-text-muted)">
            {{ t.pipeline ? PIPELINE_LABELS[t.pipeline as keyof typeof PIPELINE_LABELS] : 'Все воронки' }} · {{ t.hasFile ? 'DOCX' : 'текст' }} · использован {{ t.used }} раз
          </p>
        </div>
        <USwitch
          :model-value="t.enabled"
          :aria-label="`Включить «${t.name}»`"
          @update:model-value="toggle(t, $event)"
        />
        <UButton
          size="xs"
          variant="ghost"
          color="error"
          icon="i-lucide-trash-2"
          aria-label="Удалить шаблон"
          @click="remove(t)"
        />
      </div>
    </div>

    <div class="card">
      <div class="px-5 py-4 border-b border-(--ui-border)">
        <h2 class="font-semibold">
          Расписки клиента
        </h2>
        <p class="text-sm text-(--ui-text-muted)">
          Рекомендуются в заявке по условию. Тексты — черновики, согласуйте с юристом.
        </p>
      </div>
      <div
        v-for="t in receipts"
        :key="t.id"
        class="flex items-center gap-3 px-5 py-3 border-b border-(--ui-border-muted) last:border-0"
      >
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium">
            {{ t.name }}
          </p>
          <p class="text-xs text-(--ui-text-muted)">
            {{ RECEIPT_CONDITION_LABELS[(t.condition ?? 'all') as keyof typeof RECEIPT_CONDITION_LABELS] }} · {{ t.short }}
          </p>
        </div>
        <USwitch
          :model-value="t.enabled"
          :aria-label="`Включить «${t.name}»`"
          @update:model-value="toggle(t, $event)"
        />
      </div>
    </div>

    <UModal
      v-model:open="open"
      title="Новый шаблон"
      :ui="{ content: 'sm:max-w-3xl' }"
    >
      <template #body>
        <ol class="flex gap-2 text-xs mb-4 text-(--ui-text-muted)">
          <li
            v-for="(s, i) in ['Наименование', 'Воронка', 'Файл', 'Переменные']"
            :key="s"
            :class="step === i + 1 && 'text-(--ui-primary) font-semibold'"
          >
            {{ i + 1 }}. {{ s }}<span v-if="i < 3"> →</span>
          </li>
        </ol>
        <div
          v-if="step === 1"
          class="space-y-4"
        >
          <UFormField label="Тип">
            <URadioGroup
              v-model="w.kind"
              orientation="horizontal"
              :items="[{ value: 'contract', label: 'Договор' }, { value: 'receipt', label: 'Расписка' }]"
            />
          </UFormField>
          <UFormField label="Наименование">
            <UInput
              v-model="w.name"
              class="w-full"
              placeholder="Договор на групповой визовый тур"
              autofocus
            />
          </UFormField>
          <UFormField
            v-if="w.kind === 'receipt'"
            label="Кратко (что подтверждает клиент)"
          >
            <UInput
              v-model="w.short"
              class="w-full"
            />
          </UFormField>
          <div class="flex justify-end">
            <UButton
              :disabled="w.name.trim().length < 2"
              label="Далее"
              @click="step = 2"
            />
          </div>
        </div>
        <div
          v-else-if="step === 2"
          class="space-y-4"
        >
          <UFormField
            v-if="w.kind === 'contract'"
            label="Воронка"
          >
            <USelect
              v-model="w.pipeline"
              :items="PIPES"
              class="w-full"
            />
          </UFormField>
          <UFormField
            v-else
            label="Когда рекомендовать"
          >
            <USelect
              v-model="w.condition"
              :items="Object.entries(RECEIPT_CONDITION_LABELS).map(([value, label]) => ({ value, label }))"
              class="w-full"
            />
          </UFormField>
          <div class="flex justify-between">
            <UButton
              color="neutral"
              variant="ghost"
              label="Назад"
              @click="step = 1"
            />
            <UButton
              label="Далее"
              @click="step = 3"
            />
          </div>
        </div>
        <div
          v-else-if="step === 3"
          class="space-y-4"
        >
          <URadioGroup
            v-model="w.mode"
            orientation="horizontal"
            :items="[{ value: 'file', label: 'Загрузить DOCX' }, { value: 'text', label: 'Вставить текст (из PDF или Word)' }]"
          />
          <input
            v-if="w.mode === 'file'"
            type="file"
            accept=".docx"
            class="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-(--ui-bg-accented) file:px-3 file:py-1.5"
            aria-label="Файл шаблона"
            @change="file = ($event.target as HTMLInputElement).files?.[0] ?? null"
          >
          <UTextarea
            v-else
            v-model="w.text"
            :rows="10"
            class="w-full font-mono text-xs"
            placeholder="ДОГОВОР № {contract_no}&#10;…"
          />
          <p class="text-xs text-(--ui-text-muted)">
            Переменные пишутся в фигурных скобках: {ФИО_клиента}, {client_iin}. Имя может быть любым — система подберёт поле.
          </p>
          <div class="flex justify-between">
            <UButton
              color="neutral"
              variant="ghost"
              label="Назад"
              @click="step = 2"
            />
            <UButton
              label="Разобрать переменные"
              @click="parse"
            />
          </div>
        </div>
        <div
          v-else-if="step === 4 && parsed"
          class="space-y-4"
        >
          <p class="text-sm">
            Найдено переменных: <b>{{ parsed.variables.length }}</b><template v-if="unbound">
              , не связано: <b class="text-warn-text">{{ unbound }}</b>
            </template>
          </p>
          <div class="max-h-72 overflow-y-auto">
            <table class="w-full text-sm">
              <thead class="text-left text-xs text-(--ui-text-muted)">
                <tr>
                  <th class="py-1.5 font-medium">
                    Переменная
                  </th><th class="py-1.5 font-medium">
                    Поле заявки
                  </th><th class="py-1.5 font-medium">
                    Пример
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="v in parsed.variables"
                  :key="v.placeholder"
                  class="border-t border-(--ui-border-muted)"
                  :class="!v.field && 'bg-warn-bg/60'"
                >
                  <td class="py-1.5 font-mono text-xs">
                    {{ '{' + v.placeholder + '}' }}<span
                      v-if="v.count > 1"
                      class="text-(--ui-text-muted)"
                    > ×{{ v.count }}</span>
                  </td>
                  <td class="py-1.5">
                    <USelect
                      :model-value="v.field ?? undefined"
                      :items="fieldItems"
                      placeholder="Выберите поле"
                      size="xs"
                      class="w-64"
                      @update:model-value="v.field = $event as string"
                    />
                  </td>
                  <td class="py-1.5 text-xs text-(--ui-text-muted) truncate max-w-48">
                    {{ example(v.field) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div
            v-if="preview"
            class="rounded-lg bg-white text-[#111] p-6 font-serif text-xs whitespace-pre-wrap max-h-60 overflow-y-auto border border-(--ui-border)"
          >
            <p class="text-[10px] text-[#666] mb-2 font-sans">
              Предпросмотр на заявке {{ preview.deal }}
            </p>{{ preview.text }}
          </div>
          <div class="flex justify-between">
            <UButton
              color="neutral"
              variant="ghost"
              label="Назад"
              @click="step = 3"
            />
            <div class="flex gap-2">
              <UButton
                variant="soft"
                icon="i-lucide-eye"
                label="Предпросмотр"
                :disabled="!!unbound"
                @click="runPreview"
              />
              <UButton
                :disabled="!!unbound"
                :label="unbound ? `Свяжите переменные · ${unbound}` : 'Сохранить шаблон'"
                @click="save"
              />
            </div>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
