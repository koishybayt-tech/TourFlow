<script setup lang="ts">
interface TaskDetail {
  id: string
  title: string
  description: string | null
  status: 'TODO' | 'IN_PROGRESS' | 'DONE'
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  dueAt: string | null
  isSystem: boolean
  result: string | null
  assigneeId: string | null
  assignee: string | null
  author: string | null
  deal: { id: string, number: number, title: string, client: string } | null
  departure: { id: string, name: string } | null
  stage: string | null
  subtasks: { t: string, done: boolean }[]
  log: { at: string, text: string, actor: string }[]
  createdAt: string
  completedAt: string | null
  regulation: { stageName: string, description: string, isCurrent: boolean, nextStage: string | null, requirements: { id: string, type: string, label: string, required: boolean, done: boolean, section: string, value: string | null }[] } | null
}

const props = defineProps<{ taskId: string | null }>()
const emit = defineEmits<{ changed: [r?: { advanced?: { from: string, to: string } | null, moved?: { from: string, to: string } | null } | null], close: [] }>()
const open = computed({ get: () => !!props.taskId, set: v => !v && emit('close') })
const { me } = useMe()
const task = ref<TaskDetail | null>(null)
const result = ref('')
const subInput = ref('')
const busy = ref(false)

async function load() {
  if (!props.taskId) return
  task.value = await api<TaskDetail>(`/api/tasks/${props.taskId}`).catch((e) => {
    useNotify().fail(e)
    return null
  })
  result.value = ''
}
watch(() => props.taskId, load, { immediate: true })

const PRIO = { HIGH: { label: 'Высокий', color: 'error' }, MEDIUM: { label: 'Средний', color: 'warning' }, LOW: { label: 'Низкий', color: 'neutral' } } as const
const STATUS = { TODO: 'Новая', IN_PROGRESS: 'В работе', DONE: 'Выполнена' } as const

async function act(action: 'start' | 'complete' | 'reopen') {
  if (!task.value) return
  if (action === 'complete' && !result.value.trim()) return useNotify().fail({ data: { statusMessage: 'Опишите результат выполнения' } })
  busy.value = true
  const r = await mutate(() => api<{ moved: { from: string, to: string } | null, advanced: { from: string, to: string } | null }>(`/api/tasks/${task.value!.id}/action`, { method: 'POST', body: { action, result: result.value } }), action === 'start' ? 'Задача в работе' : action === 'complete' ? 'Задача завершена' : 'Задача возвращена в работу')
  busy.value = false
  if (r) {
    await load()
    emit('changed', r)
  }
}
async function patch(body: Record<string, unknown>) {
  if (!task.value) return
  if (await mutate(() => api(`/api/tasks/${task.value!.id}`, { method: 'PATCH', body }))) {
    await load()
    emit('changed')
  }
}
function toggleSub(i: number) {
  const subs = task.value!.subtasks.map((s, j) => (j === i ? { ...s, done: !s.done } : s))
  patch({ subtasks: subs })
}
function addSub() {
  if (!subInput.value.trim()) return
  patch({ subtasks: [...task.value!.subtasks, { t: subInput.value.trim(), done: false }] })
  subInput.value = ''
}
function remove() {
  const id = task.value!.id
  emit('close')
  undoable('Задача удалена', () => api(`/api/tasks/${id}`, { method: 'DELETE' }), { done: () => emit('changed') })
}
const dueLocal = computed(() => (task.value?.dueAt ? { d: isoDay(task.value.dueAt), t: formatTime(task.value.dueAt) } : { d: '', t: '18:00' }))
function setDue(d: string, t: string) {
  patch({ dueAt: d ? new Date(`${d}T${t || '18:00'}:00+05:00`).toISOString() : null })
}
</script>

