<script setup lang="ts">
import type { DealView } from '~/types/deal'

const props = defineProps<{ view: DealView }>()
const emit = defineEmits<{ changed: [] }>()
const note = ref('')
async function addNote() {
  if (!note.value.trim()) return
  if (await mutate(() => api(`/api/deals/${props.view.deal.id}/notes`, { method: 'POST', body: { text: note.value } }))) {
    note.value = ''
    emit('changed')
  }
}
const historyOpen = ref(false)
const { data: fullHistory, execute: loadHistory } = useFetch<DealView['history']>(() => `/api/deals/${props.view.deal.id}/history`, { immediate: false, default: () => [] })
async function showHistory() {
  historyOpen.value = true
  await loadHistory()
}
</script>

<template>
  <div class="space-y-4">
    <div class="card p-5">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-semibold">
          Переписка
        </h3>
        <UButton
          v-if="view.chat"
          :to="`/inbox?c=${view.chat.id}`"
          size="xs"
          variant="ghost"
          label="Открыть чат"
          trailing-icon="i-lucide-arrow-right"
        />
      </div>
      <div
        v-if="view.chat?.messages.length"
        class="space-y-2"
      >
        <div
          v-for="m in view.chat.messages"
          :key="m.id"
          class="flex"
          :class="m.direction === 'out' && 'justify-end'"
        >
          <p
            class="max-w-[85%] rounded-xl px-3 py-1.5 text-xs"
            :class="m.direction === 'out' ? 'bg-(--ui-primary) text-white' : 'bg-(--ui-bg-muted)'"
          >
            {{ m.text }}
          </p>
        </div>
      </div>
      <p
        v-else
        class="text-sm text-(--ui-text-muted)"
      >
        Переписки пока нет
      </p>
    </div>

    <div
      v-if="view.otherDeals.length"
      class="card p-5"
    >
      <h3 class="font-semibold mb-3">
        Другие заявки клиента
      </h3>
      <ul class="space-y-2">
        <li
          v-for="d in view.otherDeals"
          :key="d.id"
        >
          <NuxtLink
            :to="`/deals/${d.id}`"
            class="flex items-center gap-2 text-sm hover:text-(--ui-primary)"
          >
            <UIcon
              :name="d.status === 'won' ? 'i-lucide-check-circle-2' : d.status === 'lost' ? 'i-lucide-x-circle' : 'i-lucide-circle-dot'"
              :class="d.status === 'won' ? 'text-ok' : d.status === 'lost' ? 'text-bad' : 'text-(--ui-primary)'"
            />
            <span class="flex-1 min-w-0 truncate">№{{ d.number }} · {{ d.title }}</span>
            <span
              v-if="d.price !== null"
              class="text-xs tabular text-(--ui-text-muted)"
            >{{ formatMoney(d.price) }}</span>
          </NuxtLink>
          <p class="text-xs text-(--ui-text-muted) pl-6">
            {{ d.stage }}
          </p>
        </li>
      </ul>
    </div>

    <div class="card p-5">
      <h3 class="font-semibold mb-1">
        Заметки
      </h3>
      <p class="text-xs text-(--ui-text-muted) mb-3">
        Внутренние, клиент не видит
      </p>
      <form
        class="flex gap-1 mb-3"
        @submit.prevent="addNote"
      >
        <UInput
          v-model="note"
          size="sm"
          placeholder="Добавить заметку…"
          class="flex-1"
        />
        <UButton
          type="submit"
          size="sm"
          icon="i-lucide-plus"
          aria-label="Добавить заметку"
        />
      </form>
      <ul class="space-y-3">
        <li
          v-for="n in view.notes"
          :key="n.id"
          class="text-sm"
        >
          <p class="whitespace-pre-wrap">
            {{ n.text }}
          </p>
          <p class="text-xs text-(--ui-text-muted)">
            {{ n.author }} · {{ formatDateTime(n.createdAt) }}
          </p>
        </li>
      </ul>
    </div>

    <div class="card p-5">
      <h3 class="font-semibold mb-3">
        История
      </h3>
      <ul class="space-y-2.5">
        <li
          v-for="h in view.history"
          :key="h.id"
          class="text-sm"
        >
          <p>{{ h.text }}</p>
          <p class="text-xs text-(--ui-text-muted)">
            {{ h.actor }} · {{ formatDateTime(h.at) }}
          </p>
        </li>
      </ul>
      <UButton
        v-if="view.historyCount > view.history.length"
        class="mt-3"
        size="xs"
        variant="ghost"
        :label="`Показать всю историю · ${view.historyCount}`"
        @click="showHistory"
      />
    </div>

    <USlideover
      v-model:open="historyOpen"
      title="История заявки"
      description="Записи нельзя изменить или удалить."
    >
      <template #body>
        <ul class="space-y-3">
          <li
            v-for="h in fullHistory"
            :key="h.id"
            class="text-sm border-l-2 border-(--ui-border) pl-3"
          >
            <p>{{ h.text }}</p>
            <p class="text-xs text-(--ui-text-muted)">
              {{ h.actor }} · {{ formatDateTime(h.at) }}
            </p>
          </li>
        </ul>
      </template>
    </USlideover>
  </div>
</template>
