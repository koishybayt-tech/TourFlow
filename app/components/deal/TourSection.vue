<script setup lang="ts">
import type { DealChanged, DealView } from '~/types/deal'

const props = defineProps<{ view: DealView, num: number }>()
const emit = defineEmits<{ changed: Parameters<DealChanged> }>()
const open = defineModel<boolean>('open', { default: true })
const d = computed(() => props.view.deal)
const isGroup = computed(() => d.value.pipeline === 'GROUP')
const isPackage = computed(() => d.value.pipeline === 'PACKAGE')

async function patch(body: Record<string, unknown>) {
  const r = await mutate(() => api<{ advanced: null }>(`/api/deals/${d.value.id}`, { method: 'PATCH', body }))
  if (r) emit('changed', r)
}
const done = computed(() => {
  const reqs = props.view.status.requirements.filter(r => r.section === 'tour')
  return reqs.length ? reqs.every(r => r.done) : !!(d.value.dates && (isGroup.value ? props.view.departure : true))
})
const summary = computed(() => [props.view.departure ? `${props.view.departure.name}, ${props.view.departure.dates}` : d.value.title, `${d.value.people} чел.`, d.value.budget].filter(Boolean).join(' · '))
const freeFieldReqs = computed(() => props.view.status.requirements.filter(r => r.type === 'FIELD' && !r.config.field))
</script>

<template>
  <StepSection
    id="tour"
    v-model:open="open"
    :num="num"
    title="Тур"
    :done="done"
    :summary="summary"
  >
    <div class="grid gap-4 md:grid-cols-2">
      <UFormField
        v-if="isGroup"
        label="Выезд"
        class="md:col-span-2"
      >
        <div class="flex gap-2">
          <USelect
            :model-value="view.departure?.id ?? undefined"
            :items="view.departures.map(x => ({ value: x.id, label: `${x.label} · ${formatMoney(x.price)}` }))"
            placeholder="Выберите выезд"
            class="flex-1"
            @update:model-value="patch({ departureId: $event })"
          />
          <UButton
            v-if="view.departure"
            :to="`/departures/${view.departure.id}`"
            variant="ghost"
            label="Выезд →"
          />
        </div>
        <p
          v-if="view.departure"
          class="text-xs text-(--ui-text-muted) mt-1"
        >
          Цена = {{ formatMoney(view.departure.price) }} × {{ d.people }} чел. = {{ formatMoney(view.departure.price * d.people) }}<template v-if="view.departure.guide">
            · гид {{ view.departure.guide }}
          </template>
        </p>
      </UFormField>
      <UFormField
        v-if="!isGroup"
        label="Запрос"
        class="md:col-span-2"
      >
        <UInput
          :model-value="d.title"
          class="w-full"
          @change="patch({ title: ($event.target as HTMLInputElement).value })"
        />
      </UFormField>
      <UFormField
        v-if="!isGroup || !view.departure"
        label="Даты"
      >
        <UInput
          :model-value="d.dates ?? ''"
          placeholder="Например: 14–21 ноября"
          class="w-full"
          @change="patch({ dates: ($event.target as HTMLInputElement).value || null })"
        />
      </UFormField>
      <UFormField label="Количество человек">
        <UInputNumber
          :model-value="d.people"
          :min="1"
          :max="99"
          class="w-full"
          @update:model-value="v => v && v !== d.people && patch({ people: v })"
        />
      </UFormField>
      <UFormField
        v-if="d.pipeline !== 'BASE'"
        label="Бюджет клиента"
      >
        <UInput
          :model-value="d.budget ?? ''"
          placeholder="до 1 500 000 ₸"
          class="w-full"
          @change="patch({ budget: ($event.target as HTMLInputElement).value || null })"
        />
      </UFormField>
      <UFormField
        v-if="isGroup"
        label="Визовая история"
      >
        <UInput
          :model-value="d.visaHistory ?? ''"
          placeholder="Шенген был в 2024"
          class="w-full"
          @change="patch({ visaHistory: ($event.target as HTMLInputElement).value || null })"
        />
      </UFormField>
      <UFormField
        v-for="r in freeFieldReqs"
        :key="r.id"
        :label="r.label"
      >
        <UInput
          :model-value="d.reqValues[r.id] ?? ''"
          class="w-full"
          @change="patch({ reqValues: { [r.id]: ($event.target as HTMLInputElement).value } })"
        />
      </UFormField>
    </div>
    <DealPackageBlock
      v-if="isPackage"
      class="mt-6"
      :view="view"
      @changed="emit('changed', $event)"
    />
  </StepSection>
</template>
