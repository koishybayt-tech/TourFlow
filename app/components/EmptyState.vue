<script setup lang="ts">
defineProps<{ icon?: string, text: string, action?: string, to?: string, compact?: boolean }>()
defineEmits<{ action: [] }>()
</script>

<template>
  <div
    class="flex flex-col items-center justify-center text-center gap-3"
    :class="compact ? 'py-8 px-4' : 'py-14 px-6'"
  >
    <span class="size-10 rounded-full bg-(--ui-bg-muted) grid place-items-center">
      <UIcon
        :name="icon || 'i-lucide-inbox'"
        class="size-5 text-(--ui-text-muted)"
      />
    </span>
    <p class="text-sm text-(--ui-text-muted) max-w-sm">
      {{ text }}
    </p>
    <UButton
      v-if="action"
      :to="to"
      size="sm"
      :label="action"
      @click="$emit('action')"
    />
  </div>
</template>
