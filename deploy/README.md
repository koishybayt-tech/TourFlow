# Развёртывание Tourflow на сервере

Инструкция для сервера Ubuntu 22.04/24.04 с Docker. Персональные данные клиентов по закону РК лучше хранить на сервере в Казахстане (PS Cloud, Kazakhtelecom Cloud, Hoster.kz и т. п.).

## 1. Сервер

Минимум: 2 vCPU, 4 ГБ RAM, 40 ГБ SSD. Откройте порты 80 и 443.

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # перелогиньтесь после этого
```

Направьте DNS-запись домена (например, `crm.agency.kz`) на IP сервера — Caddy сам получит HTTPS-сертификат.

## 2. Код и настройки

```bash
git clone git@github.com:koishybayt-tech/TourFlow.git tourflow && cd tourflow
cp .env.example .env
```

В `.env` обязательно:

| Переменная | Значение |
|---|---|
| `DOMAIN` | ваш домен, например `crm.agency.kz` |
| `POSTGRES_PASSWORD` | длинный случайный пароль: `openssl rand -base64 24` |
| `NUXT_APP_SECRET` | `openssl rand -base64 32` |
| `PII_ENCRYPTION_KEY` | `openssl rand -base64 32` — **сохраните отдельно**, без него зашифрованные ИИН и паспорта не прочитать |
| `IMAGE` | `ghcr.io/koishybayt-tech/tourflow:latest` или конкретная версия `:0.1.0` |
| `SMTP_URL`, `MAIL_FROM` | почта для восстановления пароля, приглашений и отчётов |

Хранилище файлов — один из вариантов:

- **Своё на этом же сервере:** `cp docker/s3.prod.json.example docker/s3.prod.json`, впишите ключи; те же ключи — в `.env` как `S3_ACCESS_KEY` / `S3_SECRET_KEY`; запускайте с `--profile s3`.
- **Внешний S3 в Казахстане:** укажите `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`; бакет создаётся автоматически.

## 3. Запуск

Образ приватного репозитория скачивается из GHCR после входа (токен GitHub с правом `read:packages`):

```bash
echo <GITHUB_TOKEN> | docker login ghcr.io -u <github-логин> --password-stdin
docker compose --profile s3 -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml logs -f app
```

Миграции базы применяются автоматически при старте. Откройте `https://<DOMAIN>/register` и зарегистрируйте агентство — создадутся воронки, регламенты и шаблоны.

Демо-данные (только для стенда, **стирает базу**):

```bash
docker compose -f docker-compose.prod.yml exec app node_modules/.bin/tsx prisma/seed.ts
```

## 4. Обновление

```bash
git pull
docker compose --profile s3 -f docker-compose.prod.yml pull
docker compose --profile s3 -f docker-compose.prod.yml up -d
```

Новый образ публикуется GitHub Actions при каждом мерже в `main` (`:latest`, `:sha-…`) и при теге `v*` (`:0.1.0`).

## 5. Бэкапы

Сервис `backup` каждый день кладёт `pg_dump` в volume `backups` и хранит 14 дней. Копируйте их за пределы сервера:

```bash
docker compose -f docker-compose.prod.yml cp backup:/backups ./backups
```

Восстановление (заменит текущие данные):

```bash
docker compose -f docker-compose.prod.yml run --rm -v "$PWD/docker/restore.sh:/restore.sh:ro" backup /bin/sh /restore.sh tourflow-2026-11-05.sql.gz
docker compose -f docker-compose.prod.yml restart app
```

Файлы (договоры, сканы) лежат в S3 — бэкапьте и его (`s3` volume или средствами провайдера).

## 6. Подключение реальных сервисов

Всё работает без ключей на mock-провайдерах. Реальные подключения включаются переменными в `.env` и перезапуском `app`.

| Сервис | Что сделать |
|---|---|
| **WhatsApp Business (Cloud API)** | В Meta for Developers создайте приложение WhatsApp, получите постоянный токен и Phone number ID. В `.env`: `MESSAGING_PROVIDER=real`, `WHATSAPP_CLOUD_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`. Вебхук: `https://<DOMAIN>/api/webhooks/whatsapp/<id организации>` (адрес показан в Настройки → Каналы). |
| **Instagram Direct** | То же приложение Meta, продукт Instagram Messaging. `INSTAGRAM_APP_SECRET`, вебхук `/api/webhooks/instagram/<id>`. |
| **Форма на сайте** | `POST https://<DOMAIN>/api/public/lead/<id>` с полями `name`, `phone`, `text`. |
| **Telegram-бот для сотрудников** | Создайте бота у @BotFather. `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET` (любая строка). Зарегистрируйте вебхук: `curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<DOMAIN>/api/webhooks/telegram&secret_token=<SECRET>"`. Сотрудник получает код в Профиль → Уведомления и отправляет боту `/start КОД`. |
| **Tourvisor** | Запросите доступ к API для агентств в кабинете турагента. `TOUR_SEARCH_PROVIDER=real`, `TOURVISOR_TOKEN`. Разбор ответа поиска дописывается после получения доступа (см. `server/providers/tourSearch`). |
| **ЭЦП (NCALayer / eGov Mobile)** | Страница подписания сама находит NCALayer на компьютере клиента и получает CMS. Для юридически значимой проверки сертификатов НУЦ РК нужен сервис проверки (например, NCANode) — `SIGNING_PROVIDER=real` и адаптер в `server/providers/signing`. |
| **Распознавание скриншотов вариантов** | `ANTHROPIC_API_KEY` (Claude API). Без ключа менеджер заполняет форму сам. |

## 7. Проверка после запуска

- `https://<DOMAIN>/api/health` → `{"status":"ok","db":"ok"}`
- Вход, создание заявки, загрузка документа, формирование договора (PDF собирается в контейнере Gotenberg).
