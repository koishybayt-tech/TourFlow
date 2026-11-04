<script setup lang="ts">
interface Ch { key: string, title: string, connected: boolean, webhook: string | null, env: string[], warning?: string, soon?: boolean }
const { data } = await useFetch<{ provider: string, channels: Ch[] }>('/api/settings/channels')
function copy(t: string) {
  navigator.clipboard.writeText(t)
  useNotify().ok('Скопировано')
}
</script>

<template>
  <div class="space-y-4">
    <UAlert
      v-if="data?.provider === 'mock'"
      color="warning"
      variant="subtle"
      icon="i-lucide-flask-conical"
      title="Демо-режим: сообщения клиентам не отправляются в реальные каналы"
      description="Чтобы подключить WhatsApp и Instagram, укажите ключи в .env на сервере и MESSAGING_PROVIDER=real."
    />
    <div
      v-for="c in data?.channels"
      :key="c.key"
      class="card p-5 space-y-3"
    >
      <div class="flex items-center justify-between">
        <h3 class="font-semibold">
          {{ c.title }}
        </h3>
        <UBadge
          :color="c.soon ? 'neutral' : c.connected ? 'success' : 'neutral'"
          variant="subtle"
          :label="c.soon ? 'Скоро' : c.connected ? 'Подключён' : 'Не подключён'"
        />
      </div>
      <UAlert
        v-if="c.warning"
        color="error"
        variant="subtle"
        :title="c.warning"
      />
      <div
        v-if="c.webhook"
        class="flex items-center gap-2 text-sm"
      >
        <span class="text-(--ui-text-muted) shrink-0">Адрес вебхука:</span>
        <code class="truncate text-xs bg-(--ui-bg-muted) rounded px-2 py-1">{{ c.webhook }}</code>
        <UButton
          size="xs"
          variant="ghost"
          icon="i-lucide-copy"
          aria-label="Копировать адрес"
          @click="copy(c.webhook)"
        />
      </div>
      <p
        v-if="c.env.length"
        class="text-xs text-(--ui-text-muted)"
      >
        Ключи в .env: {{ c.env.join(', ') }}
      </p>
    </div>
  </div>
</template>
