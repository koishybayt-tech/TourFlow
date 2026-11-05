<script setup lang="ts">
definePageMeta({ layout: 'public' })

interface PublicTour {
  slug: string
  name: string
  flags: string | null
  countries: string[]
  route: string
  dates: string
  days: number
  nights: number | null
  price: number
  prepay: number
  riseDate: string | null
  riseAmount: number | null
  payRule: string | null
  description: string
  coverKey: string | null
  included: string[]
  extra: string[]
  free: number
  closed: boolean
  program: { city: string, items: string[], description: string, transfer: string | null, media: string[] }[]
  org: { name: string, instagram: string | null }
  whatsapp: string
}
const route = useRoute()
const { data: t, error } = await useFetch<PublicTour>(`/api/public/tours/${route.params.slug}`)
if (error.value) throw createError({ statusCode: 404, statusMessage: 'Тур не найден', fatal: true })
const base = useRuntimeConfig().public.baseUrl
const cover = computed(() => (t.value?.coverKey ? `${base}/api/public/media/${t.value.coverKey}` : undefined))
useSeoMeta({
  title: () => `${t.value?.name} · ${t.value?.dates} — ${t.value?.org.name}`,
  description: () => t.value?.description.slice(0, 160),
  ogTitle: () => `${t.value?.flags ?? ''} ${t.value?.name}`.trim(),
  ogDescription: () => `${t.value?.dates} · ${t.value?.route} · ${t.value ? formatMoney(t.value.price) : ''}`,
  ogImage: () => cover.value,
  ogType: 'website',
  twitterCard: 'summary_large_image',
})
const gallery = computed(() => t.value?.program.flatMap(d => d.media.filter(k => !/\.(mp4|mov|webm)$/i.test(k))) ?? [])
</script>

