<script setup lang="ts">
import type { DealChanged, DealView } from '~/types/deal'

const props = defineProps<{ view: DealView, num: number }>()
const emit = defineEmits<{ changed: Parameters<DealChanged> }>()
const open = defineModel<boolean>('open', { default: true })

const c = computed(() => props.view.client)
const fields = computed(() => [
  { label: 'ФИО полностью', value: c.value.fullName },
  { label: 'ИИН', value: c.value.iinMasked },
  { label: 'Дата рождения', value: c.value.birthDate ? formatDate(c.value.birthDate, { dateOnly: true }) : null },
  { label: 'Email', value: c.value.email },
  { label: 'Адрес', value: c.value.address },
])
const filled = computed(() => fields.value.filter(f => f.value).length)
const travelersReady = computed(() => props.view.travelers.filter(t => t.hasPassport).length)
const done = computed(() => !!(c.value.fullName && c.value.hasIin && c.value.address) && props.view.travelers.length >= props.view.deal.people && travelersReady.value >= props.view.travelers.length)

// Client edit
const editOpen = ref(false)
const edit = reactive({ fullName: '', iin: '', birthDate: '', email: '', address: '', pdConsent: false })
async function openEdit() {
  let iin = ''
  if (c.value.hasIin) iin = (await api<{ iin: string | null }>(`/api/clients/${c.value.id}/iin`)).iin ?? ''
  Object.assign(edit, { fullName: c.value.fullName ?? '', iin, birthDate: c.value.birthDate?.slice(0, 10) ?? '', email: c.value.email ?? '', address: c.value.address ?? '', pdConsent: !!c.value.pdConsentAt })
  editOpen.value = true
}
async function saveClient() {
  const r = await mutate(() => api<{ advanced: { dealId: string, from: string, to: string }[] }>(`/api/clients/${c.value.id}`, { method: 'PUT', body: { ...edit, birthDate: edit.birthDate || null } }), 'Данные клиента сохранены')
  if (r) {
    editOpen.value = false
    const mine = r.advanced.find(a => a.dealId === props.view.deal.id)
    emit('changed', { advanced: mine ? { moved: true, from: mine.from, to: mine.to } : null })
  }
}

// Travelers
const tOpen = ref(false)
const tEditId = ref<string | null>(null)
const t = reactive({ fullNameLatin: '', passportNo: '', passportExpiry: '', birthDate: '', isChild: false, childAge: null as number | null, visaStatus: '' })
function openTraveler(id?: string) {
  const x = id ? props.view.travelers.find(v => v.id === id) : null
  tEditId.value = id ?? null
  Object.assign(t, { fullNameLatin: x?.fullNameLatin ?? '', passportNo: '', passportExpiry: x?.passportExpiry?.slice(0, 10) ?? '', birthDate: x?.birthDate?.slice(0, 10) ?? '', isChild: x?.isChild ?? false, childAge: x?.childAge ?? null, visaStatus: x?.visaStatus ?? '' })
  tOpen.value = true
}
async function saveTraveler() {
  const payload = { ...t, passportExpiry: t.passportExpiry || null, birthDate: t.birthDate || null, childAge: t.isChild ? t.childAge : null }
  const r = await mutate(() => tEditId.value
    ? api<{ advanced: null }>(`/api/travelers/${tEditId.value}`, { method: 'PUT', body: payload })
    : api<{ advanced: null }>(`/api/deals/${props.view.deal.id}/travelers`, { method: 'POST', body: payload }), tEditId.value ? 'Турист обновлён' : 'Турист добавлен')
  if (r) {
    tOpen.value = false
    emit('changed', r)
  }
}
async function removeTraveler(id: string) {
  if (await mutate(() => api(`/api/travelers/${id}`, { method: 'DELETE' }), 'Турист удалён')) emit('changed')
}
const revealed = ref<Record<string, string>>({})
async function reveal(id: string) {
  const r = await mutate(() => api<{ passportNo: string | null }>(`/api/travelers/${id}/passport`))
  if (r?.passportNo) revealed.value[id] = r.passportNo
}
</script>

