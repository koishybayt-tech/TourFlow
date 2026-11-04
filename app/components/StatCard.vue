<script setup lang="ts">
defineProps<{ label: string, value: string | number, hint?: string, icon?: string, to?: string, tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'error' }>()
const tones = {
  neutral: 'bg-(--ui-bg-muted) text-(--ui-text-muted)',
  primary: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300',
  success: 'bg-ok-bg text-ok-text',
  warning: 'bg-warn-bg text-warn-text',
  error: 'bg-bad-bg text-bad-text',
}
</script>

<template>
  <component
    :is="to ? resolveComponent('NuxtLink') : 'div'"
    :to="to"
    class="card p-5 flex items-start gap-4 transition-colors"
    :class="to ? 'hover:border-(--ui-primary)/40 focus-visible:outline-2 focus-visible:outline-(--ui-primary)' : ''"
  >
    <span
      v-if="icon"
      class="size-10 rounded-lg grid place-items-center shrink-0"
      :class="tones[tone || 'neutral']"
    >
      <UIcon
        :name="icon"
        class="size-5"
      />
    </span>
    <span class="min-w-0">
      <span class="block text-[12.5px] text-(--ui-text-muted)">{{ label }}</span>
      <span class="block text-2xl font-semibold tabular mt-0.5 text-(--ui-text-highlighted)">{{ value }}</span>
      <span
        v-if="hint"
        class="block text-xs text-(--ui-text-muted) mt-0.5"
      >{{ hint }}</span>
    </span>
  </component>
</template>
