<script setup lang="ts">
import { registerSchema } from '#shared/schemas/auth'

definePageMeta({ layout: 'auth' })
useHead({ title: 'Регистрация агентства — Tourflow' })

const { fetch: fetchSession } = useUserSession()
const state = reactive({ agency: '', bin: '', city: 'Алматы', owner: '', phone: '', email: '', password: '' })
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await api('/api/auth/register', { method: 'POST', body: state })
    await fetchSession()
    await useMe().refresh()
    await navigateTo('/')
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
      Регистрация агентства
    </h1>
    <p class="text-(--ui-text-muted) mt-1">
      Воронки, регламенты и шаблоны документов создадутся автоматически
    </p>
    <UForm
      :schema="registerSchema"
      :state="state"
      class="mt-6 space-y-4"
      @submit="submit"
    >
      <UFormField
        label="Название агентства"
        name="agency"
      >
        <UInput
          v-model="state.agency"
          placeholder="ТОО «Demo Travel»"
          class="w-full"
        />
      </UFormField>
      <div class="grid grid-cols-2 gap-3">
        <UFormField
          label="БИН"
          name="bin"
        >
          <UInput
            v-model="state.bin"
            inputmode="numeric"
            maxlength="12"
            placeholder="12 цифр"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Город"
          name="city"
        >
          <UInput
            v-model="state.city"
            class="w-full"
          />
        </UFormField>
      </div>
      <UFormField
        label="Владелец"
        name="owner"
      >
        <UInput
          v-model="state.owner"
          placeholder="Имя и фамилия"
          class="w-full"
        />
      </UFormField>
      <div class="grid grid-cols-2 gap-3">
        <UFormField
          label="Телефон"
          name="phone"
        >
          <UInput
            v-model="state.phone"
            placeholder="+7 701 000 00 00"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Email"
          name="email"
        >
          <UInput
            v-model="state.email"
            type="email"
            class="w-full"
          />
        </UFormField>
      </div>
      <UFormField
        label="Пароль"
        name="password"
        hint="Минимум 8 символов"
      >
        <UInput
          v-model="state.password"
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
        :loading="loading"
        label="Создать агентство"
      />
    </UForm>
    <p class="mt-6 text-sm text-(--ui-text-muted)">
      Уже есть аккаунт? <ULink
        to="/login"
        class="text-(--ui-primary) font-medium"
      >Войти</ULink>
    </p>
  </div>
</template>
