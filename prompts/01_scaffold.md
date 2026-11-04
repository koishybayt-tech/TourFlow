# Фаза 1. Каркас, Docker, CI

Создай проект по `docs/05_ARCHITECTURE.md`:
- Nuxt 4 + TypeScript strict, pnpm, Node 22 LTS. Модули: Nuxt UI, @pinia/nuxt, @nuxtjs/i18n (ru), nuxt-auth-utils, @nuxt/eslint, @nuxt/test-utils. motion-v, zod, dayjs, prisma.
- Tailwind v4 токены из `docs/04_DESIGN_SYSTEM.md` в `app/assets/css/main.css`, шрифт Inter, тёмная тема.
- Prisma подключена к PostgreSQL, эндпоинт `/api/health` (проверка БД).
- `Dockerfile` (multi-stage, non-root, healthcheck, `prisma migrate deploy` при старте), `docker-compose.yml` (app, db, minio + создание бакета, gotenberg, mailpit), `docker-compose.prod.yml` (app из GHCR, db, caddy с HTTPS).
- `.env.example`, `Makefile` (up, down, logs, migrate, seed, test, e2e).
- `.github/workflows/ci.yml` и `docker.yml` (GHCR), `dependabot.yml`.
- Скопируй папки `docs/`, `reference/`, `prompts/` и `CLAUDE.md` в корень репозитория.
- README: как поднять локально и в Docker.

**Готово, когда:** `docker compose up -d` поднимает всё, http://localhost:3000 открывает заглушку с нашим AppShell (пустой сайдбар), `/api/health` → `{ db: "ok" }`, CI зелёный.

**Порядок работы:** сначала покажи план (файлы, модели, компоненты, риски) и дождись моего «ок». Потом реализация маленькими коммитами в ветке `feat/01-scaffold`. В конце: `pnpm lint && pnpm typecheck && pnpm test` зелёные, краткий отчёт «что сделано / как проверить / что осталось», открой PR.
