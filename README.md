# UYA HOME

Система учёта для производства мебели из ЛДСП, которое работает **на склад**:
готовый упакованный товар лежит на стеллажах, заказ отгружается сразу,
резка (партия раскроя) запускается, когда товар опускается ниже минимума.

**Стек:** Next.js 14 (App Router, TypeScript, Tailwind) · Supabase (Postgres, Auth, Storage, Realtime) · Telegram-бот (Telegraf, вебхук) · Vercel.

---

## Как это работает

```
Заказ (Lalafo / WhatsApp / Instagram / Mesto / звонок)
   │
   ├─ на складе хватает ──► списание, статус «К отгрузке» ──► Telegram мастеру 📦
   │                                                          └► мастер печатает бейджик A6 и отгружает
   └─ не хватает ─────────► статус «Ждёт производства»
                                   │
остаток < минимума ──► Telegram ⚠️ ──► менеджер создаёт партию раскроя ──► Telegram 🪚
                                                    │
                       мастер: «Детали принял» → «Готов» (факт + обрезки)
                                                    │
                       склад += факт, ждущие заказы (FIFO) → «К отгрузке» → Telegram 📦
```

Вся складская логика — в транзакционных функциях Postgres (`create_order`,
`complete_cut_batch`, …) с блокировкой строк, поэтому два одновременных
заказа не «продадут» один стол дважды.

### Уведомления в Telegram

Триггеры БД кладут сообщения в таблицу `notifications`, сервер сразу
отправляет их мастеру. Если Telegram был недоступен — сообщение
остаётся в очереди (до 5 попыток) и досылается при следующем действии
или раз в сутки по Vercel Cron.

| Событие | Сообщение |
| --- | --- |
| Заказ готов к отгрузке | 📦 Новый заказ на отправку №UYA-012: Стол-5 × 1 шт. Клиент… Адрес… |
| Остаток ниже минимума | ⚠️ ВНИМАНИЕ! Стол-5 заканчивается! Осталось 2, минимум 5 |
| Новая партия | 🪚 Новая Партия №15: 2 листа, 2 товара (5 шт.) + список |
| Заказ ждёт производства | ⏳ Заказ №UYA-013 ждёт производства… |

---

## Страницы

| Адрес | Кто | Что |
| --- | --- | --- |
| `/admin` | директор, менеджер | Склад: фото, название, остаток, минимум, статус 🟢/🔴 |
| `/admin/products/new` | директор, менеджер | Новый товар + загрузка фото / PDF раскроя / инструкции |
| `/admin/orders`, `/admin/orders/new` | директор, менеджер | Заказы, новый заказ |
| `/batches`, `/batches/new` | директор, менеджер | Партии раскроя: галочками выбрать товары ниже минимума, листы ЛДСП, PDF |
| `/admin/remnants` | директор, менеджер | Обрезки ЛДСП |
| `/admin/users` | директор | Сотрудники и роли |
| `/master` | все | PWA для телефона мастера: партии и заказы, огромные кнопки |
| `/print/badge/[id]` | все | Бейджик клиента A6 для печати |

---

## Запуск

### 1. Supabase

1. Создайте проект на [supabase.com](https://supabase.com).
2. Примените миграции **по порядку** — либо через CLI:
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref-проекта>
   npx supabase db push
   ```
   либо вручную: **SQL Editor** → вставить и выполнить файлы из `supabase/migrations/`
   в порядке имён.
3. (Необязательно) тестовые товары — `supabase/seed.sql`.
4. **Authentication → Users → Add user** — создайте свой аккаунт (email + пароль,
   отметьте *Auto Confirm User*). **Первый пользователь автоматически становится директором.**
   Остальных сотрудников директор добавляет на странице `/admin/users`.
5. **Authentication → Providers → Email**: можно отключить *Allow new users to sign up* —
   регистрация не нужна, сотрудников создаёт директор.

Миграции создают таблицы, триггеры, RLS-политики, бакеты Storage `products`
и `batches` и включают Realtime для экрана мастера.

### 2. Telegram-бот

1. В [@BotFather](https://t.me/BotFather): `/newbot` → получите токен.
2. Задеплойте приложение (шаг 4), затем один раз откройте в браузере:
   ```
   https://<ваш-домен>/api/telegram/setup?secret=<TELEGRAM_WEBHOOK_SECRET>
   ```
   Это зарегистрирует вебхук и команды бота.
3. Мастер пишет боту `/start` — бот ответит его `chat_id`.
   Впишите его в `TELEGRAM_MASTER_CHAT_ID` (несколько — через запятую) и сделайте Redeploy.

Команды бота: `/start` — подключение, `/tasks` — текущие задачи.

### 3. Локально

```bash
cp .env.example .env.local   # заполните ключи
npm install
npm run dev                  # http://localhost:3000
```

Локально Telegram-вебхук не работает (нужен публичный HTTPS), но
**исходящие** уведомления мастеру отправляются и с localhost.

### 4. Деплой на Vercel

1. **Add New → Project** → импортируйте репозиторий `uya-home`.
2. **Environment Variables** — все переменные из `.env.example`.
   `NEXT_PUBLIC_APP_URL` = адрес проекта на Vercel (`https://uya-home.vercel.app`).
3. Deploy. Затем шаг 2 из раздела «Telegram-бот».

### Переменные окружения

| Переменная | Где взять |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role (**секрет!**) |
| `TELEGRAM_BOT_TOKEN` | @BotFather |
| `TELEGRAM_MASTER_CHAT_ID` | ответ бота на `/start` |
| `TELEGRAM_WEBHOOK_SECRET` | любая длинная случайная строка |
| `NEXT_PUBLIC_APP_URL` | адрес сайта |
| `CRON_SECRET` | любая случайная строка (Vercel передаёт её в cron-запросе) |

---

## Телефон мастера

**Установка как приложение:** открыть `https://<домен>/master` в Chrome (Android)
→ меню ⋮ → «Установить приложение» / «Добавить на главный экран».
На iPhone: Safari → «Поделиться» → «На экран Домой».
Новые задачи появляются на экране сами (Supabase Realtime).

**Печать бейджика без драйверов:** заказ → «🖨 Напечатать бейджик клиента» →
откроется системный диалог печати.
- Android: принтер в той же Wi-Fi сети находится через встроенную
  «Службу печати по умолчанию» (или приложение Mopria Print Service).
- iPhone: AirPrint, работает из коробки.
- Выберите размер бумаги **A6** и масштаб **100%** (или «По размеру страницы»).

---

## Структура проекта

```
supabase/migrations/   SQL: схема, функции/триггеры, RLS + Storage
supabase/seed.sql      тестовые данные
app/(staff)/admin      склад, товары, заказы, обрезки, сотрудники
app/(staff)/batches    партии раскроя
app/master             PWA мастера
app/print/badge/[id]   бейджик A6
app/api/telegram       вебхук и настройка бота
app/api/cron           досылка уведомлений
app/actions            server actions
lib/telegram           бот (Telegraf) и очередь уведомлений
lib/supabase           клиенты Supabase (браузер / сервер / service role)
components             UI-компоненты
```

## Команды

```bash
npm run dev        # разработка
npm run build      # production-сборка
npm run lint       # ESLint
npm run typecheck  # проверка типов
```
