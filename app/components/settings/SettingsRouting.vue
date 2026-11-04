<script setup lang="ts">
import { waLink } from '#shared/domain/routing'
import type { Pipeline } from '#shared/domain/types'

interface Settings {
  channels: Record<'WHATSAPP' | 'INSTAGRAM' | 'SITE', 'auto' | Pipeline>
  fallback: 'queue' | Pipeline
  keywords: Record<Pipeline, string[]>
  links: { tag: string, label: string, pipeline: Pipeline, departureId?: string | null }[]
}
const { data } = await useFetch<{ settings: Settings, departures: { id: string, label: string }[], whatsappPhone: string }>('/api/settings/routing')
const s = reactive<Settings>(structuredClone(toRaw(data.value!.settings)))
const kw = reactive<Record<Pipeline, string>>({ GROUP: s.keywords.GROUP.join(', '), PACKAGE: s.keywords.PACKAGE.join(', '), BASE: s.keywords.BASE.join(', ') })
const PIPES = [{ value: 'GROUP', label: 'Групповые туры' }, { value: 'PACKAGE', label: 'Пакетные туры' }, { value: 'BASE', label: 'Базовая' }]
const CHANNEL_ITEMS = [{ value: 'auto', label: 'По ключевым словам' }, ...PIPES]
const saving = ref(false)

async function save() {
  saving.value = true
  const body = { ...s, keywords: Object.fromEntries(Object.entries(kw).map(([k, v]) => [k, v.split(',').map(x => x.trim()).filter(Boolean)])) }
  await mutate(() => api('/api/settings/routing', { method: 'PUT', body }), 'Правила распределения сохранены')
  saving.value = false
}
function addLink() {
  s.links.push({ tag: `T${s.links.length + 1}`, label: '', pipeline: 'GROUP', departureId: null })
}
function copy(text: string) {
  navigator.clipboard.writeText(text)
  useNotify().ok('Ссылка скопирована')
}

// Test
const test = reactive({ text: 'Хотим в Турцию в январе, всё включено, 5 звёзд', channel: 'INSTAGRAM' })
const result = ref<{ pipeline: { pipeline: Pipeline | null, confidence: number, rule: string, matched: string[] }, direction: { name: string, matched: string[] } | null, manager: { name: string | null, reason: string } } | null>(null)
async function runTest() {
  result.value = await mutate(() => api('/api/settings/routing-test', { method: 'POST', body: test })) ?? null
}
const REASONS: Record<string, string> = { direction: 'ответственный направления', round: 'по очереди', backup: 'резерв — основные в отпуске', default: 'по умолчанию', none: 'не назначен' }
</script>

<template>
  <div class="space-y-6">
    <div class="card p-5 space-y-4">
      <div>
        <h2 class="font-semibold">
          Порядок определения воронки
        </h2>
        <p class="text-sm text-(--ui-text-muted)">
          1) метка из ссылки в первом сообщении (100%) → 2) правило канала (95%) → 3) ключевые слова (55 + 15 за совпадение, до 92%) → 4) запасной вариант.
        </p>
      </div>
      <div class="grid gap-3 md:grid-cols-4">
        <UFormField
          v-for="ch in (['WHATSAPP', 'INSTAGRAM', 'SITE'] as const)"
          :key="ch"
          :label="CHANNEL_LABELS[ch]"
        >
          <USelect
            v-model="s.channels[ch]"
            :items="CHANNEL_ITEMS"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Если правила не сработали">
          <USelect
            v-model="s.fallback"
            :items="[{ value: 'queue', label: 'Очередь «Без воронки»' }, ...PIPES]"
            class="w-full"
          />
        </UFormField>
      </div>
      <UFormField
        v-for="p in PIPES"
        :key="p.value"
        :label="`Ключевые слова: ${p.label}`"
        hint="через запятую, начало слова"
      >
        <UTextarea
          v-model="kw[p.value as Pipeline]"
          :rows="2"
          class="w-full"
        />
      </UFormField>
    </div>

    <div class="card">
      <div class="flex items-center justify-between px-5 py-4 border-b border-(--ui-border)">
        <div>
          <h2 class="font-semibold">
            Ссылки с метками
          </h2>
          <p class="text-sm text-(--ui-text-muted)">
            Разместите ссылку в Instagram или на сайте: первое сообщение придёт с меткой, и заявка сразу попадёт в нужную воронку и выезд.
          </p>
        </div>
        <UButton
          icon="i-lucide-plus"
          variant="soft"
          label="Ссылка"
          @click="addLink"
        />
      </div>
      <div
        v-for="(l, i) in s.links"
        :key="i"
        class="px-5 py-4 border-b border-(--ui-border-muted) space-y-2"
      >
        <div class="grid gap-3 md:grid-cols-[120px_1fr_180px_1fr_auto] items-end">
          <UFormField label="Метка">
            <UInput
              v-model="l.tag"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Текст сообщения">
            <UInput
              v-model="l.label"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Воронка">
            <USelect
              v-model="l.pipeline"
              :items="PIPES"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Выезд">
            <USelect
              v-model="l.departureId"
              :items="[{ value: null, label: '—' }, ...(data?.departures ?? []).map(d => ({ value: d.id, label: d.label }))]"
              :disabled="l.pipeline !== 'GROUP'"
              class="w-full"
            />
          </UFormField>
          <UButton
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            aria-label="Удалить ссылку"
            @click="s.links.splice(i, 1)"
          />
        </div>
        <div class="flex items-center gap-2 text-xs text-(--ui-text-muted)">
          <code class="truncate">{{ waLink(data?.whatsappPhone ?? '', l.label, l.tag) }}</code>
          <UButton
            size="xs"
            variant="ghost"
            icon="i-lucide-copy"
            label="Копировать"
            @click="copy(waLink(data?.whatsappPhone ?? '', l.label, l.tag))"
          />
        </div>
      </div>
      <div class="flex justify-end px-5 py-4">
        <UButton
          :loading="saving"
          label="Сохранить правила"
          @click="save"
        />
      </div>
    </div>

    <div class="card p-5 space-y-3">
      <h2 class="font-semibold">
        Проверить распределение
      </h2>
      <div class="grid gap-3 md:grid-cols-[1fr_180px_auto] items-end">
        <UFormField label="Текст первого сообщения">
          <UInput
            v-model="test.text"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Канал">
          <USelect
            v-model="test.channel"
            :items="[{ value: 'WHATSAPP', label: 'WhatsApp' }, { value: 'INSTAGRAM', label: 'Instagram' }, { value: 'SITE', label: 'Сайт' }]"
            class="w-full"
          />
        </UFormField>
        <UButton
          label="Проверить"
          variant="soft"
          @click="runTest"
        />
      </div>
      <p class="text-xs text-(--ui-text-muted)">
        Проверяются сохранённые правила.
      </p>
      <UAlert
        v-if="result"
        color="primary"
        variant="subtle"
        icon="i-lucide-route"
        :title="result.pipeline.pipeline ? `${PIPELINE_LABELS[result.pipeline.pipeline]} · ${result.pipeline.confidence}%` : 'Очередь «Без воронки»'"
        :description="[
          result.pipeline.matched.length ? `Совпадения: ${result.pipeline.matched.join(', ')}` : '',
          result.direction ? `Направление: ${result.direction.name}` : 'Направление не определено',
          `Ответственный: ${result.manager.name ?? '—'} (${REASONS[result.manager.reason]})`,
        ].filter(Boolean).join(' · ')"
      />
    </div>
  </div>
</template>
