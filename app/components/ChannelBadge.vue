<script setup lang="ts">
import type { Channel } from '#shared/domain/types'

const props = defineProps<{ channel: Channel | string }>()
const meta = computed(() => ({
  WHATSAPP: { icon: 'i-lucide-message-circle', cls: 'text-[#128C4A] bg-[#E7F8EE] dark:bg-[#25D366]/15 dark:text-[#4ADE80]' },
  INSTAGRAM: { icon: 'i-lucide-instagram', cls: 'text-[#C1185B] bg-[#FDECF3] dark:bg-[#E1306C]/15 dark:text-[#F472B6]' },
  SITE: { icon: 'i-lucide-globe', cls: 'text-(--ui-text-muted) bg-(--ui-bg-muted)' },
}[props.channel as string] ?? { icon: 'i-lucide-user-plus', cls: 'text-(--ui-text-muted) bg-(--ui-bg-muted)' }))
</script>

<template>
  <span
    class="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium"
    :class="meta.cls"
  >
    <UIcon
      :name="meta.icon"
      class="size-3.5"
    />
    {{ CHANNEL_LABELS[channel as keyof typeof CHANNEL_LABELS] ?? channel }}
  </span>
</template>
