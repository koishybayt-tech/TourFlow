<script setup lang="ts">
import { companySchema } from '#shared/schemas/settings'

const { data } = await useFetch('/api/settings/company')
const state = reactive({ ...(data.value as object) } as Record<string, string | number | null>)
const saving = ref(false)
async function save() {
  saving.value = true
  await mutate(() => api('/api/settings/company', { method: 'PUT', body: state }), 'Реквизиты сохранены')
  saving.value = false
}
const fields: [string, string, string?][] = [
  ['name', 'Название'], ['bin', 'БИН', '12 цифр'], ['director', 'Директор'], ['legalAddress', 'Юридический адрес'],
  ['bank', 'Банк'], ['iik', 'ИИК', 'KZ и 18 символов'], ['bik', 'БИК'], ['license', 'Лицензия турагента'],
  ['phone', 'Телефон'], ['email', 'Email'], ['instagram', 'Instagram'],
]
</script>

<template>
  <UForm
    :schema="companySchema"
    :state="state"
    class="card p-5 space-y-5"
    @submit="save"
  >
    <div>
      <h2 class="font-semibold">
        Реквизиты компании
      </h2>
      <p class="text-sm text-(--ui-text-muted)">
        Подставляются в договоры и расписки.
      </p>
    </div>
    <div class="grid gap-4 md:grid-cols-2">
      <UFormField
        v-for="[key, label, hint] in fields"
        :key="key"
        :label="label"
        :name="key"
        :hint="hint"
      >
        <UInput
          v-model="state[key] as string"
          class="w-full"
        />
      </UFormField>
    </div>
    <UFormField
      label="Правило возврата (для договоров)"
      name="refundRule"
    >
      <UTextarea
        v-model="state.refundRule as string"
        :rows="3"
        class="w-full"
      />
    </UFormField>
    <UFormField
      label="Удержание при возврате по умолчанию, %"
      name="refundHoldPct"
    >
      <UInputNumber
        v-model="state.refundHoldPct as number"
        :min="0"
        :max="100"
        class="w-40"
      />
    </UFormField>
    <div class="flex justify-end">
      <UButton
        type="submit"
        :loading="saving"
        label="Сохранить"
      />
    </div>
  </UForm>
</template>