<template>
  <USlideover
    v-model:open="open"
    :title="task?.title ?? 'Задача'"
    :ui="{ content: 'max-w-xl' }"
  >
    <template #body>
      <div
        v-if="!task"
        class="space-y-3"
      >
        <div class="skeleton h-6 w-2/3" /><div class="skeleton h-24" />
      </div>
      <div
        v-else
        class="space-y-5"
      >
        <div class="flex flex-wrap items-center gap-2">
          <UBadge
            :color="task.status === 'DONE' ? 'success' : task.status === 'IN_PROGRESS' ? 'primary' : 'neutral'"
            variant="subtle"
            :label="STATUS[task.status]"
          />
          <UBadge
            :color="PRIO[task.priority].color"
            variant="subtle"
            :label="PRIO[task.priority].label"
          />
          <UBadge
            v-if="task.isSystem"
            class="bg-sys-bg text-sys-text"
            variant="subtle"
            :label="`Системная · этап «${task.stage}»`"
          />
          <NuxtLink
            v-if="task.deal"
            :to="`/deals/${task.deal.id}`"
            class="text-sm text-(--ui-primary) ml-auto"
          >№{{ task.deal.number }} · {{ task.deal.client }} →</NuxtLink>
          <NuxtLink
            v-else-if="task.departure"
            :to="`/departures/${task.departure.id}`"
            class="text-sm text-(--ui-primary) ml-auto"
          >{{ task.departure.name }} →</NuxtLink>
        </div>

        <div
          v-if="task.isSystem"
          class="rounded-lg bg-sys-bg text-sys-text px-3 py-2 text-sm"
        >
          Создана автоматически при входе в этап. Закроется сама, когда этап завершится. Удалить или переименовать нельзя.
        </div>

        <!-- Stage regulation -->
        <div
          v-if="task.regulation"
          class="rounded-lg border border-(--ui-border) p-4 space-y-3"
        >
          <p class="text-sm font-medium">
            Регламент этапа «{{ task.regulation.stageName }}»
          </p>
          <p class="text-sm text-(--ui-text-muted)">
            {{ task.regulation.description }}
          </p>
          <ul class="space-y-1.5">
            <li
              v-for="r in task.regulation.requirements"
              :key="r.id"
              class="flex items-center gap-2 text-sm"
            >
              <UIcon
                :name="r.done ? 'i-lucide-check-circle-2' : 'i-lucide-circle'"
                :class="r.done ? 'text-ok' : 'text-(--ui-text-dimmed)'"
              />
              <span :class="r.done && 'text-(--ui-text-muted)'">{{ r.label }}<span
                v-if="!r.required"
                class="text-(--ui-text-dimmed)"
              > (необязательно)</span></span>
              <NuxtLink
                v-if="!r.done && task.deal"
                :to="`/deals/${task.deal.id}#sec-${r.section}`"
                class="ml-auto text-xs text-(--ui-primary)"
              >заполнить →</NuxtLink>
            </li>
          </ul>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Исполнитель">
            <USelect
              :model-value="task.assigneeId ?? undefined"
              :items="(me?.members ?? []).map(m => ({ value: m.id, label: m.name }))"
              class="w-full"
              @update:model-value="patch({ assigneeId: $event })"
            />
          </UFormField>
          <UFormField label="Приоритет">
            <USelect
              :model-value="task.priority"
              :items="[{ value: 'HIGH', label: 'Высокий' }, { value: 'MEDIUM', label: 'Средний' }, { value: 'LOW', label: 'Низкий' }]"
              class="w-full"
              @update:model-value="patch({ priority: $event })"
            />
          </UFormField>
          <UFormField label="Срок">
            <UInput
              type="date"
              :model-value="dueLocal.d"
              class="w-full"
              @change="setDue(($event.target as HTMLInputElement).value, dueLocal.t)"
            />
          </UFormField>
          <UFormField label="Время">
            <UInput
              type="time"
              :model-value="dueLocal.t"
              class="w-full"
              @change="setDue(dueLocal.d, ($event.target as HTMLInputElement).value)"
            />
          </UFormField>
        </div>
        <p class="text-xs text-(--ui-text-muted)">
          Автор: {{ task.author ?? 'Система' }} · создана {{ formatDateTime(task.createdAt) }}
        </p>

        <div v-if="task.description && !task.isSystem">
          <p class="text-sm font-medium mb-1">
            Описание
          </p>
          <p class="text-sm whitespace-pre-wrap">
            {{ task.description }}
          </p>
        </div>

        <div v-if="!task.isSystem">
          <p class="text-sm font-medium mb-2">
            Подзадачи
          </p>
          <ul class="space-y-1">
            <li
              v-for="(s, i) in task.subtasks"
              :key="i"
            >
              <UCheckbox
                :model-value="s.done"
                :label="s.t"
                @update:model-value="toggleSub(i)"
              />
            </li>
          </ul>
          <form
            class="flex gap-2 mt-2"
            @submit.prevent="addSub"
          >
            <UInput
              v-model="subInput"
              size="sm"
              placeholder="Добавить подзадачу"
              class="flex-1"
            />
            <UButton
              type="submit"
              size="sm"
              variant="soft"
              icon="i-lucide-plus"
              aria-label="Добавить подзадачу"
            />
          </form>
        </div>

        <div
          v-if="task.result"
          class="rounded-lg bg-ok-bg text-ok-text px-3 py-2 text-sm"
        >
          <b>Результат:</b> {{ task.result }}
        </div>

        <div>
          <p class="text-sm font-medium mb-2">
            История
          </p>
          <ul class="space-y-1.5">
            <li
              v-for="(l, i) in [...task.log].reverse()"
              :key="i"
              class="text-xs flex gap-2"
            >
              <span class="text-(--ui-text-muted) tabular w-28 shrink-0">{{ formatDateTime(l.at) }}</span><span>{{ l.text }}</span>
            </li>
          </ul>
        </div>
      </div>
    </template>
    <template #footer>
      <div
        v-if="task"
        class="w-full space-y-2"
      >
        <template v-if="task.status === 'TODO'">
          <UButton
            block
            icon="i-lucide-play"
            label="Взять в работу"
            :loading="busy"
            @click="act('start')"
          />
        </template>
        <template v-else-if="task.status === 'IN_PROGRESS'">
          <UTextarea
            v-model="result"
            :rows="2"
            placeholder="Результат выполнения (обязательно)"
            class="w-full"
          />
          <UButton
            block
            icon="i-lucide-check"
            color="success"
            :loading="busy"
            :label="task.isSystem && task.regulation?.isCurrent && task.regulation.nextStage ? `Завершить задачу → этап «${task.regulation.nextStage}»` : 'Завершить задачу'"
            @click="act('complete')"
          />
        </template>
        <UButton
          v-else
          block
          color="neutral"
          variant="outline"
          icon="i-lucide-rotate-ccw"
          label="Вернуть в работу"
          :loading="busy"
          @click="act('reopen')"
        />
        <UButton
          v-if="!task.isSystem"
          block
          size="sm"
          color="error"
          variant="ghost"
          label="Удалить задачу"
          @click="remove"
        />
      </div>
    </template>
  </USlideover>
</template>
