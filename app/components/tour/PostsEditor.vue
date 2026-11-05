<script setup lang="ts">
interface Post { kind: string, url: string }
const posts = defineModel<Post[]>({ required: true })
const KINDS = [{ value: 'Пост', label: 'Пост' }, { value: 'Reels', label: 'Reels' }, { value: 'Сторис', label: 'Сторис' }]
function update(i: number, patch: Partial<Post>) {
  posts.value = posts.value.map((p, j) => (j === i ? { ...p, ...patch } : p))
}
function remove(i: number) {
  posts.value = posts.value.filter((_, j) => j !== i)
}
</script>

<template>
  <div>
    <div
      v-for="(post, i) in posts"
      :key="i"
      class="flex gap-2 mb-2"
    >
      <USelect
        :model-value="post.kind"
        size="sm"
        :items="KINDS"
        class="w-28"
        @update:model-value="update(i, { kind: String($event) })"
      />
      <UInput
        :model-value="post.url"
        size="sm"
        class="flex-1"
        placeholder="Ссылка на пост"
        @update:model-value="update(i, { url: String($event) })"
      />
      <UButton
        size="xs"
        variant="ghost"
        color="error"
        icon="i-lucide-x"
        aria-label="Удалить ссылку"
        @click="remove(i)"
      />
    </div>
    <UButton
      size="xs"
      variant="soft"
      icon="i-lucide-plus"
      label="Ссылка"
      @click="posts = [...posts, { kind: 'Пост', url: '' }]"
    />
  </div>
</template>
