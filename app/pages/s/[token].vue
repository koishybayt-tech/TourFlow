<script setup lang="ts">
definePageMeta({ layout: 'public' })

interface Signer { side: string, name: string, signedAt: string | null, method: string | null, cert: { issuer?: string, serial?: string, validTo?: string } | null }
interface Doc { id: string, number: string, title: string, kind: string, text: string, createdAt: string, hasPdf: boolean, status: string, signers: Signer[] }
interface SignView { side: 'client' | 'agency', org: string, documents: Doc[], signed: boolean, signerName: string | null, agencySigners: { id: string, name: string, position: string }[], expiresAt: string | null }

const route = useRoute()
const token = String(route.params.token)
const { data, error, refresh } = await useFetch<SignView>(`/api/public/sign/${token}`)
useHead(() => ({ title: data.value ? `${data.value.documents[0]?.title} — подписание` : 'Подписание документа', meta: [{ name: 'robots', content: 'noindex' }] }))

const lang = ref<'ru' | 'kk'>('ru')
const T = computed(() => lang.value === 'ru'
  ? { waiting: 'Ожидает подписания', signed: 'Подписано', sign: 'Подписать документ', download: 'Скачать документ', sender: 'Отправитель', signer: 'Подписант', agency: 'Турагентство', client: 'Клиент', done: 'Документ подписан', thanks: 'Спасибо! Подписанный документ уже у агентства.' }
  : { waiting: 'Қол қоюды күтуде', signed: 'Қол қойылды', sign: 'Құжатқа қол қою', download: 'Құжатты жүктеу', sender: 'Жіберуші', signer: 'Қол қоюшы', agency: 'Турагенттік', client: 'Клиент', done: 'Құжатқа қол қойылды', thanks: 'Рақмет! Қол қойылған құжат агенттікте.' })

const docIndex = ref(0)
const doc = computed(() => data.value?.documents[docIndex.value])
const zoom = ref(100)
const allSigned = computed(() => data.value?.documents.every(d => d.signers.every(s => s.signedAt)))

// Sign flow
const methodOpen = ref(false)
const method = ref<'ncalayer' | 'egov' | null>(null)
const nca = reactive({ storage: 'PKCS12', file: '', password: '' })
const agencySigner = ref<string | undefined>(undefined)
const signing = ref(false)
const justSigned = ref(false)
const ncaReal = ref(false)
watch(methodOpen, async (v) => {
  if (v) {
    method.value = null
    ncaReal.value = await ncaLayerAvailable()
  }
})
watch(() => data.value?.agencySigners, s => (agencySigner.value ??= s?.[0]?.id), { immediate: true })

async function sign(m: 'ncalayer' | 'egov') {
  signing.value = true
  try {
    let cms: string | null = null
    if (m === 'ncalayer' && ncaReal.value) {
      const b64 = btoa(unescape(encodeURIComponent(data.value!.documents.map(d => d.text).join('\n'))))
      cms = await ncaLayerSignCms(b64)
    }
    await api(`/api/public/sign/${token}`, { method: 'POST', body: { method: m, cms, memberId: agencySigner.value } })
    methodOpen.value = false
    justSigned.value = true
    await refresh()
  }
  catch (e) {
    useNotify().fail(e instanceof Error && !(e as { data?: unknown }).data ? { data: { statusMessage: e.message } } : e)
  }
  finally {
    signing.value = false
  }
}
const dlItems = computed(() => doc.value
  ? [[
      { label: 'PDF', icon: 'i-lucide-file', to: `/api/public/sign/${token}/download?doc=${doc.value.id}&variant=pdf`, target: '_blank' },
      { label: 'PDF с листом подписей', icon: 'i-lucide-file-check', to: `/api/public/sign/${token}/download?doc=${doc.value.id}&variant=signed`, target: '_blank' },
      { label: 'CMS (подпись)', icon: 'i-lucide-file-key', to: `/api/public/sign/${token}/download?doc=${doc.value.id}&variant=cms`, target: '_blank' },
    ]]
  : [])
