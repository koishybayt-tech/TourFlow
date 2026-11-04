<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

defineProps<{ collapsed?: boolean }>()
const { me } = useMe()
const colorMode = useColorMode()
const { clear } = useUserSession()

async function logout() {
  await api('/api/auth/logout', { method: 'POST' })
  await clear()
  useMe().me.value = null
  await navigateTo('/login')
}

const items = computed<DropdownMenuItem[][]>(() => [
  [{ type: 'label', label: me.value?.user.name, description: me.value?.user.email, avatar: { text: initials(me.value?.user.name) } }],
  [
    { label: 'Профиль', icon: 'i-lucide-user', to: '/profile' },
    { label: 'Безопасность', icon: 'i-lucide-shield', to: '/profile?tab=security' },
    { label: 'Уведомления', icon: 'i-lucide-bell', to: '/profile?tab=notifications' },
    { label: 'Тариф', icon: 'i-lucide-credit-card', to: '/profile?tab=plan' },
  ],
  [{
    label: colorMode.value === 'dark' ? 'Светлая тема' : 'Тёмная тема',
    icon: colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon',
    onSelect: (e: Event) => {
      e.preventDefault()
      colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
    },
  }],
  [{ label: 'Выйти', icon: 'i-lucide-log-out', color: 'error', onSelect: logout }],
])
</script>

<template>
  <UDropdownMenu
    :items="items"
    :content="{ align: 'center', collisionPadding: 12 }"
    :ui="{ content: collapsed ? 'w-56' : 'w-(--reka-dropdown-menu-trigger-width)' }"
  >
    <UButton
      color="neutral"
      variant="ghost"
      block
      :square="collapsed"
      class="data-[state=open]:bg-(--ui-bg-elevated)"
      :aria-label="me?.user.name"
      :ui="{ trailingIcon: 'text-(--ui-text-dimmed)' }"
      :trailing-icon="collapsed ? undefined : 'i-lucide-chevrons-up-down'"
    >
      <UAvatar
        :text="initials(me?.user.name)"
        size="sm"
      />
      <span
        v-if="!collapsed"
        class="min-w-0 text-left"
      >
        <span class="block truncate font-medium text-(--ui-text-highlighted)">{{ me?.user.name }}</span>
        <span class="block truncate text-xs text-(--ui-text-muted)">{{ me?.user.email }}</span>
      </span>
    </UButton>
  </UDropdownMenu>
</template>
