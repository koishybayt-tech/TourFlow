# 05. Архитектура, Docker, CI

## Стек

| Слой | Выбор | Зачем |
|---|---|---|
| Фреймворк | **Nuxt 4** (Vue 3, TypeScript strict) | SSR для публичных страниц туров, API на Nitro в том же проекте |
| UI | **Nuxt UI** (Tailwind CSS v4, Reka UI) | Готовые доступные компоненты, тёмная тема, таблицы, формы, command palette |
| Анимации | **motion-v** (Motion for Vue) + CSS-переходы Nuxt | Layout-анимации, stagger, жесты |
| Состояние | **Pinia** (`@pinia/nuxt`) + `useFetch`/`$fetch` | Сторы только для UI-состояния, данные — с сервера |
| Валидация | **Zod** (общие схемы `shared/schemas`) | Одни и те же схемы на клиенте и сервере |
| БД | **PostgreSQL 16** + **Prisma** | Миграции, типобезопасность |
| Авторизация | **nuxt-auth-utils** (сессии в шифрованной cookie) + argon2 | Просто и безопасно для B2B |
| Файлы | **MinIO** (S3-совместимое) в Docker, в проде — S3 в Казахстане | Документы, фото туров |
| PDF/DOCX | **docxtemplater** (подстановка), **mammoth** (предпросмотр), **Gotenberg** (DOCX → PDF) в Docker | Договоры и расписки |
| Excel | **ExcelJS** | Отчёты, финансы тура |
| Фоновые задачи | **pg-boss** (очереди на PostgreSQL) | Рассылки, мониторинг цен, напоминания, без отдельного Redis |
| Почта в dev | **Mailpit** | Проверка писем локально |
| Графики | **vue-chartjs** (Chart.js) | Отчёты |
| Даты | **dayjs** (tz Asia/Almaty, locale ru) | |
| i18n | **@nuxtjs/i18n** (ru по умолчанию, kk позже) | |
| Тесты | **Vitest** (+ @nuxt/test-utils), **Playwright** | Юнит доменной логики и e2e ключевых сценариев |
| Линт | **@nuxt/eslint**, Prettier | |
| Пакеты | **pnpm**, Node 22 LTS | |

Перед установкой — `npm view <pkg> version`, ставить актуальные стабильные версии. Если пакет устарел или несовместим с Nuxt 4 — предложить замену и спросить.

## Структура проекта

```
tourflow/
├─ app/                      # Nuxt 4 app dir
│  ├─ assets/css/main.css    # Tailwind + токены
│  ├─ components/            # AppShell, StepSection, KanbanBoard, ...
│  │  └─ deal/ tour/ docs/ tasks/ inbox/ reports/ ...
│  ├─ composables/           # useMoney, useDealStatus, usePermissions, ...
│  ├─ layouts/ default.vue auth.vue public.vue
│  ├─ middleware/ auth.global.ts role.ts
│  ├─ pages/
│  │  ├─ index.vue           # Мой день
│  │  ├─ inbox/  deals/  deals/[id].vue  tasks/  calendar/  clients/  clients/[id].vue
│  │  ├─ tours/  tours/[id].vue  departures/  departures/[id].vue  guides/
│  │  ├─ package/search.vue  package/bookings.vue  tickets/  reports/  settings/[...tab].vue
│  │  ├─ login.vue  register.vue
│  │  ├─ t/[slug].vue        # публичная страница тура (layout: public)
│  │  └─ s/[token].vue       # публичная страница подписания (layout: public)
│  └─ stores/
├─ server/
│  ├─ api/                   # REST по ресурсам: deals, clients, tasks, tours, ...
│  ├─ domain/                # чистая бизнес-логика (тестируется без БД):
│  │  ├─ dealStatus.ts       # требования этапа, автопереход
│  │  ├─ routing.ts          # воронка и направление по тексту
│  │  ├─ tourCalc.ts         # себестоимость, безубыточность, сценарии
│  │  ├─ roomAllocation.ts   # размещение по номерам
│  │  ├─ templates.ts        # переменные, связка, рендер
│  │  └─ receipts.ts         # условия показа расписок
│  ├─ providers/             # интерфейсы + mock + реальные адаптеры
│  │  ├─ messaging/ (whatsappCloud, instagram, mock)
│  │  ├─ signing/ (ncalayer, egov, mock)
│  │  ├─ tourSearch/ (tourvisor, mock)
│  │  ├─ flights/ hotels/ (mock; источники позже)
│  │  └─ notify/ (telegram, email, mock)
│  ├─ jobs/                  # pg-boss воркеры
│  ├─ utils/ prisma.ts auth.ts crypto.ts (шифрование ИИН/паспортов) audit.ts
│  └─ plugins/ jobs.ts
├─ shared/ schemas/ types/   # Zod-схемы и типы для клиента и сервера
├─ prisma/ schema.prisma migrations/ seed.ts
├─ locales/ ru.json
├─ tests/ unit/ e2e/
├─ docker/ gotenberg/ (если нужно) nginx/ (prod)
├─ Dockerfile  docker-compose.yml  docker-compose.prod.yml
├─ .github/workflows/ ci.yml docker.yml
├─ .env.example  Makefile  README.md  CLAUDE.md
└─ docs/  reference/  prompts/   # из этого пакета
```

