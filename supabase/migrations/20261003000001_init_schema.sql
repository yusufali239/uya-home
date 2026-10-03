-- =====================================================================
-- UYA HOME — базовая схема
-- Модель: работаем НА СКЛАД. Готовый упакованный товар лежит на складе,
-- заказ сразу отгружается. Резка (партия раскроя) — когда товар кончается.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- ENUM-типы
-- ---------------------------------------------------------------------
create type public.order_source as enum ('lalafo', 'whatsapp', 'instagram', 'mesto', 'call');

create type public.order_status as enum (
  'new',                -- новый (создан вручную, не обработан)
  'confirmed',          -- подтверждён клиентом
  'ready_to_ship',      -- товар зарезервирован со склада, можно отгружать
  'shipped',            -- отгружен
  'waiting_production'  -- на складе не хватило, ждём партию раскроя
);

create type public.batch_status as enum ('planned', 'in_progress', 'completed');

create type public.user_role as enum ('director', 'manager', 'master');

create type public.notification_type as enum (
  'low_stock',        -- остаток упал ниже минимума
  'order_ready',      -- заказ готов к отгрузке
  'batch_created',    -- создана новая партия раскроя
  'order_waiting'     -- заказ ждёт производства (на складе не хватило)
);

-- ---------------------------------------------------------------------
-- Профили пользователей (роль привязана к auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  role        public.user_role not null default 'master',
  created_at  timestamptz not null default now()
);

comment on table public.profiles is 'Пользователи системы и их роли (директор / менеджер / мастер)';

-- ---------------------------------------------------------------------
-- Товары (каталог)
-- ---------------------------------------------------------------------
create table public.products (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,                       -- «Стол-5»
  sku                 text not null unique,                -- артикул / код
  color               text,
  dimensions          text,                                -- «1200x600x750»
  price               numeric(12, 2) not null default 0 check (price >= 0),
  cost_price          numeric(12, 2) not null default 0 check (cost_price >= 0),
  min_quantity        integer not null default 0 check (min_quantity >= 0), -- минималка от директора
  sketchcut_file_url  text,                                -- PDF карты раскроя (SketchCut)
  instruction_url     text,                                -- инструкция по сборке
  brand_photo_url     text,                                -- фото товара для бейджика
  created_at          timestamptz not null default now()
);

comment on column public.products.min_quantity is 'Минимальный остаток готовой продукции. Ниже — сигнал на резку';

-- ---------------------------------------------------------------------
-- Склад готовой продукции (одна строка на товар)
-- ---------------------------------------------------------------------
create table public.inventory_finished (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null unique references public.products (id) on delete cascade,
  quantity    integer not null default 0 check (quantity >= 0), -- готовых упакованных
  location    text,                                             -- «Стеллаж А1»
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Заказы
-- ---------------------------------------------------------------------
create sequence public.order_number_seq start 1;

create table public.orders (
  id              uuid primary key default gen_random_uuid(),
  order_number    text not null unique
                    default ('UYA-' || lpad(nextval('public.order_number_seq')::text, 3, '0')),
  source          public.order_source not null,
  client_name     text not null,
  client_phone    text not null,
  client_address  text not null,
  product_id      uuid not null references public.products (id) on delete restrict,
  quantity        integer not null default 1 check (quantity > 0),
  status          public.order_status not null default 'new',
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  shipped_at      timestamptz
);

create index orders_status_idx on public.orders (status, created_at);
create index orders_product_idx on public.orders (product_id);

-- ---------------------------------------------------------------------
-- Партии раскроя
-- ---------------------------------------------------------------------
create sequence public.batch_number_seq start 1;

create table public.cut_batches (
  id                  uuid primary key default gen_random_uuid(),
  batch_number        integer not null unique default nextval('public.batch_number_seq'),
  status              public.batch_status not null default 'planned',
  ldsp_sheet_count    integer not null check (ldsp_sheet_count > 0),
  sketchcut_file_url  text,              -- PDF раскроя для этой партии
  notes               text,
  created_by          uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  started_at          timestamptz,       -- мастер нажал «Детали принял»
  completed_at        timestamptz        -- мастер нажал «Готов»
);

create index cut_batches_status_idx on public.cut_batches (status);

create table public.cut_batch_items (
  id                   uuid primary key default gen_random_uuid(),
  batch_id             uuid not null references public.cut_batches (id) on delete cascade,
  product_id           uuid not null references public.products (id) on delete restrict,
  quantity_to_produce  integer not null check (quantity_to_produce > 0),
  quantity_produced    integer check (quantity_produced >= 0), -- заполняет мастер по факту
  notes                text,
  unique (batch_id, product_id)
);

create index cut_batch_items_batch_idx on public.cut_batch_items (batch_id);

-- ---------------------------------------------------------------------
-- Обрезки ЛДСП (деловой остаток)
-- ---------------------------------------------------------------------
create table public.scrap_remnants (
  id          uuid primary key default gen_random_uuid(),
  size        text not null,          -- «800x600»
  color       text,
  quantity    integer not null default 1 check (quantity > 0),
  batch_id    uuid references public.cut_batches (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Очередь уведомлений (отправляются в Telegram сервером приложения)
-- ---------------------------------------------------------------------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  type        public.notification_type not null,
  message     text not null,
  product_id  uuid references public.products (id) on delete cascade,
  order_id    uuid references public.orders (id) on delete cascade,
  batch_id    uuid references public.cut_batches (id) on delete cascade,
  attempts    integer not null default 0,
  sent_at     timestamptz,             -- null = ещё не отправлено
  last_error  text,
  -- clock_timestamp(), а не now(): внутри одной транзакции порядок сообщений сохраняется
  created_at  timestamptz not null default clock_timestamp()
);

create index notifications_unsent_idx on public.notifications (created_at) where sent_at is null;