const pages = computed(() => {
  // Split the text into A4-like pages of ~38 lines for the viewer.
  const lines = (doc.value?.text ?? '').split('\n')
  const out: string[][] = []
  for (let i = 0; i < lines.length; i += 38) out.push(lines.slice(i, i + 38))
  return out.length ? out : [['']]
})
</script>

<template>
  <div class="min-h-dvh flex flex-col">
    <header class="h-14 border-b border-(--ui-border) bg-(--ui-bg-elevated) flex items-center gap-3 px-4 lg:px-6">
      <span class="size-7 rounded-lg bg-(--ui-primary) grid place-items-center text-white font-semibold text-sm">T</span>
      <div
        v-if="doc"
        class="min-w-0"
      >
        <p class="font-semibold truncate text-sm">
          {{ doc.title }} № {{ doc.number }}
        </p>
        <p class="text-xs text-(--ui-text-muted) truncate">
          {{ data?.org }}
        </p>
      </div>
      <UBadge
        v-if="doc"
        class="ml-2"
        :color="allSigned ? 'success' : 'warning'"
        variant="subtle"
        :label="allSigned ? T.signed : T.waiting"
      />
      <div class="ml-auto flex rounded-md border border-(--ui-border) text-xs overflow-hidden">
        <button
          v-for="l in (['ru', 'kk'] as const)"
          :key="l"
          class="px-2.5 py-1"
          :class="lang === l ? 'bg-(--ui-bg-accented) font-semibold' : ''"
          @click="lang = l"
        >
          {{ l === 'ru' ? 'RU' : 'KZ' }}
        </button>
      </div>
    </header>

    <div
      v-if="error"
      class="flex-1 grid place-items-center p-6"
    >
      <div class="card p-8 max-w-md text-center space-y-3">
        <UIcon
          name="i-lucide-link-2-off"
          class="size-10 text-(--ui-text-muted)"
        />
        <p class="font-semibold">
          {{ error.statusMessage || 'Ссылка недействительна' }}
        </p>
      </div>
    </div>

    <div
      v-else-if="data && doc"
      class="flex-1 grid lg:grid-cols-[1fr_380px] min-h-0"
    >
      <!-- Viewer -->
      <div class="bg-(--ui-bg-muted) flex flex-col min-h-0">
        <div class="flex items-center gap-2 px-4 py-2 border-b border-(--ui-border) bg-(--ui-bg-elevated) text-sm">
          <template v-if="data.documents.length > 1">
            <USelect
              v-model="docIndex"
              size="sm"
              :items="data.documents.map((d, i) => ({ value: i, label: `${i + 1}. ${d.title}` }))"
              class="w-72"
            />
          </template>
          <span class="text-(--ui-text-muted)">{{ pages.length }} {{ plural(pages.length, 'страница', 'страницы', 'страниц') }}</span>
          <div class="ml-auto flex items-center gap-1">
            <UButton
              size="xs"
              variant="ghost"
              icon="i-lucide-zoom-out"
              aria-label="Уменьшить"
              @click="zoom = Math.max(60, zoom - 10)"
            />
            <span class="w-10 text-center tabular text-xs">{{ zoom }}%</span>
            <UButton
              size="xs"
              variant="ghost"
              icon="i-lucide-zoom-in"
              aria-label="Увеличить"
              @click="zoom = Math.min(160, zoom + 10)"
            />
          </div>
        </div>
        <div class="flex-1 overflow-auto p-6">
          <div
            class="mx-auto space-y-6 origin-top"
            :style="{ width: `${(640 * zoom) / 100}px` }"
          >
            <div
              v-for="(p, i) in pages"
              :key="i"
              class="bg-white text-[#111] shadow-[0_1px_3px_rgba(0,0,0,.12),0_8px_24px_rgba(0,0,0,.08)] rounded-sm"
              :style="{ padding: `${(48 * zoom) / 100}px`, fontSize: `${(13 * zoom) / 100}px`, minHeight: `${(905 * zoom) / 100}px` }"
            >
              <p
                v-for="(l, j) in p"
                :key="j"
                class="font-serif leading-relaxed min-h-[1em]"
                :class="i === 0 && j === 0 ? 'text-center font-bold' : 'text-justify'"
              >
                {{ l }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Panel -->
      <aside class="border-l border-(--ui-border) bg-(--ui-bg-elevated) p-5 space-y-5 overflow-y-auto">
        <div
          v-if="justSigned || data.signed"
          class="text-center space-y-2 py-2"
        >
          <svg
            viewBox="0 0 52 52"
            class="size-16 mx-auto"
            aria-hidden="true"
          ><circle
            cx="26"
            cy="26"
            r="24"
            fill="none"
            stroke="currentColor"
            class="text-ok draw-circle"
            stroke-width="3"
          /><path
            d="M15 27l7 7 15-15"
            fill="none"
            stroke="currentColor"
            class="text-ok draw-check"
            stroke-width="4"
            stroke-linecap="round"
            stroke-linejoin="round"
          /></svg>
          <p class="font-semibold">
            {{ T.done }}
          </p>
          <p class="text-sm text-(--ui-text-muted)">
            {{ T.thanks }}
          </p>
        </div>
        <div
          v-else
          class="rounded-lg bg-warn-bg text-warn-text px-3 py-2 text-sm flex items-center gap-2"
        >
          <UIcon name="i-lucide-clock" /> {{ T.waiting }}
        </div>

        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-(--ui-text-muted) mb-3">
            Подписанты
          </p>
          <ol class="relative border-l border-(--ui-border) ml-2 space-y-4">
            <li
              v-for="s in doc.signers"
              :key="s.side"
              class="pl-5 relative"
            >
              <span
                class="absolute -left-[9px] top-0.5 size-4 rounded-full border-2 grid place-items-center transition-colors duration-500"
                :class="s.signedAt ? 'bg-ok border-ok' : 'bg-(--ui-bg-elevated) border-(--ui-border)'"
              >
                <UIcon
                  v-if="s.signedAt"
                  name="i-lucide-check"
                  class="size-2.5 text-white"
                />
              </span>
              <p class="text-xs text-(--ui-text-muted)">
                {{ s.side === 'agency' ? T.sender : T.signer }} · {{ s.side === 'agency' ? T.agency : T.client }}
              </p>
              <p class="text-sm font-medium">
                {{ s.name }}
              </p>
              <details
                v-if="s.signedAt"
                class="text-xs text-(--ui-text-muted) mt-1"
              >
                <summary class="cursor-pointer text-ok-text">
                  {{ T.signed }} {{ formatDateTime(s.signedAt) }} · {{ s.method === 'egov' ? 'eGov Mobile' : 'ЭЦП' }}
                </summary>
                <p class="mt-1">
                  Сертификат: {{ s.cert?.issuer }}<br>Серийный номер: {{ s.cert?.serial }}
                </p>
              </details>
              <p
                v-else
                class="text-xs text-warn-text"
              >
                {{ T.waiting }}
              </p>
            </li>
          </ol>
        </div>

        <div class="space-y-2">
          <UButton
            v-if="!data.signed && !justSigned"
            block
            size="lg"
            icon="i-lucide-pen-line"
            :label="data.documents.length > 1 ? `${T.sign} · ${data.documents.length}` : T.sign"
            @click="methodOpen = true"
          />
          <UDropdownMenu :items="dlItems">
            <UButton
              block
              color="neutral"
              variant="outline"
              icon="i-lucide-download"
              :label="`${T.download} ▾`"
            />
          </UDropdownMenu>
        </div>
        <p
          v-if="data.expiresAt && !data.signed"
          class="text-xs text-(--ui-text-muted)"
        >
          Ссылка действует до {{ formatDate(data.expiresAt) }}.
        </p>
      </aside>
    </div>

    <UModal
      v-model:open="methodOpen"
      :title="T.sign"
      :description="data?.side === 'agency' ? 'Подписание от имени турагентства' : (data?.signerName ?? '')"
    >
      <template #body>
        <div
          v-if="data?.side === 'agency'"
          class="mb-4"
        >
          <UFormField label="Подписант агентства">
            <USelect
              v-model="agencySigner"
              :items="data.agencySigners.map(s => ({ value: s.id, label: `${s.name} — ${s.position}` }))"
              class="w-full"
            />
          </UFormField>
        </div>
        <div
          v-if="!method"
          class="grid gap-3 sm:grid-cols-2"
        >
          <button
            class="card p-4 text-left hover:border-(--ui-primary)/50"
            @click="method = 'ncalayer'"
          >
            <UIcon
              name="i-lucide-usb"
              class="size-6 text-(--ui-primary)"
            />
            <p class="font-semibold mt-2">
              ЭЦП (NCALayer)
            </p>
            <p class="text-xs text-(--ui-text-muted)">
              Файл ключа или Kaztoken на этом компьютере
            </p>
          </button>
          <button
            class="card p-4 text-left hover:border-(--ui-primary)/50"
            @click="method = 'egov'"
          >
            <UIcon
              name="i-lucide-qr-code"
              class="size-6 text-(--ui-primary)"
            />
            <p class="font-semibold mt-2">
              eGov Mobile
            </p>
            <p class="text-xs text-(--ui-text-muted)">
              QR-код в приложении на телефоне
            </p>
          </button>
        </div>
        <form
          v-else-if="method === 'ncalayer'"
          class="space-y-4"
          @submit.prevent="sign('ncalayer')"
        >
          <UAlert
            v-if="ncaReal"
            color="success"
            variant="subtle"
            icon="i-lucide-plug-zap"
            title="NCALayer найден"
            description="После нажатия откроется окно NCALayer — выберите ключ и введите пароль там. Пароль не передаётся на сервер."
          />
          <template v-else>
            <UAlert
              color="warning"
              variant="subtle"
              icon="i-lucide-flask-conical"
              title="Демо-режим: NCALayer не найден на этом компьютере"
              description="Окно ниже повторяет окно NCALayer. Пароль никуда не отправляется."
            />
            <UFormField label="Тип хранилища">
              <USelect
                v-model="nca.storage"
                :items="[{ value: 'PKCS12', label: 'Файл ключа (PKCS12)' }, { value: 'AKKaztokenStore', label: 'Kaztoken' }, { value: 'AKKZIDCardStore', label: 'Удостоверение личности' }]"
                class="w-full"
              />
            </UFormField>
            <UFormField
              v-if="nca.storage === 'PKCS12'"
              label="Файл ключа"
            >
              <input
                type="file"
                accept=".p12"
                class="block w-full text-sm"
                aria-label="Файл ключа"
                @change="nca.file = ($event.target as HTMLInputElement).files?.[0]?.name ?? ''"
              >
            </UFormField>
            <UFormField label="Пароль ключа">
              <UInput
                v-model="nca.password"
                type="password"
                autocomplete="off"
                class="w-full"
              />
            </UFormField>
          </template>
          <div class="flex justify-between">
            <UButton
              color="neutral"
              variant="ghost"
              label="Назад"
              @click="method = null"
            />
            <UButton
              type="submit"
              :loading="signing"
              label="Подписать"
            />
          </div>
        </form>
        <div
          v-else
          class="space-y-4"
        >
          <div class="grid sm:grid-cols-[220px_1fr] gap-4 items-center">
            <img
              :src="`/api/public/sign/${token}/qr`"
              alt="QR-код для eGov Mobile"
              class="size-[220px] rounded-lg border border-(--ui-border) bg-white p-2"
            >
            <ol class="text-sm space-y-2 list-decimal pl-4">
              <li>Откройте eGov Mobile на телефоне</li>
              <li>Выберите «Сканировать QR» и наведите камеру на код</li>
              <li>Подтвердите подписание в приложении</li>
            </ol>
          </div>
          <div class="flex justify-between">
            <UButton
              color="neutral"
              variant="ghost"
              label="Назад"
              @click="method = null"
            />
            <UButton
              :loading="signing"
              icon="i-lucide-smartphone"
              label="Я подписал в eGov Mobile"
              @click="sign('egov')"
            />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
.draw-circle { stroke-dasharray: 152; stroke-dashoffset: 152; animation: draw 500ms ease-out forwards; }
.draw-check { stroke-dasharray: 40; stroke-dashoffset: 40; animation: draw 350ms 400ms ease-out forwards; }
@keyframes draw { to { stroke-dashoffset: 0; } }
@media (prefers-reduced-motion: reduce) { .draw-circle, .draw-check { animation: none; stroke-dashoffset: 0; } }
</style>
