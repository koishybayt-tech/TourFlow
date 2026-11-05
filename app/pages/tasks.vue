<script setup lang="ts">
definePageMeta({ middleware: 'role', permission: 'tasks' })
useHead({ title: 'Задачи — Tourflow' })

interface TaskRow {
  id: string
  title: string
  status: 'TODO' | 'IN_PROGRESS' | 'DONE'
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  dueAt: string | null
  isSystem: boolean
  assignee: string | null
  author: string | null
  deal: { id: string, number: number, title: string, client: string } | null
  departure: { id: string, name: string } | null
  stage: string | null
  subtasks: { t: string, done: boolean }[]
}

const route = useRoute()
const router = useRouter()
const { me } = useMe()
const { isOwner } = usePermissions()
const quick = computed({ get: () => String(route.query.quick || 'all'), set: v => router.replace({ query: { ...route.query, quick: v } }) })
const view = computed({ get: () => String(route.query.view || 'list'), set: v => router.replace({ query: { ...route.query, view: v } }) })
const q = ref('')
const assignee = ref('all')
const priority = ref('all')
const link = ref('all')
const hideDone = ref(true)
const query = computed(() => ({
  quick: quick.value,
  q: refDebounced(q, 250).value || undefined,
  assignee: assignee.value === 'all' ? undefined : assignee.value,
  priority: priority.value === 'all' ? undefined : priority.value,
  link: link.value,
  hideDone: String(hideDone.value && view.value === 'list'),
}))
const { data: tasks, refresh } = await useFetch<TaskRow[]>('/api/tasks', { query, default: () => [] })
useLiveListener((e) => {
  if (e.type === 'task' || e.type === 'deal') refresh()
})

const taskId = computed({ get: () => (route.query.task as string) || null, set: v => router.replace({ query: { ...route.query, task: v ?? undefined } }) })

const today = startOfAlmatyDay()
const tomorrow = new Date(today.getTime() + 86_400_000)
const week = new Date(today.getTime() + 7 * 86_400_000)
const groups = computed(() => {
  const g: { key: string, label: string, items: TaskRow[], tone?: string }[] = [
    { key: 'overdue', label: 'Просрочено', items: [], tone: 'text-bad-text' },
    { key: 'today', label: 'Сегодня', items: [] },
    { key: 'tomorrow', label: 'Завтра', items: [] },
    { key: 'week', label: 'На неделе', items: [] },
    { key: 'later', label: 'Позже', items: [] },
    { key: 'nodate', label: 'Без срока', items: [] },
    { key: 'done', label: 'Выполнено', items: [] },
  ]
  const by = Object.fromEntries(g.map(x => [x.key, x]))
  for (const t of tasks.value) {
    if (t.status === 'DONE') by.done!.items.push(t)
    else if (!t.dueAt) by.nodate!.items.push(t)
    else {
      const d = new Date(t.dueAt)
      if (d < today) by.overdue!.items.push(t)
      else if (d < tomorrow) by.today!.items.push(t)
      else if (d < new Date(tomorrow.getTime() + 86_400_000)) by.tomorrow!.items.push(t)
      else if (d < week) by.week!.items.push(t)
      else by.later!.items.push(t)
    }
  }
  return g.filter(x => x.items.length)
})
const columns = computed(() => [
  { key: 'TODO', label: 'Новые', items: tasks.value.filter(t => t.status === 'TODO') },
  { key: 'IN_PROGRESS', label: 'В работе', items: tasks.value.filter(t => t.status === 'IN_PROGRESS') },
  { key: 'DONE', label: 'Выполнены', items: tasks.value.filter(t => t.status === 'DONE') },
])
const PRIO_DOT: Record<string, string> = { HIGH: 'bg-bad', MEDIUM: 'bg-warn', LOW: 'bg-(--ui-border)' }
const newOpen = ref(false)
const QUICK = [{ value: 'all', label: 'Все' }, { value: 'mine', label: 'Мои' }, { value: 'today', label: 'Сегодня' }, { value: 'overdue', label: 'Просроченные' }]
</script>

