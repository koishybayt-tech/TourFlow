# 03. Модель данных

Мультиарендность: **каждая таблица (кроме User) содержит `organizationId`**, все запросы фильтруются по организации текущей сессии (Prisma middleware/extension). Деньги — `Int` (тенге). Валютные суммы — `Decimal(12,2)` + `currency`. Время — `DateTime` в UTC, отображение в Asia/Almaty. Мягкое удаление — `deletedAt` для заявок, клиентов, туров.

Ниже — черновик Prisma-схемы. Claude Code: доработай типы, индексы и связи, но сохрани сущности и смысл полей.

```prisma
enum Role { OWNER MANAGER CALLCENTER GUIDE }
enum Pipeline { GROUP PACKAGE BASE }
enum Channel { WHATSAPP INSTAGRAM SITE MANUAL CALL OFFICE REFERRAL }
enum Currency { KZT EUR USD CHF }
enum TaskStatus { TODO IN_PROGRESS DONE }
enum Priority { HIGH MEDIUM LOW }
enum TourStatus { DRAFT PUBLISHED CLOSED ARCHIVE }
enum OfferStatus { DRAFT SENT CHOSEN REJECTED }
enum BookingStatus { REQUEST CONFIRMED PAID CANCELLED }
enum SignStatus { NONE SENT SIGNED PAPER }
enum RequirementType { FIELD DOC SIGN PAY COMMENT CHECK DEPARTURE TRAVELERS EVENT CLIENT }

model Organization {
  id String @id @default(cuid())
  name String          // ТОО «Demo Travel»
  bin String           // 12 цифр
  director String
  legalAddress String
  bank String
  iik String           // KZ + 18
  bik String
  license String?
  phone String
  email String
  instagram String?
  refundRule String    // текст для договоров
  modules Json         // { group: true, package: false, tickets: true, team: false, migration: false }
  routing Json         // правила определения воронки (каналы, ключевые слова, fallback)
  createdAt DateTime @default(now())
}

model User { id String @id @default(cuid()) email String @unique phone String? @unique passwordHash String name String telegramChatId String? createdAt DateTime @default(now()) }
model Member { id String @id @default(cuid()) organizationId String userId String role Role onVacation Boolean @default(false) signRight Boolean @default(false) /* ЭЦП с правом подписи */ }

model Client {
  id String @id @default(cuid())
  organizationId String
  name String               // как в мессенджере
  phone String              // нормализованный +7XXXXXXXXXX
  extraPhones String[]
  email String?
  fullName String?          // ФИО полностью
  iinEnc String?            // ИИН — шифруется
  birthDate DateTime?
  address String?
  source Channel
  tags String[]
  note String?
  pdConsentAt DateTime?     // согласие на обработку ПДн
  createdAt DateTime @default(now())
  deletedAt DateTime?
  @@unique([organizationId, phone])
}

model Traveler { id String @id @default(cuid()) organizationId String clientId String? dealId String fullNameLatin String passportNoEnc String passportExpiry DateTime birthDate DateTime? iinEnc String? isChild Boolean @default(false) visaStatus String? }

model Direction { id String @id @default(cuid()) organizationId String name String keywords String[] managerIds String[] mode String /* single|round */ backupId String rrIndex Int @default(0) }

model Stage {
  id String @id @default(cuid())
  organizationId String
  pipeline Pipeline
  order Int
  name String
  description String        // «что сделать на этапе»
  requirements StageRequirement[]
}
model StageRequirement { id String @id @default(cuid()) stageId String type RequirementType label String required Boolean @default(true) config Json /* {field:'budget'} | {docType:'Виза'} | {mode:'prepay', perPerson:100000} */ order Int }

model Deal {
  id String @id @default(cuid())
  organizationId String
  number Int                // сквозной номер заявки в организации
  clientId String
  pipeline Pipeline
  stageId String
  directionId String?
  managerId String?
  source Channel
  title String              // запрос / тур
  dates String?             // свободный текст «Март–апрель»
  people Int @default(1)
  budget String?
  visaHistory String?
  price Int @default(0)     // ₸
  departureId String?
  wonAt DateTime?
  lostReason String?
  lostAt DateTime?
  reqChecks Json            // { [requirementId]: true } для CHECK
  reqComments Json          // { [requirementId]: 'текст' } для COMMENT
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
}

model Payment { id String @id @default(cuid()) organizationId String dealId String amount Int /* <0 = возврат */ type String /* Предоплата|Доплата|Полная оплата|Возврат */ method String paidAt DateTime createdById String }
model DealEvent { id String @id @default(cuid()) organizationId String dealId String at DateTime @default(now()) actorId String? actorLabel String kind String /* stage|pay|doc|note|system|... */ text String data Json? } // неизменяемая история
model Note { id String @id @default(cuid()) organizationId String dealId String authorId String text String stageRequirementId String? createdAt DateTime @default(now()) }

model Conversation { id String @id @default(cuid()) organizationId String channel Channel externalId String clientPhone String clientName String dealId String? unread Boolean @default(true) lead Json lastMessageAt DateTime }
model Message { id String @id @default(cuid()) conversationId String direction String /* in|out */ text String sentAt DateTime auto Boolean @default(false) }

model Task {
  id String @id @default(cuid())
  organizationId String
  title String
  description String?
  status TaskStatus @default(TODO)
  priority Priority @default(MEDIUM)
  dueAt DateTime?
  assigneeId String?
  authorId String?          // null = система
  dealId String?
  departureId String?
  stageId String?           // привязка к этапу
  isSystem Boolean @default(false) // системная задача этапа
  result String?
  subtasks Json             // [{t, done}]
  log Json                  // [{at, text, actor}]
  createdAt DateTime @default(now())
}

model Event { id String @id @default(cuid()) organizationId String type String /* meeting|call|visa|flight|pay|task|briefing */ title String startAt DateTime endAt DateTime? place String? assigneeId String? dealId String? departureId String? remind String? }

model DocumentTemplate { id String @id @default(cuid()) organizationId String kind String /* contract|receipt */ name String pipeline Pipeline? condition String? /* для расписок: all|pkg|hotel|visa|kids */ fileKey String /* S3 */ variables Json /* [{placeholder, field, count}] */ enabled Boolean @default(true) updatedAt DateTime @updatedAt }
model Document { id String @id @default(cuid()) organizationId String dealId String type String /* Паспорт|Виза|Договор|Расписка|Ваучер|Авиабилет|Чек|... */ name String fileKey String createdAt DateTime @default(now()) }
model Contract { id String @id @default(cuid()) organizationId String dealId String templateId String number String kind String /* contract|receipt */ fileKey String values Json /* итоговые значения переменных, вкл. ручные */ emptyFields String[] status SignStatus createdAt DateTime @default(now()) annulledAt DateTime? }
model Signature { id String @id @default(cuid()) contractId String side String /* client|agency */ token String @unique signerName String? method String? /* ncalayer|egov|sms|paper */ certInfo Json? cms String? signedAt DateTime? }

model Departure { id String @id @default(cuid()) organizationId String tourId String? name String startDate DateTime endDate DateTime type String visa Boolean minSeats Int maxSeats Int price Int guideId String? flightDeadline DateTime payDeadline DateTime briefingAt DateTime flightTaskDone Boolean @default(false) hotelTaskDone Boolean @default(false) }
model Participant { id String @id @default(cuid()) organizationId String departureId String dealId String? travelerId String? name String paid Int @default(0) step Int @default(0) /* используется, только если нет заявки */ }
model Guide { id String @id @default(cuid()) organizationId String fullName String iinEnc String? birthDate DateTime? sex String languages String[] experienceYears Int agencies String? rate Int rating Decimal(2,1)? reviewsCount Int @default(0) }

model Tour {
  id String @id @default(cuid())
  organizationId String
  slug String
  name String
  flags String?
  countries String[]
  route String
  startDate DateTime?
  endDate DateTime?
  seats Int
  price Int
  prepay Int
  riseDate DateTime?
  riseAmount Int?
  payRule String?
  description String
  coverKey String?
  status TourStatus @default(DRAFT)
  included String[]
  extra String[]
  rates Json               // { EUR: 545, USD: 505, CHF: 585 }
  ratesFixedAt DateTime?
  pricesCheckedAt DateTime?
  departureId String?
  days TourDay[]
  flights TourFlight[]
  stays TourStay[]
  costs TourCost[]
  posts Json               // [{kind:'Пост'|'Reels', url}]
  @@unique([organizationId, slug])
}
model TourDay { id String @id @default(cuid()) tourId String order Int city String items String[] description String transfer String? mediaKeys String[] availabilityChecked Boolean @default(false) }
model TourFlight { id String @id @default(cuid()) tourId String from String to String departAt DateTime? airline String? ticket Decimal(12,2)? baggage Decimal(12,2)? currency Currency link String? }
model TourStay { id String @id @default(cuid()) tourId String city String name String checkIn DateTime? checkOut DateTime? rooms Int guests Int total Decimal(12,2)? currency Currency link String? note String? }
model TourCost { id String @id @default(cuid()) tourId String category String plan Decimal(12,2)? fact Decimal(12,2)? unit String /* KZT|EUR|USD|CHF|PERCENT */ per String /* tourist|group */ }

model Operator { id String @id @default(cuid()) organizationId String name String paymentTerms String commissionPct Decimal(4,1) contact String? }
model Offer { id String @id @default(cuid()) organizationId String dealId String operatorId String hotel String stars Int resort String fromDate DateTime toDate DateTime meal String room String flight Boolean transfer Boolean insurance Boolean net Int price Int status OfferStatus @default(DRAFT) selected Boolean @default(true) note String? source String? /* manual|import|tourvisor */ externalRef String? }
model OperatorBooking { id String @id @default(cuid()) organizationId String dealId String offerId String operatorId String number String? status BookingStatus createdAt DateTime @default(now()) confirmedAt DateTime? paymentDeadline DateTime net Int cancelReason String? penalty Int? }
model OperatorPayment { id String @id @default(cuid()) bookingId String amount Int method String paidAt DateTime }

model PriceWatch { id String @id @default(cuid()) organizationId String userId String kind String /* flight|hotel */ query Json lastPrice Int createdAt DateTime @default(now()) }
model Notification { id String @id @default(cuid()) organizationId String userId String title String body String link String? readAt DateTime? createdAt DateTime @default(now()) }
model AuditLog { id String @id @default(cuid()) organizationId String userId String action String entity String entityId String meta Json? at DateTime @default(now()) } // в т.ч. каждый просмотр ИИН/паспорта
```

