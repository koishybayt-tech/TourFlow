# Tourflow

CRM для турагентств Казахстана: заявки, групповые и пакетные туры, договоры, оплаты, задачи, отчёты.
Nuxt 4 · PostgreSQL 16 · Prisma · Docker.

Документация продукта — в [`docs/`](docs), исходный пакет передачи — [`docs/HANDOFF.md`](docs/HANDOFF.md), решения по ходу разработки — [`docs/DECISIONS.md`](docs/DECISIONS.md).

## Запуск в Docker (проще всего)

Нужен только Docker Desktop.

```bash
cp .env.example .env
# впишите NUXT_APP_SECRET и PII_ENCRYPTION_KEY: openssl rand -base64 32
docker compose up -d --build   # или: make up
make seed                      # демо-данные (миграции применяются сами при старте)
```

| Сервис | Адрес |
|---|---|
| Приложение | http://localhost:3000 (вход `erlan@demo.travel` / `demo1234`) |
| Почта (Mailpit) | http://localhost:8025 |
| Хранилище файлов (S3, SeaweedFS) | http://localhost:9000 |
| PostgreSQL | localhost:5432, `tourflow` / `tourflow` |

## Разработка без Docker для приложения

Нужны Node 22 и pnpm. pnpm сам скачает Node 22 для проекта (`devEngines` в `package.json`).

```bash
pnpm install
docker compose up -d db s3 gotenberg mailpit   # только инфраструктура
pnpm db:migrate
pnpm db:seed
pnpm dev                                       # http://localhost:3000
```

## Проверки

```bash
pnpm lint && pnpm typecheck && pnpm test
pnpm build && pnpm test:e2e                    # e2e на собранном приложении
```

CI (`.github/workflows/ci.yml`) прогоняет всё это на каждый PR и push в `main`.
При push в `main` и тегах `v*` образ публикуется в `ghcr.io/koishybayt-tech/tourflow`.

## Продакшен

```bash
cp .env.example .env    # DOMAIN, POSTGRES_PASSWORD, секреты
docker compose -f docker-compose.prod.yml up -d
```

HTTPS выдаёт Caddy автоматически. Бэкап базы — ежедневно в volume `backups`.
Сервер лучше размещать в Казахстане (закон РК о персональных данных).
