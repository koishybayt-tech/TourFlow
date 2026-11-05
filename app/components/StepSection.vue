<script setup lang="ts">
/** Numbered collapsible block of the deal page. Done blocks collapse to one summary line. */
const props = defineProps<{ id: string, num: number, title: string, done?: boolean, summary?: string, badge?: string }>()
const open = defineModel<boolean>('open', { default: true })
const bodyId = computed(() => `${props.id}-body`)
</script>

<template>
  <section
    :id="`sec-${id}`"
    class="card scroll-mt-28"
  >
    <button
      type="button"
      class="w-full flex items-center gap-3 px-5 py-4 text-left"
      :aria-expanded="open"
      :aria-controls="bodyId"
      @click="open = !open"
    >
      <span
        class="size-6 shrink-0 rounded-full grid place-items-center text-xs font-semibold transition-colors duration-200"
        :class="done ? 'bg-ok text-white' : 'bg-(--ui-bg-accented) text-(--ui-text-toned)'"
      >
        <UIcon
          v-if="done"
          name="i-lucide-check"
          class="size-3.5 step-check"
        />
        <template v-else>{{ num }}</template>
      </span>
      <span class="font-semibold text-[15px]">{{ title }}</span>
      <UBadge
        v-if="badge"
        size="sm"
        variant="subtle"
        :color="done ? 'success' : 'neutral'"
        :label="badge"
      />
      <span
        v-if="!open && summary"
        class="min-w-0 flex-1 truncate text-sm text-(--ui-text-muted)"
      >{{ summary }}</span>
      <span
        v-else
        class="flex-1"
      />
      <slot name="actions" />
      <UIcon
        name="i-lucide-chevron-down"
        class="size-4 text-(--ui-text-muted) transition-transform duration-200"
        :class="open ? 'rotate-180' : ''"
      />
    </button>
    <div
      :id="bodyId"
      class="grid transition-[grid-template-rows] duration-200 ease-out"
      :class="open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
    >
      <div class="overflow-hidden">
        <div class="px-5 pb-5">
          <slot />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.step-check { animation: pop 300ms ease-out; }
@keyframes pop { 0% { transform: scale(.4); } 70% { transform: scale(1.25); } 100% { transform: scale(1); } }
@media (prefers-reduced-motion: reduce) { .step-check { animation: none; } }
</style>