<template>
  <StepSection
    id="client"
    v-model:open="open"
    :num="num"
    title="Клиент и туристы"
    :done="done"
    :badge="`${view.travelers.length} из ${view.deal.people} внесено`"
    :summary="`${c.fullName || c.name} · данные ${filled} из 5 · туристов ${view.travelers.length}`"
  >
    <div class="flex items-center justify-between mb-3">
      <p class="text-sm font-medium">
        Заказчик · <span class="text-(--ui-text-muted) font-normal">данные {{ filled }} из 5</span>
      </p>
      <div class="flex gap-1">
        <UButton
          size="xs"
          variant="ghost"
          icon="i-lucide-pencil"
          label="Изменить"
          @click="openEdit"
        />
        <UButton
          size="xs"
          variant="ghost"
          :to="`/clients/${c.id}`"
          label="Карточка клиента →"
        />
      </div>
    </div>
    <dl class="grid gap-x-6 gap-y-2 sm:grid-cols-2 text-sm">
      <div
        v-for="f in fields"
        :key="f.label"
        class="flex justify-between gap-3 border-b border-(--ui-border-muted) pb-1.5"
      >
        <dt class="text-(--ui-text-muted)">
          {{ f.label }}
        </dt>
        <dd
          class="text-right"
          :class="!f.value && 'text-warn-text'"
        >
          {{ f.value || 'не указано' }}
        </dd>
      </div>
    </dl>

    <div class="flex items-center justify-between mt-5 mb-2">
      <p class="text-sm font-medium">
        Туристы
      </p>
      <UButton
        size="xs"
        icon="i-lucide-plus"
        variant="soft"
        label="Турист"
        @click="openTraveler()"
      />
    </div>
    <div class="overflow-x-auto">
      <table
        v-if="view.travelers.length"
        class="w-full text-sm"
      >
        <thead class="text-left text-xs text-(--ui-text-muted)">
          <tr>
            <th class="py-1.5 font-medium w-8">
              №
            </th><th class="py-1.5 font-medium">
              ФИО как в паспорте
            </th><th class="py-1.5 font-medium">
              Паспорт
            </th><th class="py-1.5 font-medium">
              Действует до
            </th><th class="py-1.5 font-medium">
              Виза
            </th><th />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(tr, i) in view.travelers"
            :key="tr.id"
            class="border-t border-(--ui-border-muted)"
          >
            <td class="py-2 text-(--ui-text-muted)">
              {{ i + 1 }}
            </td>
            <td class="py-2">
              {{ tr.fullNameLatin }} <UBadge
                v-if="tr.isChild"
                size="sm"
                variant="subtle"
                :label="`ребёнок${tr.childAge !== null ? `, ${tr.childAge}` : ''}`"
              />
            </td>
            <td class="py-2 tabular">
              <template v-if="tr.hasPassport">
                {{ revealed[tr.id] ?? tr.passportMasked }}
                <UButton
                  v-if="!revealed[tr.id]"
                  size="xs"
                  variant="ghost"
                  icon="i-lucide-eye"
                  aria-label="Показать номер паспорта (просмотр записывается в журнал)"
                  @click="reveal(tr.id)"
                />
              </template>
              <span
                v-else
                class="text-warn-text"
              >не внесён</span>
            </td>
            <td
              class="py-2 tabular"
              :class="tr.expiryWarn && 'text-bad-text font-medium'"
            >
              {{ tr.passportExpiry ? formatDate(tr.passportExpiry, { dateOnly: true }) : '—' }}
              <UTooltip
                v-if="tr.expiryWarn"
                text="Меньше 6 месяцев после поездки"
              >
                <UIcon
                  name="i-lucide-alert-triangle"
                  class="size-3.5 align-[-2px]"
                />
              </UTooltip>
            </td>
            <td class="py-2 text-(--ui-text-muted)">
              {{ tr.visaStatus || '—' }}
            </td>
            <td class="py-2 text-right whitespace-nowrap">
              <UButton
                size="xs"
                variant="ghost"
                icon="i-lucide-pencil"
                aria-label="Изменить туриста"
                @click="openTraveler(tr.id)"
              />
              <UButton
                size="xs"
                variant="ghost"
                color="error"
                icon="i-lucide-trash-2"
                aria-label="Удалить туриста"
                @click="removeTraveler(tr.id)"
              />
            </td>
          </tr>
        </tbody>
      </table>
      <p
        v-else
        class="text-sm text-(--ui-text-muted)"
      >
        Внесите туристов с паспортными данными — они нужны для визы, брони и договора.
      </p>
    </div>

    <USlideover
      v-model:open="editOpen"
      title="Данные заказчика для договора"
      description="Сохранятся в карточку клиента и применятся ко всем его заявкам."
    >
      <template #body>
        <form
          id="deal-client-form"
          class="space-y-4"
          @submit.prevent="saveClient"
        >
          <UFormField label="ФИО полностью">
            <UInput
              v-model="edit.fullName"
              class="w-full"
              autofocus
            />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField
              label="ИИН"
              hint="12 цифр"
            >
              <UInput
                v-model="edit.iin"
                inputmode="numeric"
                maxlength="12"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Дата рождения">
              <UInput
                v-model="edit.birthDate"
                type="date"
                class="w-full"
              />
            </UFormField>
          </div>
          <UFormField label="Email">
            <UInput
              v-model="edit.email"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Адрес">
            <UInput
              v-model="edit.address"
              class="w-full"
            />
          </UFormField>
          <UCheckbox
            v-model="edit.pdConsent"
            label="Клиент дал согласие на обработку персональных данных"
          />
        </form>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton
            color="neutral"
            variant="ghost"
            label="Отмена"
            @click="editOpen = false"
          />
          <UButton
            type="submit"
            form="deal-client-form"
            label="Сохранить"
          />
        </div>
      </template>
    </USlideover>

    <UModal
      v-model:open="tOpen"
      :title="tEditId ? 'Турист' : 'Новый турист'"
    >
      <template #body>
        <form
          class="space-y-4"
          @submit.prevent="saveTraveler"
        >
          <UFormField
            label="ФИО латиницей, как в паспорте"
          >
            <UInput
              v-model="t.fullNameLatin"
              placeholder="NURLANOVA AIGERIM"
              class="w-full uppercase"
              autofocus
            />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField
              label="Номер паспорта"
              :hint="tEditId ? 'оставьте пустым, чтобы не менять' : undefined"
            >
              <UInput
                v-model="t.passportNo"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Действует до">
              <UInput
                v-model="t.passportExpiry"
                type="date"
                class="w-full"
              />
            </UFormField>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Дата рождения">
              <UInput
                v-model="t.birthDate"
                type="date"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Виза">
              <UInput
                v-model="t.visaStatus"
                placeholder="запись не назначена"
                class="w-full"
              />
            </UFormField>
          </div>
          <div class="flex items-center gap-4">
            <UCheckbox
              v-model="t.isChild"
              label="Ребёнок"
            />
            <UInputNumber
              v-if="t.isChild"
              v-model="t.childAge"
              :min="0"
              :max="17"
              placeholder="Возраст"
              class="w-32"
            />
          </div>
          <div class="flex justify-end gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              label="Отмена"
              @click="tOpen = false"
            />
            <UButton
              type="submit"
              label="Сохранить"
            />
          </div>
        </form>
      </template>
    </UModal>
  </StepSection>
</template>
