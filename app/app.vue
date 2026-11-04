<template>
  <UApp :toaster="{ position: 'bottom-center', duration: 3200 }">
    <NuxtLoadingIndicator color="var(--ui-primary)" />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
