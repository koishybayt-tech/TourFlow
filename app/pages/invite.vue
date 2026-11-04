<script setup lang="ts">
definePageMeta({ layout: 'auth' })
useHead({ title: 'Приглашение — Tourflow' })
const route = useRoute()
const token = String(route.query.token || '')
const { data: invite, error: loadError } = await useFetch('/api/public/invite', { query: { token } })
const { fetch: fetchSession } = useUserSession()
const state = reactive({ name: '', password: '' })
const error = ref('')
async function submit() {
  error.value = ''
  try {
    await api('/api/auth/accept-invite', { method: 'POST', body: { token, name: state.name || invite.value?.email || 'Сотрудник', password: state.password } })
    await fetchSession()
    await useMe().refresh()
    await navigateTo('/')
  }
  catch (e) {
    error.value = errorMessage(e)
  }
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-semibold">
      Приглашение в команду
    </h1>
    <UAlert
      v-if="loadError"
      class="mt-6"
      color="error"
      variant="subtle"
      title="Приглашение недействительно или устарело"
    />
    <template v-else-if="invite">
      <p class="text-(--ui-text-muted) mt-1">
        {{ invite.org }} · роль «{{ invite.role }}» · {{ invite.email }}
      </p>
      <form
        class="mt-6 space-y-4"
        @submit.prevent="submit"
      >
        <UFormField
          v-if="!invite.hasAccount"
          label="Ваше имя"
        >
          <UInput
            v-model="state.name"
            class="w-full"
          />
        </UFormField>
        <UFormField :label="invite.hasAccount ? 'Пароль от вашего аккаунта' : 'Придумайте пароль'">
          <UInput
            v-model="state.password"
            type="password"
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
          label="Принять приглашение"
        />
      </form>
    </template>
  </div>
</template>