## Переменные окружения (`.env.example`)

```
NUXT_SESSION_PASSWORD=          # 32+ символа
DATABASE_URL=postgresql://tourflow:tourflow@db:5432/tourflow
S3_ENDPOINT=http://minio:9000
S3_BUCKET=tourflow
S3_ACCESS_KEY=minio
S3_SECRET_KEY=minio12345
GOTENBERG_URL=http://gotenberg:3000
SMTP_URL=smtp://mailpit:1025
PII_ENCRYPTION_KEY=             # 32 байта base64, для ИИН и паспортов
PUBLIC_BASE_URL=http://localhost:3000
# провайдеры: mock | real
MESSAGING_PROVIDER=mock
SIGNING_PROVIDER=mock
TOUR_SEARCH_PROVIDER=mock
TOURVISOR_TOKEN=
WHATSAPP_CLOUD_TOKEN=
WHATSAPP_PHONE_ID=
TELEGRAM_BOT_TOKEN=
```

## Docker

**Dockerfile** — multi-stage: `deps` (pnpm install --frozen-lockfile) → `build` (`prisma generate`, `nuxt build`) → `runtime` (node:22-alpine, только `.output` и prisma, непривилегированный пользователь, `HEALTHCHECK` на `/api/health`, при старте `prisma migrate deploy`).

**docker-compose.yml** (dev/стенд): `app` (порт 3000), `db` (postgres:16-alpine, volume, healthcheck), `minio` (+ создание бакета), `gotenberg`, `mailpit` (UI 8025). Команда `make up` поднимает всё, `make seed` заливает демо-данные.

**docker-compose.prod.yml**: `app` из образа GHCR, `db` с бэкапом (pg_dump по cron в volume/S3), `caddy` или `nginx` с HTTPS, без mailpit.

## GitHub

- Репозиторий `tourflow` (private). Ветки: `main` (защищена, только через PR), `feat/*`.
- **ci.yml** на PR и push: pnpm install → lint → typecheck → vitest → nuxt build → Playwright (с postgres service).
- **docker.yml** на push в `main` и теги `v*`: сборка и публикация образа в `ghcr.io/<owner>/tourflow` (тег sha + latest + semver).
- Dependabot для npm и GitHub Actions.
- Секреты — в GitHub Secrets / на сервере в `.env`, не в репозитории.

## Безопасность

Сессии httpOnly, CSRF-защита для мутаций, rate-limit на логин и публичные страницы подписи, токены подписи — случайные 32 байта с истечением, проверка `organizationId` в каждом запросе, шифрование ИИН/паспортов (AES-256-GCM), аудит просмотров ПДн, бэкапы БД ежедневно, хранение данных на серверах в РК.
