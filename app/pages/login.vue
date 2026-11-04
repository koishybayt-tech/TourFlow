<script setup lang="ts">
import { loginSchema } from '#shared/schemas/auth'

definePageMeta({ layout: 'auth' })
useHead({ title: 'Вход — Tourflow' })

const route = useRoute()
const { fetch: fetchSession } = useUserSession()
const state = reactive({ login: '', password: '', remember: true })
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await api('/api/auth/login', { method: 'POST', body: state })
    await fetchSession()
    await useMe().refresh()
    await navigateTo(String(route.query.next || '/'))
  }
  catch (e) {
    error.value = errorMessage(e)
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-semibold">
      Вход
    </h1>
    <p class="text-(--ui-text-muted) mt-1">
      Email или телефон и пароль
    </p>
    <UForm
      :schema="loginSchema"
      :state="state"
      class="mt-6 space-y-4"
      @submit="submit"
    >
      <UFormField
        label="Email или телефон"
        name="login"
      >
        <UInput
          v-model="state.login"
          autocomplete="username"
          placeholder="erlan@demo.travel"
          class="w-full"
          autofocus
        />
      </UFormField>
      <UFormField
        label="Пароль"
        name="password"
      >
        <template #hint>
          <ULink
            to="/forgot"
            class="text-xs"
          >Забыли пароль?</ULink>
        </template>
        <UInput
          v-model="state.password"
          type="password"
          autocomplete="current-password"
          class="w-full"
        />
      </UFormField>
      <UCheckbox
        v-model="state.remember"
        label="Запомнить устройство"
      />
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        :title="error"
        icon="i-lucide-alert-circle"
      />
      <UButton
        type="submit"
        block
        :loading="loading"
        label="Войти"
      />
    </UForm>
    <p class="mt-6 text-sm text-(--ui-text-muted)">
      Нет аккаунта? <ULink
        to="/register"
        class="text-(--ui-primary) font-medium"
      >Зарегистрировать агентство</ULink>
    </p>
  </div>
</template>
