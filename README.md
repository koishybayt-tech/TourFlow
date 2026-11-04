# Tourflow — пакет передачи в Claude Code

Этот пакет — всё, что нужно, чтобы Claude Code собрал из прототипа рабочий сервис на **Nuxt 4** в **Docker** и выложил его в **GitHub**.

## Что внутри

| Путь | Что это |
|---|---|
| `CLAUDE.md` | Память проекта для Claude Code: контекст, правила, стек, команды. Claude Code читает его сам в начале каждой сессии |
| `docs/01_PRODUCT.md` | Продукт, роли, модули, терминология |
| `docs/02_FEATURES.md` | Поведение каждого экрана и бизнес-правила |
| `docs/03_DATA_MODEL.md` | Модель данных (черновик Prisma-схемы) и демо-данные |
| `docs/04_DESIGN_SYSTEM.md` | Цвета, типографика, компоненты, анимации |
| `docs/05_ARCHITECTURE.md` | Стек, структура, Docker, CI, безопасность |
| `prompts/00…11` | Промпты по фазам — вставляются в Claude Code по очереди |
| `reference/prototype.html` | Кликабельный прототип (открыть двойным кликом) |
| `reference/prototype_source.dc.html` | Исходник прототипа с логикой |
| `reference/experts/` | ТЗ Feel Free Travel, их макет, текст гайда по Швейцарии, вопросы эксперту |
| `reference/poedem_screens/` | Скриншоты системы Poedem от эксперта |

PDF-гайд по Швейцарии (100 МБ) в пакет не вложен — GitHub не принимает файлы больше 100 МБ. Его текст лежит в `guide_switzerland_march.txt`.

---

## Шаг 1. Подготовка компьютера

Нужно установить:

