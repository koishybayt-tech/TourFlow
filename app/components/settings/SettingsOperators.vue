<script setup lang="ts">
interface Op { id: string, name: string, paymentTerms: string, commissionPct: number, contact: string | null, bookings: number }
const { data: ops, refresh } = await useFetch<Op[]>('/api/operators', { default: () => [] })
const open = ref(false)
const editId = ref<string | null>(null)
const f = reactive({ name: '', paymentTerms: '', commissionPct: 10, contact: '' })
function edit(o?: Op) {
  editId.value = o?.id ?? null
  Object.assign(f, { name: o?.name ?? '', paymentTerms: o?.paymentTerms ?? '', commissionPct: o?.commissionPct ?? 10, contact: o?.contact ?? '' })
  open.value = true
}
async function save() {
  if (await mutate(() => editId.value ? api(`/api/operators/${editId.value}`, { method: 'PUT', body: f }) : api('/api/operators', { method: 'POST', body: f }), 'Туроператор сохранён')) {
    open.value = false
    refresh()
  }
}
</script>

<template>
  <div class="card">
    <div class="flex items-center justify-between px-5 py-4 border-b border-(--ui-border)">
      <div>
        <h2 class="font-semibold">
          Туроператоры
        </h2>
        <p class="text-sm text-(--ui-text-muted)">
          Условия оплаты определяют дедлайн брони, комиссия — наценку в подборке.
        </p>
      </div>
      <UButton
        icon="i-lucide-plus"
        label="Оператор"
        @click="edit()"
      />
    </div>
    <div
      v-for="o in ops"
      :key="o.id"
      class="flex items-center gap-3 px-5 py-3 border-b border-(--ui-border-muted) last:border-0"
    >
      <div class="flex-1 min-w-0">
        <p class="font-medium text-sm">
          {{ o.name }} <span class="text-(--ui-text-muted) font-normal">· комиссия {{ o.commissionPct }}% · броней {{ o.bookings }}</span>
        </p>
        <p class="text-xs text-(--ui-text-muted)">
          {{ o.paymentTerms }}<template v-if="o.contact">
            · {{ o.contact }}
          </template>
        </p>
      </div>
      <UButton
        size="xs"
        variant="ghost"
        icon="i-lucide-pencil"
        aria-label="Изменить"
        @click="edit(o)"
      />
    </div>
    <UModal
      v-model:open="open"
      :title="editId ? 'Туроператор' : 'Новый туроператор'"
    >
      <template #body>
        <form
          class="space-y-4"
          @submit.prevent="save"
        >
          <UFormField label="Название">
            <UInput
              v-model="f.name"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Условия оплаты">
            <UInput
              v-model="f.paymentTerms"
              placeholder="Полная оплата за 14 дней до вылета"
              class="w-full"
            />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Комиссия по умолчанию, %">
              <UInputNumber
                v-model="f.commissionPct"
                :min="0"
                :max="50"
                :step="0.5"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Контакт">
              <UInput
                v-model="f.contact"
                class="w-full"
              />
            </UFormField>
          </div>
          <div class="flex justify-end">
            <UButton
              type="submit"
              label="Сохранить"
            />
          </div>
        </form>
      </template>
    </UModal>
  </div>
</template>