<template>
  <AppPage
    title="Задачи"
    :subtitle="`${tasks.length} в списке`"
  >
    <template #actions>
      <UButton
        icon="i-lucide-plus"
        label="Задача"
        @click="newOpen = true"
      />
    </template>

    <div class="flex flex-wrap items-center gap-3">
      <div class="flex rounded-lg border border-(--ui-border) p-0.5 bg-(--ui-bg-elevated)">
        <UButton
          v-for="x in QUICK"
          :key="x.value"
          size="sm"
          :variant="quick === x.value ? 'soft' : 'ghost'"
          :color="quick === x.value ? 'primary' : 'neutral'"
          :label="x.label"
          @click="quick = x.value"
        />
      </div>
      <UInput
        v-model="q"
        size="sm"
        icon="i-lucide-search"
        placeholder="Поиск задачи"
        class="w-52"
      />
      <USelect
        v-if="isOwner"
        v-model="assignee"
        size="sm"
        :items="[{ value: 'all', label: 'Все исполнители' }, ...(me?.members ?? []).map(m => ({ value: m.id, label: m.name }))]"
        class="w-44"
      />
      <USelect
        v-model="priority"
        size="sm"
        :items="[{ value: 'all', label: 'Любой приоритет' }, { value: 'HIGH', label: 'Высокий' }, { value: 'MEDIUM', label: 'Средний' }, { value: 'LOW', label: 'Низкий' }]"
        class="w-40"
      />
      <USelect
        v-model="link"
        size="sm"
        :items="[{ value: 'all', label: 'Любая связь' }, { value: 'deal', label: 'С заявкой' }, { value: 'departure', label: 'С выездом' }, { value: 'none', label: 'Без связи' }]"
        class="w-36"
      />
      <UCheckbox
        v-if="view === 'list'"
        v-model="hideDone"
        label="Скрыть выполненные"
      />
      <div class="ml-auto flex rounded-lg border border-(--ui-border) p-0.5 bg-(--ui-bg-elevated)">
        <UButton
          size="sm"
          icon="i-lucide-list"
          :variant="view === 'list' ? 'soft' : 'ghost'"
          :color="view === 'list' ? 'primary' : 'neutral'"
          label="Список"
          @click="view = 'list'"
        />
        <UButton
          size="sm"
          icon="i-lucide-columns-3"
          :variant="view === 'kanban' ? 'soft' : 'ghost'"
          :color="view === 'kanban' ? 'primary' : 'neutral'"
          label="Канбан"
          @click="view = 'kanban'"
        />
      </div>
    </div>

    <div
      v-if="view === 'list'"
      class="space-y-4"
    >
      <div
        v-for="g in groups"
        :key="g.key"
        class="card"
      >
        <p
          class="px-5 pt-4 pb-2 text-xs font-semibold uppercase tracking-wide"
          :class="g.tone ?? 'text-(--ui-text-muted)'"
        >
          {{ g.label }} · {{ g.items.length }}
        </p>
        <ul>
          <li
            v-for="t in g.items"
            :key="t.id"
          >
            <button
              class="w-full flex items-center gap-3 px-5 py-2.5 text-left hover:bg-(--ui-bg-muted) border-t border-(--ui-border-muted)"
              @click="taskId = t.id"
            >
              <TaskStatusIcon :status="t.status" />
              <span
                class="size-2 rounded-full shrink-0"
                :class="PRIO_DOT[t.priority]"
              />
              <span class="flex-1 min-w-0">
                <span
                  class="block truncate text-sm"
                  :class="t.status === 'DONE' && 'line-through text-(--ui-text-muted)'"
                >{{ t.title }}</span>
                <span class="block truncate text-xs text-(--ui-text-muted)">
                  <template v-if="t.deal">№{{ t.deal.number }} · {{ t.deal.client }}</template>
                  <template v-else-if="t.departure">{{ t.departure.name }}</template>
                  <template v-if="t.subtasks.length"> · {{ t.subtasks.filter(s => s.done).length }}/{{ t.subtasks.length }}</template>
                </span>
              </span>
              <UBadge
                v-if="t.isSystem"
                size="sm"
                class="bg-sys-bg text-sys-text"
                variant="subtle"
                :label="`Системная · ${t.stage}`"
              />
              <span class="text-xs text-(--ui-text-muted) w-24 text-right truncate">{{ t.assignee ?? '—' }}</span>
              <span
                class="text-xs tabular w-24 text-right"
                :class="t.dueAt && t.status !== 'DONE' && new Date(t.dueAt) < today ? 'text-bad-text font-medium' : 'text-(--ui-text-muted)'"
              >{{ t.dueAt ? `${relativeDay(t.dueAt)} ${formatTime(t.dueAt)}` : '' }}</span>
            </button>
          </li>
        </ul>
      </div>
      <div
        v-if="!groups.length"
        class="card"
      >
        <EmptyState
          icon="i-lucide-check-check"
          text="Задач нет. Хороший день!"
          action="Создать задачу"
          @action="newOpen = true"
        />
      </div>
    </div>

    <div
      v-else
      class="grid gap-4 md:grid-cols-3 items-start"
    >
      <div
        v-for="c in columns"
        :key="c.key"
        class="rounded-xl bg-(--ui-bg-muted) p-2"
      >
        <p class="px-2 py-1.5 text-sm font-semibold flex justify-between">
          {{ c.label }}<UBadge
            size="sm"
            variant="subtle"
            color="neutral"
            :label="String(c.items.length)"
          />
        </p>
        <div class="space-y-2">
          <button
            v-for="t in c.items"
            :key="t.id"
            class="card w-full text-left p-3 hover:border-(--ui-primary)/40"
            @click="taskId = t.id"
          >
            <p class="text-sm font-medium flex items-start gap-2">
              <span
                class="size-2 rounded-full shrink-0 mt-1.5"
                :class="PRIO_DOT[t.priority]"
              />{{ t.title }}
            </p>
            <p
              v-if="t.deal"
              class="text-xs text-(--ui-text-muted) mt-1"
            >
              №{{ t.deal.number }} · {{ t.deal.client }}
            </p>
            <div class="flex justify-between text-xs text-(--ui-text-muted) mt-2">
              <span>{{ t.assignee ?? '—' }}</span><span>{{ relativeDay(t.dueAt) }}</span>
            </div>
          </button>
        </div>
      </div>
    </div>

    <TaskSlideover
      :task-id="taskId"
      @close="taskId = null"
      @changed="refresh(); refreshNuxtData('badges')"
    />
    <TaskNewModal
      v-model:open="newOpen"
      @created="refresh()"
    />
  </AppPage>
</template>