1. **Git** — https://git-scm.com
2. **Docker Desktop** — https://www.docker.com/products/docker-desktop (на Linux — Docker Engine + Compose plugin)
3. **Node.js 22 LTS** — https://nodejs.org и **pnpm**: `npm install -g pnpm`
4. **GitHub CLI** (удобно для репозитория и PR) — https://cli.github.com, затем `gh auth login`
5. **Claude Code.** Нужна подписка Claude Pro, Max, Team или Enterprise. Установка по официальной инструкции (https://code.claude.com/docs/en/overview):
   - macOS / Linux: `curl -fsSL https://claude.ai/install.sh | bash`
   - Windows (PowerShell): `irm https://claude.ai/install.ps1 | iex`
   - или Homebrew: `brew install --cask claude-code`

   Проверка: `claude --version`. При первом запуске Claude Code попросит войти в аккаунт.

## Шаг 2. Репозиторий

```bash
mkdir tourflow && cd tourflow
git init -b main
# распакуйте сюда содержимое архива tourflow-handoff (CLAUDE.md, docs/, prompts/, reference/)
git add . && git commit -m "chore: project handoff docs and prototype"
gh repo create tourflow --private --source=. --push
```

Без GitHub CLI: создайте пустой приватный репозиторий на github.com и выполните `git remote add origin git@github.com:<вы>/tourflow.git && git push -u origin main`.

## Шаг 3. Запуск Claude Code

```bash
cd tourflow
claude
```

Полезно знать:
- **Ссылка на файл в сообщении** — `@prompts/01_scaffold.md`: Claude Code прочитает файл целиком.
- **Режим планирования** — `Shift+Tab` переключает режимы; в режиме плана Claude Code сначала предлагает план, ничего не меняя.
- **`/clear`** — очистить контекст между фазами (CLAUDE.md и файлы остаются).
- Claude Code спрашивает разрешение на команды и изменения файлов. Читайте и подтверждайте; для рутинных команд (`pnpm`, `docker compose`) можно разрешить «всегда».

## Шаг 4. Фазы

Каждую фазу запускайте одним сообщением и **сначала утверждайте план**:

| Фаза | Сообщение в Claude Code | Результат |
|---|---|---|
| 0 | `Выполни @prompts/00_onboarding.md` | Понимание проекта, вопросы, план. Ответьте на вопросы |
| 1 | `Выполни @prompts/01_scaffold.md` | Nuxt 4, Docker, CI, пустой AppShell |
| 2 | `Выполни @prompts/02_data_seed.md` | БД, шифрование ПДн, демо-данные, доменная логика с тестами |
| 3 | `Выполни @prompts/03_auth_shell.md` | Вход, роли, меню, «Мой день» |
| 4 | `Выполни @prompts/04_inbox_clients_routing.md` | Сообщения, клиенты, распределение |
| 5 | `Выполни @prompts/05_deals.md` | Заявки, автостатус, задачи (самая важная фаза) |
| 6 | `Выполни @prompts/06_documents.md` | Шаблоны, договоры, подписание, расписки |
| 7 | `Выполни @prompts/07_group_tours.md` | Конструктор туров, выезды, публичная страница |
| 8 | `Выполни @prompts/08_package_tours.md` | Поиск туров, брони у операторов, авиа и отели |
| 9 | `Выполни @prompts/09_calendar_reports_notify.md` | Календарь, уведомления, отчёты |
| 10 | `Выполни @prompts/10_polish.md` | Удобство, красота, анимации, мобильная версия |
| 11 | `Выполни @prompts/11_deploy.md` | Продакшен-деплой, релиз v0.1.0 |

После каждой фазы:
1. Проверьте результат сами: `docker compose up -d` → http://localhost:3000 (логин `erlan@demo.travel` / `demo1234`).
2. Сравните с `reference/prototype.html`.
3. Если что-то не так — напишите Claude Code конкретно: «на странице заявки блок Оплаты не сворачивается, ожидаю как в прототипе».
4. Смержите PR в `main` (`gh pr merge --squash`), затем `/clear` и следующая фаза.

Фазы большие. Если Claude Code предлагает разбить фазу на части — соглашайтесь.

## Шаг 5. Docker локально

```bash
cp .env.example .env          # заполните NUXT_SESSION_PASSWORD и PII_ENCRYPTION_KEY
docker compose up -d          # app :3000, postgres, minio :9001, gotenberg, mailpit :8025
make migrate && make seed     # схема и демо-данные
docker compose logs -f app
```

## Шаг 6. GitHub и образ

- На каждый PR запускается CI: линт, типы, тесты, сборка, e2e.
- При мерже в `main` собирается Docker-образ и публикуется в `ghcr.io/<вы>/tourflow`.
- Релиз: `git tag v0.1.0 && git push --tags`.

## Шаг 7. Сервер (после фазы 11)

На сервере с Docker (желательно в Казахстане — требование закона о персональных данных):

```bash
git clone git@github.com:<вы>/tourflow.git && cd tourflow
cp .env.example .env    # прод-значения, домен
docker compose -f docker-compose.prod.yml up -d
```

HTTPS выдаёт Caddy автоматически. Обновление: `docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d`.

---

## Советы по работе с Claude Code

- **Одна фаза — одна сессия.** Длинные сессии теряют фокус; `/clear` между фазами.
- **Просите показать, а не рассказать:** «запусти e2e и покажи скриншот страницы заявки».
- **Фиксируйте решения в CLAUDE.md.** Если договорились о новом правиле — попросите: «добавь это правило в CLAUDE.md».
- **Реальные интеграции подключаются ключами в `.env`.** До этого всё работает на mock-провайдерах: WhatsApp, Tourvisor, NCALayer, Telegram.
- **Перед фазой 8** запросите у Tourvisor доступ к API для агентств (личный кабинет турагента). Перед реальной отправкой в WhatsApp нужна верификация WhatsApp Business API у провайдера.
- **Тексты договоров и расписок** перед запуском согласуйте с юристом.

## Открытые вопросы к экспертам (ответы передать Claude Code)

- Список источников авиабилетов и отелей (эксперт обещал прислать).
- Ответы из `reference/experts/questions_to_expert.docx`: этапы пакетного тура, фильтры, источники.
- Правила возврата и удержания у агентства.
- Год туров Feel Free Travel (в ТЗ не указан, в демо — 2027).
