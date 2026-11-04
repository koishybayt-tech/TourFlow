<script setup lang="ts">
import type { Role } from '#shared/permissions'

const { data, refresh } = await useFetch('/api/settings/members')
const { refresh: refreshMe } = useMe()
const roleItems = (['OWNER', 'MANAGER', 'CALLCENTER', 'GUIDE'] as Role[]).map(r => ({ label: ROLE_LABELS[r], value: r }))
const inviteOpen = ref(false)
const invite = reactive({ email: '', role: 'MANAGER' as Role })
const inviteUrl = ref('')

async function patch(id: string, body: Record<string, unknown>, msg = 'Сохранено') {
  await mutate(() => api(`/api/settings/members/${id}`, { method: 'PATCH', body }), msg)
  await Promise.all([refresh(), refreshMe()])
}
async function sendInvite() {
  const r = await mutate(() => api<{ url: string }>('/api/settings/invites', { method: 'POST', body: invite }), 'Приглашение отправлено')
  if (r) {
    inviteUrl.value = r.url
    invite.email = ''
    await refresh()
  }
}
</script>

<template>
  <div class="card">
    <div class="flex items-center justify-between gap-4 px-5 py-4 border-b border-(--ui-border)">
      <div>
        <h2 class="font-semibold">
          Сотрудники и доступ
        </h2>
        <p class="text-sm text-(--ui-text-muted)">
          Роль определяет, что сотрудник видит. Права проверяются на сервере.
        </p>
      </div>
      <UButton
        icon="i-lucide-user-plus"
        label="Пригласить"
        @click="inviteOpen = true; inviteUrl = ''"
      />
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="text-left text-xs text-(--ui-text-muted)">
          <tr>
            <th class="px-5 py-2 font-medium">
              Сотрудник
            </th>
            <th class="px-3 py-2 font-medium">
              Роль
            </th>
            <th class="px-3 py-2 font-medium">
              В отпуске
            </th>
            <th class="px-3 py-2 font-medium">
              Право подписи (ЭЦП)
            </th>
            <th class="px-5 py-2 font-medium text-right">
              Доступ
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="m in data?.members"
            :key="m.id"
            class="border-t border-(--ui-border-muted)"
            :class="!m.active && 'opacity-50'"
          >
            <td class="px-5 py-3">
              <div class="flex items-center gap-3">
                <UAvatar
                  :text="initials(m.name)"
                  size="sm"
                />
                <div>
                  <p class="font-medium">
                    {{ m.name }} <span
                      v-if="m.isMe"
                      class="text-(--ui-text-muted) font-normal"
                    >(вы)</span>
                  </p>
                  <p class="text-xs text-(--ui-text-muted)">
                    {{ m.email }}<template v-if="m.position">
                      · {{ m.position }}
                    </template>
                  </p>
                </div>
              </div>
            </td>
            <td class="px-3 py-3">
              <USelect
                :model-value="m.role"
                :items="roleItems"
                :disabled="m.isMe"
                size="sm"
                class="w-40"
                @update:model-value="patch(m.id, { role: $event }, 'Роль изменена')"
              />
            </td>
            <td class="px-3 py-3">
              <USwitch
                :model-value="m.onVacation"
                aria-label="В отпуске"
                @update:model-value="patch(m.id, { onVacation: $event })"
              />
            </td>
            <td class="px-3 py-3">
              <USwitch
                :model-value="m.signRight"
                aria-label="Право подписи"
                @update:model-value="patch(m.id, { signRight: $event })"
              />
            </td>
            <td class="px-5 py-3 text-right">
              <UButton
                v-if="!m.isMe"
                size="xs"
                variant="ghost"
                :color="m.active ? 'error' : 'primary'"
                :label="m.active ? 'Отключить' : 'Включить'"
                @click="patch(m.id, { active: !m.active }, m.active ? 'Доступ отключён' : 'Доступ включён')"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div
      v-if="data?.invites.length"
      class="px-5 py-4 border-t border-(--ui-border)"
    >
      <p class="text-xs font-medium text-(--ui-text-muted) mb-2">
        Ожидают принятия
      </p>
      <p
        v-for="i in data.invites"
        :key="i.id"
        class="text-sm"
      >
        {{ i.email }} · {{ ROLE_LABELS[i.role as Role] }} · до {{ formatDate(i.expiresAt) }}
      </p>
    </div>

    <UModal
      v-model:open="inviteOpen"
      title="Пригласить сотрудника"
      description="Отправим ссылку на email. Она действует 7 дней."
    >
      <template #body>
        <form
          class="space-y-4"
          @submit.prevent="sendInvite"
        >
          <UFormField label="Email">
            <UInput
              v-model="invite.email"
              type="email"
              class="w-full"
              autofocus
            />
          </UFormField>
          <UFormField label="Роль">
            <USelect
              v-model="invite.role"
              :items="roleItems"
              class="w-full"
            />
          </UFormField>
          <UAlert
            v-if="inviteUrl"
            color="success"
            variant="subtle"
            title="Приглашение отправлено"
            :description="`Ссылку можно передать и вручную: ${inviteUrl}`"
          />
          <div class="flex justify-end gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              label="Закрыть"
              @click="inviteOpen = false"
            />
            <UButton
              type="submit"
              label="Отправить приглашение"
            />
          </div>
        </form>
      </template>
    </UModal>
  </div>
</template>
