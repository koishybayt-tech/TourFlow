# Фаза 11. Деплой и передача

- Финальный `docker-compose.prod.yml` (app из GHCR, postgres с ежедневным pg_dump, caddy с автоматическим HTTPS, MinIO или внешний S3), `deploy/README.md`: как развернуть на сервере (Ubuntu, Docker), обновление (`docker compose pull && up -d`), бэкап и восстановление.
- Тег `v0.1.0`, релиз в GitHub с changelog.
- Проверь, что `git clone` + `cp .env.example .env` + `docker compose up -d` + `make seed` поднимает рабочую демо-версию с нуля.
- Обнови README: скриншоты, демо-логины, архитектура, как подключить реальные провайдеры (WhatsApp Cloud API, Tourvisor, Telegram, NCALayer).

**Порядок работы:** сначала покажи план (файлы, модели, компоненты, риски) и дождись моего «ок». Потом реализация маленькими коммитами в ветке `feat/11-deploy`. В конце: `pnpm lint && pnpm typecheck && pnpm test` зелёные, краткий отчёт «что сделано / как проверить / что осталось», открой PR.
