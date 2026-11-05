<script setup lang="ts">
useHead({ title: 'Профиль — Tourflow' })
const route = useRoute()
const router = useRouter()
const { me, refresh } = useMe()
const tabs = [
  { label: 'Профиль', value: 'profile', icon: 'i-lucide-user' },
  { label: 'Безопасность', value: 'security', icon: 'i-lucide-shield' },
  { label: 'Уведомления', value: 'notifications', icon: 'i-lucide-bell' },
  { label: 'Тариф', value: 'plan', icon: 'i-lucide-credit-card' },
]
const tab = computed({
  get: () => String(route.query.tab || 'profile'),
  set: v => router.replace({ query: { tab: v } }),
})

const profile = reactive({
  name: me.value?.user.name ?? '',
  position: me.value?.user.position ?? '',
  phone: me.value?.user.phone ? formatPhone(me.value.user.phone) : '',
  telegramChatId: me.value?.user.telegramChatId ?? '',
})
async function saveProfile() {
  if (await mutate(() => api('/api/profile', { method: 'PUT', body: profile }), 'Профиль сохранён')) await refresh()
}

const pw = reactive({ current: '', next: '', confirm: '' })
async function changePassword() {
  if (pw.next !== pw.confirm) return useNotify().fail({ data: { statusMessage: 'Пароли не совпадают' } })
  if (await mutate(() => api('/api/auth/password', { method: 'POST', body: { current: pw.current, next: pw.next } }), 'Пароль изменён')) {
    Object.assign(pw, { current: '', next: '', confirm: '' })
  }
}

const tg = ref<{ code: string, bot: string | null, enabled: boolean } | null>(null)
async function linkTelegram() {
  tg.value = await mutate(() => api<{ code: string, bot: string | null, enabled: boolean }>('/api/profile/telegram', { method: 'POST' })) ?? null
}
const notifRows = [
  'Новая заявка назначена', 'Задача назначена или просрочена', 'Оплата получена',
  'Дедлайн оплаты оператору ≤ 7 дней', 'Клиент подписал документ', 'Выезд в риске недобора',
]
</script>

<template>
  <AppPage
    title="Профиль"
    :subtitle="me?.user.email"
  >
    <UTabs
      v-model="tab"
      :items="tabs"
      variant="link"
      :content="false"
      class="w-full"
    />

    <form
      v-if="tab === 'profile'"
      class="card p-5 space-y-4 max-w-2xl"
      @submit.prevent="saveProfile"
    >
      <div class="grid gap-4 md:grid-cols-2">
        <UFormField label="Имя">
          <UInput
            v-model="profile.name"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Должность">
          <UInput
            v-model="profile.position"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Телефон">
          <UInput
            v-model="profile.phone"
            placeholder="+7 701 000 00 00"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Telegram chat ID"
          hint="для уведомлений от бота"
        >
          <UInput
            v-model="profile.telegramChatId"
            class="w-full"
          />
        </UFormField>
      </div>
      <p class="text-sm text-(--ui-text-muted)">
        Роль: {{ ROLE_LABELS[me!.member.role] }} · Часовой пояс: Алматы (UTC+5)
      </p>
      <div class="flex justify-end">
        <UButton
          type="submit"
          label="Сохранить"
        />
      </div>
    </form>

    <form
      v-else-if="tab === 'security'"
      class="card p-5 space-y-4 max-w-md"
      @submit.prevent="changePassword"
    >
      <h2 class="font-semibold">
        Смена пароля
      </h2>
      <UFormField label="Текущий пароль">
        <UInput
          v-model="pw.current"
          type="password"
          autocomplete="current-password"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="Новый пароль"
        hint="минимум 8 символов"
      >
        <UInput
          v-model="pw.next"
          type="password"
          autocomplete="new-password"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Повторите новый пароль">
        <UInput
          v-model="pw.confirm"
          type="password"
          autocomplete="new-password"
          class="w-full"
        />
      </UFormField>
      <p class="text-xs text-(--ui-text-muted)">
        Двухфакторная аутентификация появится позже.
      </p>
      <div class="flex justify-end">
        <UButton
          type="submit"
          label="Изменить пароль"
        />
      </div>
    </form>

    <div
      v-else-if="tab === 'notifications'"
      class="card max-w-2xl"
    >
      <div class="px-5 py-4 border-b border-(--ui-border)">
        <h2 class="font-semibold">
          Уведомления
        </h2>
        <p class="text-sm text-(--ui-text-muted)">
          В приложении — всегда. В Telegram — после подключения бота (укажите chat ID в профиле).
        </p>
      </div>
      <div class="px-5 py-4 border-b border-(--ui-border) space-y-2">
        <p class="text-sm font-medium flex items-center gap-2">
          <UIcon name="i-lucide-send" /> Telegram-бот
          <UBadge
            :color="me?.user.telegramChatId ? 'success' : 'neutral'"
            variant="subtle"
            :label="me?.user.telegramChatId ? 'Подключён' : 'Не подключён'"
          />
        </p>
        <UButton
          v-if="!tg"
          size="sm"
          variant="soft"
          label="Получить код привязки"
          @click="linkTelegram"
        />
        <p
          v-else
          class="text-sm"
        >
          Откройте бота{{ tg.bot ? ` @${tg.bot}` : '' }} и отправьте: <code class="bg-(--ui-bg-muted) px-1.5 py-0.5 rounded">/start {{ tg.code }}</code>
          <span
            v-if="!tg.enabled"
            class="block text-xs text-warn-text mt-1"
          >Бот ещё не настроен на сервере (TELEGRAM_BOT_TOKEN).</span>
        </p>
      </div>
      <div
        v-for="row in notifRows"
        :key="row"
        class="flex items-center justify-between px-5 py-3 border-b border-(--ui-border-muted) last:border-0"
      >
        <span class="text-sm">{{ row }}</span>
        <span class="flex items-center gap-4 text-xs text-(--ui-text-muted)">
          <span class="flex items-center gap-1"><UIcon
            name="i-lucide-check"
            class="text-ok"
          /> В приложении</span>
          <span class="flex items-center gap-1"><UIcon
            :name="me?.user.telegramChatId ? 'i-lucide-check' : 'i-lucide-minus'"
            :class="me?.user.telegramChatId ? 'text-ok' : ''"
          /> Telegram</span>
        </span>
      </div>
    </div>

    <div
      v-else
      class="card p-5 max-w-2xl"
    >
      <h2 class="font-semibold">
        Тариф «Пилот»
      </h2>
      <p class="text-sm text-(--ui-text-muted) mt-1">
        Все модули включены на время пилота. Оплата и смена тарифа появятся после запуска.
      </p>
    </div>
  </AppPage>
</template>
