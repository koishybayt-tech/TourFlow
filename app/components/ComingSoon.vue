<script setup lang="ts">
defineProps<{ title: string, phase: number, text?: string }>()
</script>

<template>
  <AppPage :title="title">
    <div class="card">
      <EmptyState
        icon="i-lucide-hammer"
        :text="text || `Раздел «${title}» появится в фазе ${phase}.`"
      />
    </div>
  </AppPage>
</template>
