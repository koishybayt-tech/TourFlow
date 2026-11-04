<script setup lang="ts">
const route = useRoute()
useHead({ title: 'Заявка — Tourflow' })
</script>

<template>
  <ComingSoon
    title="Заявка"
    :phase="5"
    :text="`Страница заявки ${route.params.id} появится в фазе 5.`"
  />
</template>
