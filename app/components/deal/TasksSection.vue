<script setup lang="ts">
import type { DealChanged, DealView } from '~/types/deal'

const props = defineProps<{ view: DealView, num: number }>()
const emit = defineEmits<{ changed: Parameters<DealChanged>, openTask: [id: string] }>()
const open = defineModel<boolean>('open', { default: true })
const openCount = computed(() => props.view.tasks.filter(t => t.status !== 'DONE').length)
const newOpen = ref(false)
</script>

<template>
  <StepSection
    id="tasks"
    v-model:open="open"
    :num="num"
    title="Задачи"
    :badge="`${openCount} открыто`"
    :summary="`${view.tasks.length} задач, открыто ${openCount}`"
  >
    <ul class="divide-y divide-(--ui-border-muted)">
      <li
        v-for="t in view.tasks"
        :key="t.id"
      >
        <button
          class="w-full flex items-center gap-3 py-2 text-left hover:bg-(--ui-bg-muted) -mx-2 px-2 rounded"
          @click="emit('openTask', t.id)"
        >
          <TaskStatusIcon :status="t.status" />
          <span
            class="flex-1 min-w-0 truncate text-sm"
            :class="t.status === 'DONE' && 'line-through text-(--ui-text-muted)'"
          >{{ t.title }}</span>
          <UBadge
            v-if="t.isSystem"
            size="sm"
            class="bg-sys-bg text-sys-text"
            variant="subtle"
            :label="`Системная · ${t.stage}`"
          />
          <UBadge
            v-else-if="t.stage"
            size="sm"
            variant="subtle"
            color="neutral"
            :label="`этап «${t.stage}»`"
          />
          <span class="text-xs text-(--ui-text-muted) w-24 text-right">{{ t.assignee ?? '—' }}</span>
          <span class="text-xs tabular w-16 text-right text-(--ui-text-muted)">{{ relativeDay(t.dueAt) }}</span>
        </button>
      </li>
    </ul>
    <UButton
      class="mt-3"
      size="sm"
      icon="i-lucide-plus"
      variant="soft"
      label="Задача"
      @click="newOpen = true"
    />
    <TaskNewModal
      v-model:open="newOpen"
      :deal-id="view.deal.id"
      :stage-name="view.status.stageName"
      @created="emit('changed')"
    />
  </StepSection>
</template>
