<script setup lang="ts">
definePageMeta({ middleware: 'role', permission: 'guides' })
useHead({ title: 'Гиды — Tourflow' })
interface Guide { id: string, fullName: string, age: number | null, sex: string, languages: string[], experienceYears: number, agencies: string | null, rate: number, rating: number | null, reviewsCount: number, departures: { id: string, name: string, dates: string }[] }
const { data, refresh } = await useFetch<{ unassigned: number, guides: Guide[] }>('/api/guides')
const open = ref(false)
const g = reactive({ fullName: '', birthDate: '', sex: 'муж.', languages: 'Русский, Казахский, Английский', experienceYears: 1, agencies: '', rate: 200000, rating: null as number | null })
async function save() {
  const r = await mutate(() => api('/api/guides', { method: 'POST', body: { ...g, birthDate: g.birthDate || null, languages: g.languages.split(',').map(s => s.trim()).filter(Boolean) } }), 'Гид добавлен')
  if (r) {
    open.value = false
    refresh()
  }
}
</script>

<template>
  <AppPage
    title="Гиды"
    :subtitle="`${data?.guides.length ?? 0} в базе`"
  >
    <template #actions>
      <UButton
        icon="i-lucide-plus"
        label="Гид"
        @click="open = true"
      />
    </template>
    <UAlert
      v-if="data?.unassigned"
      color="warning"
      variant="subtle"
      icon="i-lucide-flag"
      :title="`${data.unassigned} ${plural(data.unassigned, 'выезд', 'выезда', 'выездов')} без гида`"
      :actions="[{ label: 'Подобрать', to: '/departures' }]"
    />
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <div
        v-for="x in data?.guides"
        :key="x.id"
        class="card p-5 space-y-3"
      >
        <div class="flex items-center gap-3">
          <UAvatar
            :text="initials(x.fullName)"
            size="lg"
          />
          <div>
            <p class="font-semibold">
              {{ x.fullName }}
            </p>
            <p class="text-xs text-(--ui-text-muted)">
              {{ x.age ? `${x.age} лет` : '' }} · {{ x.sex }} · ★ {{ x.rating ?? '—' }} ({{ x.reviewsCount }} отзывов)
            </p>
          </div>
        </div>
        <div class="flex flex-wrap gap-1">
          <UBadge
            v-for="l in x.languages"
            :key="l"
            size="sm"
            variant="subtle"
            color="neutral"
            :label="l"
          />
        </div>
        <p class="text-sm">
          Опыт {{ x.experienceYears }} лет{{ x.agencies ? `, ${x.agencies}` : '' }} · {{ formatMoney(x.rate) }} за выезд
        </p>
        <div>
          <p class="text-xs text-(--ui-text-muted) mb-1">
            Ближайшие выезды
          </p>
          <ul
            v-if="x.departures.length"
            class="space-y-1"
          >
            <li
              v-for="d in x.departures"
              :key="d.id"
            >
              <NuxtLink
                :to="`/departures/${d.id}`"
                class="text-sm hover:underline"
              >
                {{ d.name }} · {{ d.dates }}
              </NuxtLink>
            </li>
          </ul>
          <p
            v-else
            class="text-sm text-ok-text"
          >
            Свободен
          </p>
        </div>
      </div>
    </div>
    <UModal
      v-model:open="open"
      title="Новый гид"
    >
      <template #body>
        <form
          class="space-y-4"
          @submit.prevent="save"
        >
          <UFormField label="ФИО">
            <UInput
              v-model="g.fullName"
              class="w-full"
            />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Дата рождения">
              <UInput
                v-model="g.birthDate"
                type="date"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Пол">
              <USelect
                v-model="g.sex"
                :items="[{ value: 'муж.', label: 'мужской' }, { value: 'жен.', label: 'женский' }]"
                class="w-full"
              />
            </UFormField>
          </div>
          <UFormField
            label="Языки"
            hint="через запятую"
          >
            <UInput
              v-model="g.languages"
              class="w-full"
            />
          </UFormField>
          <div class="grid grid-cols-3 gap-3">
            <UFormField label="Опыт, лет">
              <UInputNumber
                v-model="g.experienceYears"
                :min="0"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Ставка, ₸">
              <UInputNumber
                v-model="g.rate"
                :min="0"
                :step="10000"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Рейтинг">
              <UInputNumber
                v-model="g.rating"
                :min="0"
                :max="5"
                :step="0.1"
                class="w-full"
              />
            </UFormField>
          </div>
          <UFormField label="Агентства">
            <UInput
              v-model="g.agencies"
              class="w-full"
            />
          </UFormField>
          <div class="flex justify-end">
            <UButton
              type="submit"
              label="Добавить"
            />
          </div>
        </form>
      </template>
    </UModal>
  </AppPage>
</template>