<template>
  <div
    v-if="t"
    class="bg-white text-[#0F1115] dark:bg-[#0B0C0E] dark:text-[#EDEEF0] min-h-dvh"
  >
    <section class="relative min-h-[70vh] flex items-end overflow-hidden">
      <img
        v-if="t.coverKey"
        :src="`/api/public/media/${t.coverKey}`"
        :alt="t.name"
        class="absolute inset-0 size-full object-cover"
        fetchpriority="high"
      >
      <div
        v-else
        class="absolute inset-0 bg-gradient-to-br from-indigo-600 via-violet-600 to-sky-500"
      />
      <div class="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
      <div class="relative w-full max-w-5xl mx-auto px-6 pb-12 text-white reveal">
        <p class="text-sm uppercase tracking-[.2em] opacity-90">
          {{ t.flags }} Авторский тур · {{ t.days }} {{ plural(t.days, 'день', 'дня', 'дней') }}
        </p>
        <h1 class="text-4xl md:text-6xl font-bold mt-3 leading-tight">
          {{ t.name }}
        </h1>
        <p class="mt-3 text-lg opacity-95">
          {{ t.route }}
        </p>
        <p class="mt-1 text-lg font-medium">
          {{ t.dates }}
        </p>
        <div class="mt-6 flex flex-wrap items-center gap-4">
          <a
            :href="t.closed ? undefined : t.whatsapp"
            target="_blank"
            rel="noopener"
            class="inline-flex items-center gap-2 rounded-xl px-6 py-3.5 font-semibold text-white transition-transform hover:scale-[1.02]"
            :class="t.closed ? 'bg-gray-500 cursor-not-allowed' : 'bg-[#25D366]'"
            :aria-disabled="t.closed"
          >
            <UIcon
              name="i-lucide-message-circle"
              class="size-5"
            /> {{ t.closed ? 'Набор закрыт' : 'Забронировать в WhatsApp' }}
          </a>
          <span class="text-sm opacity-90">{{ t.closed ? '' : `Осталось мест: ${t.free}` }}</span>
        </div>
      </div>
    </section>

    <section class="max-w-5xl mx-auto px-6 py-12 grid gap-10 md:grid-cols-[1fr_300px]">
      <div class="space-y-10">
        <p class="text-lg leading-relaxed reveal">
          {{ t.description }}
        </p>
        <div>
          <h2 class="text-2xl font-bold mb-6">
            Программа
          </h2>
          <ol class="space-y-6">
            <li
              v-for="(d, i) in t.program"
              :key="i"
              class="relative pl-12 reveal"
              :style="{ animationDelay: `${i * 60}ms` }"
            >
              <span class="absolute left-0 top-0 size-9 rounded-full bg-indigo-600 text-white grid place-items-center font-semibold">{{ i + 1 }}</span>
              <p class="font-semibold text-lg">
                {{ d.city }}
              </p>
              <p
                v-if="d.transfer"
                class="text-sm text-gray-500 flex items-center gap-1"
              >
                <UIcon name="i-lucide-bus" /> {{ d.transfer }}
              </p>
              <p class="mt-1 text-gray-700 dark:text-gray-300">
                {{ d.description }}
              </p>
              <div class="flex flex-wrap gap-1.5 mt-2">
                <span
                  v-for="it in d.items"
                  :key="it"
                  class="rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300 px-3 py-1 text-sm"
                >{{ it }}</span>
              </div>
            </li>
          </ol>
        </div>
        <div
          v-if="gallery.length"
          class="grid grid-cols-2 md:grid-cols-3 gap-2"
        >
          <img
            v-for="k in gallery"
            :key="k"
            :src="`/api/public/media/${k}`"
            alt=""
            loading="lazy"
            class="aspect-[4/3] w-full object-cover rounded-xl"
          >
        </div>
        <div class="grid gap-6 sm:grid-cols-2">
          <div>
            <h3 class="font-bold mb-3">
              Включено
            </h3>
            <ul class="space-y-1.5">
              <li
                v-for="x in t.included"
                :key="x"
                class="flex gap-2"
              >
                <UIcon
                  name="i-lucide-check"
                  class="text-[#12B76A] mt-1 shrink-0"
                />{{ x }}
              </li>
            </ul>
          </div>
          <div>
            <h3 class="font-bold mb-3">
              Оплачивается дополнительно
            </h3>
            <ul class="space-y-1.5">
              <li
                v-for="x in t.extra"
                :key="x"
                class="flex gap-2 text-gray-600 dark:text-gray-400"
              >
                <UIcon
                  name="i-lucide-plus"
                  class="mt-1 shrink-0"
                />{{ x }}
              </li>
            </ul>
          </div>
        </div>
      </div>
      <aside class="md:sticky md:top-6 self-start rounded-2xl border border-gray-200 dark:border-gray-800 p-6 space-y-3">
        <p class="text-sm text-gray-500">
          Стоимость
        </p>
        <p class="text-3xl font-bold tabular">
          {{ formatMoney(t.price) }}
        </p>
        <p class="text-sm">
          Предоплата {{ formatMoney(t.prepay) }}
        </p>
        <p
          v-if="t.riseDate && t.riseAmount"
          class="text-sm text-[#B54708]"
        >
          После {{ formatDate(t.riseDate, { dateOnly: true }) }} цена вырастет на {{ formatMoney(t.riseAmount) }}
        </p>
        <p
          v-if="t.payRule"
          class="text-sm text-gray-500"
        >
          {{ t.payRule }}
        </p>
        <p class="text-sm">
          {{ t.dates }} · {{ t.days }} {{ plural(t.days, 'день', 'дня', 'дней') }}
        </p>
        <a
          v-if="!t.closed"
          :href="t.whatsapp"
          target="_blank"
          rel="noopener"
          class="block text-center rounded-xl bg-[#25D366] text-white font-semibold py-3"
        >Забронировать в WhatsApp</a>
        <p class="text-xs text-gray-500 text-center">
          {{ t.org.name }}{{ t.org.instagram ? ` · ${t.org.instagram}` : '' }}
        </p>
      </aside>
    </section>
  </div>
</template>

<style scoped>
.reveal { animation: reveal 500ms ease-out both; }
@keyframes reveal { from { opacity: 0; transform: translateY(12px); } }
@media (prefers-reduced-motion: reduce) { .reveal { animation: none; } }
</style>