## Сиды (демо-данные)

Повторить данные прототипа (`reference/prototype_source.dc.html`, конструктор `Component`): организация «Demo Travel» (Алматы), пользователи Ерлан (владелец), Аягөз (менеджер), Дана (менеджер, в отпуске); 4 выезда (Будапешт — Вена, Рим — Флоренция — Венеция, Чарын — Кольсай — Каинды, Стамбул — Каппадокия), 5 гидов, ~17 заявок во всех воронках (включая успешную 2025 и 3 отказа), сообщения, задачи, 4 туроператора (Anex Tour, FUN&SUN, Pegas Touristik, Kompas), 2 тура конструктора (GRAND TOUR, Швейцария), шаблоны договоров и 9 расписок, 7 направлений.

### Регламенты этапов по умолчанию

**Групповые туры:** Новая (даты, количество, первый ответ отправлен) → Консультация (бюджет, выбран выезд, итог консультации) → Визовая проверка (туристы с паспортами, скан паспорта, визовая история, срок паспорта ≥ 6 мес.) → Договор (данные клиента для договора, договор подписан обеими сторонами) → Предоплата (от 100 000 ₸ на человека, визовая запись в календаре, чек — необяз.) → Виза (скан визы, проверены ФИО/даты/номер) → Полная оплата (100%) → Готов к выезду (билеты, инструкция отправлена, отзыв — необяз.).

**Пакетные туры:** Новая (даты, количество) → Подбор (бюджет, пожелания) → Предложение отправлено (подборка отправлена, какой вариант выбран) → Бронь у оператора (номер брони, данные клиента, договор подписан) → Оплата (100%, оплата оператору проведена) → Документы выданы (ваучер, авиабилеты).

**Базовая:** Новая (первый ответ) → В работе (суть запроса) → Предложение (отправлено) → Ожидание решения (ответ клиента) → Договор и оплата (данные клиента, договор, 100%).

Связь шагов участника выезда с этапом заявки (визовый тур): `[0,0,1,2,3,5,6,7]`, без визы: `[0,0,0,1,2,2,3,4]` — индекс = этап заявки, значение = шаг участника.
