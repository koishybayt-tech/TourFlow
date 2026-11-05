<script setup lang="ts">
defineProps<{ status: 'TODO' | 'IN_PROGRESS' | 'DONE' }>()
</script>

<template>
  <UIcon
    :name="status === 'DONE' ? 'i-lucide-check-circle-2' : status === 'IN_PROGRESS' ? 'i-lucide-loader-circle' : 'i-lucide-circle'"
    class="size-4 shrink-0"
    :class="status === 'DONE' ? 'text-ok' : status === 'IN_PROGRESS' ? 'text-(--ui-primary)' : 'text-(--ui-text-dimmed)'"
    :aria-label="status === 'DONE' ? 'Выполнена' : status === 'IN_PROGRESS' ? 'В работе' : 'Новая'"
  />
</template>
