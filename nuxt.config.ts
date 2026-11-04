// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({

  modules: ['@nuxt/ui', '@pinia/nuxt', '@nuxtjs/i18n', 'nuxt-auth-utils', '@nuxt/eslint'],
  devtools: { enabled: true },

  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
    head: {
      htmlAttrs: { lang: 'ru' },
      title: 'Tourflow',
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    },
  },

  css: ['~/assets/css/main.css'],

  colorMode: { preference: 'system', fallback: 'light' },

  // Server-side settings are read from plain env vars (see server/utils/env.ts and .env.example).
  runtimeConfig: {
    public: { baseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:3000' },
  },
  compatibilityDate: '2026-11-01',

  nitro: { experimental: { tasks: true } },

  typescript: { strict: true },

  eslint: { config: { stylistic: { semi: false, quotes: 'single', commaDangle: 'always-multiline' } } },

  i18n: {
    defaultLocale: 'ru',
    strategy: 'no_prefix',
    locales: [{ code: 'ru', language: 'ru-RU', file: 'ru.json', name: 'Русский' }],
  },
})
