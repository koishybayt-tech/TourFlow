<script setup lang="ts">
const collapsed = ref(false)
</script>

<template>
  <div class="flex min-h-dvh bg-(--ui-bg)">
    <aside
      class="hidden lg:flex flex-col border-r border-(--ui-border) bg-(--ui-bg-elevated) transition-[width] duration-200"
      :class="collapsed ? 'w-16' : 'w-64'"
    >
      <div class="flex h-14 items-center gap-2 px-4 border-b border-(--ui-border)">
        <div class="size-7 rounded-lg bg-(--ui-primary) grid place-items-center text-white font-semibold">
          T
        </div>
        <span
          v-if="!collapsed"
          class="font-semibold"
        >{{ $t('app.name') }}</span>
        <UButton
          class="ml-auto"
          :icon="collapsed ? 'i-lucide-panel-left-open' : 'i-lucide-panel-left-close'"
          color="neutral"
          variant="ghost"
          size="sm"
          :aria-label="collapsed ? 'Развернуть меню' : 'Свернуть меню'"
          @click="collapsed = !collapsed"
        />
      </div>
      <nav class="flex-1 p-2">
        <slot name="nav" />
      </nav>
    </aside>
    <div class="flex-1 min-w-0 flex flex-col">
      <header class="h-14 flex items-center gap-3 px-6 lg:px-8 border-b border-(--ui-border) bg-(--ui-bg-elevated)">
        <slot name="header" />
      </header>
      <main class="flex-1 px-6 lg:px-8 py-6">
        <slot />
      </main>
    </div>
  </div>
</template>
