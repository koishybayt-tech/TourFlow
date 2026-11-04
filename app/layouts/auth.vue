<template>
  <div class="min-h-dvh grid lg:grid-cols-2 bg-(--ui-bg)">
    <div class="flex items-center justify-center px-6 py-12">
      <div class="w-full max-w-sm">
        <div class="flex items-center gap-2 mb-8">
          <span class="size-8 rounded-lg bg-(--ui-primary) grid place-items-center text-white font-semibold">T</span>
          <span class="font-semibold text-lg">Tourflow</span>
        </div>
        <slot />
      </div>
    </div>
    <div class="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-indigo-600 to-violet-700 text-white">
      <p class="text-sm opacity-80">
        CRM для турагентств Казахстана
      </p>
      <div>
        <p class="text-3xl font-semibold leading-tight max-w-md">
          Заявка от первого сообщения в WhatsApp до вылета — на одной странице.
        </p>
        <ul class="mt-6 space-y-2 text-sm opacity-90">
          <li>· Статус заявки меняется сам</li>
          <li>· Договоры и расписки с электронной подписью</li>
          <li>· Групповые и пакетные туры в одной системе</li>
        </ul>
      </div>
      <p class="text-xs opacity-70">
        Данные хранятся в Казахстане
      </p>
    </div>
  </div>
</template>
