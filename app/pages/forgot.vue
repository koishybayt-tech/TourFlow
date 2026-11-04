<script setup lang="ts">
import { forgotSchema } from '#shared/schemas/auth'

definePageMeta({ layout: 'auth' })
useHead({ title: 'Восстановление пароля — Tourflow' })
const state = reactive({ email: '' })
const sent = ref(false)
const loading = ref(false)
async function submit() {
  loading.value = true
  await mutate(() => api('/api/auth/forgot', { method: 'POST', body: state }))
  loading.value = false
  sent.value = true
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-semibold">
      Восстановление пароля
    </h1>
    <template v-if="sent">
      <UAlert
        class="mt-6"
        color="success"
        variant="subtle"
        icon="i-lucide-mail-check"
        title="Если такой email есть в системе, мы отправили на него ссылку"
        description="Ссылка действует 1 час."
      />
    </template>
    <UForm
      v-else
      :schema="forgotSchema"
      :state="state"
      class="mt-6 space-y-4"
      @submit="submit"
    >
      <UFormField
        label="Email"
        name="email"
      >
        <UInput
          v-model="state.email"
          type="email"
          class="w-full"
          autofocus
        />
      </UFormField>
      <UButton
        type="submit"
        block
        :loading="loading"
        label="Отправить ссылку"
      />
    </UForm>
    <p class="mt-6 text-sm">
      <ULink
        to="/login"
        class="text-(--ui-primary)"
      >← Ко входу</ULink>
    </p>
  </div>
</template>
