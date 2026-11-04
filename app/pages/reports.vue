<script setup lang="ts">
definePageMeta({ middleware: 'role', permission: 'reports' })
useHead({ title: 'Отчёты — Tourflow' })
</script>

<template>
  <ComingSoon
    title="Отчёты"
    :phase="9"
  />
</template>
