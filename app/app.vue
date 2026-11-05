<script setup lang="ts">
import { MotionConfig } from 'motion-v'

initToast()
</script>

<template>
  <UApp :toaster="{ position: 'bottom-center', duration: 3200 }">
    <MotionConfig reduced-motion="user">
      <NuxtLoadingIndicator color="var(--ui-primary)" />
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </MotionConfig>
  </UApp>
</template>
