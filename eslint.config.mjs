// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  ignores: ['server/generated/**', 'reference/**', 'prompts/**', 'docs/**'],
}, {
  rules: {
    'vue/multi-word-component-names': 'off',
  },
})
