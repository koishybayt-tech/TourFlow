<script setup lang="ts">
definePageMeta({ layout: 'auth' })
useHead({ title: 'Новый пароль — Tourflow' })
const route = useRoute()
const state = reactive({ password: '', confirm: '' })
const error = ref('')
const done = ref(false)
async function submit() {
  error.value = ''
  if (state.password.length < 8) return (error.value = 'Пароль — минимум 8 символов')
  if (state.password !== state.confirm) return (error.value = 'Пароли не совпадают')
  try {
    await api('/api/auth/reset', { method: 'POST', body: { token: String(route.query.token || ''), password: state.password } })
    done.value = true
  }
  catch (e) {
    error.value = errorMessage(e)
  }
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-semibold">
      Новый пароль
    </h1>
    <UAlert
      v-if="done"
      class="mt-6"
      color="success"
      variant="subtle"
      title="Пароль изменён"
      :actions="[{ label: 'Войти', to: '/login' }]"
    />
    <form
      v-else
      class="mt-6 space-y-4"
      @submit.prevent="submit"
    >
      <UFormField label="Новый пароль">
        <UInput
          v-model="state.password"
          type="password"
          autocomplete="new-password"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Повторите пароль">
        <UInput
          v-model="state.confirm"
          type="password"
          autocomplete="new-password"
          class="w-full"
        />
      </UFormField>
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        :title="error"
      />
      <UButton
        type="submit"
        block
        label="Сохранить пароль"
      />
    </form>
  </div>
</template>
