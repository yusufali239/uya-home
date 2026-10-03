-- =====================================================================
-- UYA HOME — модели товаров с цветами + детали (раскрой) модели
--
-- Модель (product_models) — «Zedd»: название, размеры, цена, файлы, фото,
-- список деталей. Цвет — это строка products (вариант модели) со своим
-- артикулом, остатком, минимумом и фото. Склад, заказы и партии как и
-- раньше работают по products, поэтому вся складская логика не меняется.
-- =====================================================================

create table public.product_models (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  dimensions          text,
  price               numeric(12, 2) not null default 0 check (price >= 0),
  cost_price          numeric(12, 2) not null default 0 check (cost_price >= 0),
  sketchcut_file_url  text,
  instruction_url     text,
  photo_url           text,
  description         text,
  created_at          timestamptz not null default now()
);

comment on table public.product_models is 'Модель мебели; цвета — строки products с model_id';

alter table public.products add column model_id uuid references public.product_models (id) on delete restrict;

-- ---------------------------------------------------------------------
-- Перенос: товары с одинаковым названием → одна модель с несколькими цветами
-- ---------------------------------------------------------------------
do $$
declare
  r record;
  v_model uuid;
begin
  for r in
    select distinct on (lower(trim(name))) lower(trim(name)) as key, name, dimensions, price, cost_price,
           sketchcut_file_url, instruction_url, brand_photo_url
    from public.products
    order by lower(trim(name)), created_at
  loop
    insert into public.product_models (name, dimensions, price, cost_price, sketchcut_file_url, instruction_url, photo_url)
    values (r.name, r.dimensions, r.price, r.cost_price, r.sketchcut_file_url, r.instruction_url, r.brand_photo_url)
    returning id into v_model;

    update public.products set model_id = v_model where lower(trim(name)) = r.key;
  end loop;
end;
$$;

alter table public.products alter column model_id set not null;
create index products_model_idx on public.products (model_id);

-- Цвет внутри модели не повторяется
create unique index products_model_color_uq on public.products (model_id, lower(coalesce(color, '')));

-- ---------------------------------------------------------------------
-- Общие поля модели копируются в её цвета (на них опираются заказы,
-- бейджик, уведомления — так существующий код продолжает работать)
-- ---------------------------------------------------------------------
create or replace function public.sync_model_to_products()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.products
     set name = new.name,
         dimensions = new.dimensions,
         price = new.price,
         cost_price = new.cost_price,
         sketchcut_file_url = new.sketchcut_file_url,
         instruction_url = new.instruction_url
   where model_id = new.id;
  return new;
end;
$$;

create trigger product_models_sync
  after update on public.product_models
  for each row execute function public.sync_model_to_products();

-- Новый цвет: общие поля берутся из модели (приложение передаёт только
-- model_id, цвет, артикул, минимум и фото)
create or replace function public.fill_product_from_model()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.product_models;
begin
  select * into m from public.product_models where id = new.model_id;
  if found then
    new.name := m.name;
    new.dimensions := m.dimensions;
    new.price := m.price;
    new.cost_price := m.cost_price;
    new.sketchcut_file_url := m.sketchcut_file_url;
    new.instruction_url := m.instruction_url;
  end if;
  return new;
end;
$$;

create trigger products_fill_from_model
  before insert or update of model_id on public.products
  for each row execute function public.fill_product_from_model();

-- Подпись товара для сообщений: «Zedd (Oq)»
create or replace function public.product_label(p public.products)
returns text
language sql
immutable
as $$
  select p.name || case when coalesce(trim(p.color), '') <> '' then ' (' || trim(p.color) || ')' else '' end;
$$;

-- =====================================================================
-- Детали модели: что вырезается из ЛДСП для одного изделия
-- =====================================================================
create table public.product_parts (
  id            uuid primary key default gen_random_uuid(),
  model_id      uuid not null references public.product_models (id) on delete cascade,
  name          text not null,                                   -- «Yon devor», «Polka»
  length_mm     integer not null check (length_mm > 0),
  width_mm      integer not null check (width_mm > 0),
  thickness_mm  numeric(5, 1) not null default 16 check (thickness_mm > 0),
  quantity      integer not null default 1 check (quantity > 0), -- штук на одно изделие
  edge          text,                                            -- кромка: «2 uzun tomon»
  notes         text,
  sort          integer not null default 0
);

create index product_parts_model_idx on public.product_parts (model_id, sort);

-- Сохранить весь список деталей модели одной транзакцией
create or replace function public.save_model_parts(p_model_id uuid, p_parts jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_staff() then
    raise exception 'Huquq yetarli emas' using errcode = '42501';
  end if;
  if not exists (select 1 from public.product_models where id = p_model_id) then
    raise exception 'Model topilmadi';
  end if;

  delete from public.product_parts where model_id = p_model_id;

  insert into public.product_parts (model_id, name, length_mm, width_mm, thickness_mm, quantity, edge, notes, sort)
  select p_model_id,
         trim(e ->> 'name'),
         (e ->> 'length_mm')::integer,
         (e ->> 'width_mm')::integer,
         coalesce(nullif(e ->> 'thickness_mm', '')::numeric, 16),
         greatest(coalesce(nullif(e ->> 'quantity', '')::integer, 1), 1),
         nullif(trim(e ->> 'edge'), ''),
         nullif(trim(e ->> 'notes'), ''),
         ord
  from jsonb_array_elements(coalesce(p_parts, '[]'::jsonb)) with ordinality as t(e, ord)
  where coalesce(trim(e ->> 'name'), '') <> '';

  get diagnostics v_count = row_count;
  return v_count;
exception
  when check_violation or invalid_text_representation then
    raise exception 'Detal oʻlchamlari va soni musbat butun son boʻlishi kerak';
end;
$$;

revoke execute on function public.save_model_parts(uuid, jsonb) from public, anon;
grant execute on function public.save_model_parts(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.product_models enable row level security;
alter table public.product_parts  enable row level security;

create policy "product_models: чтение" on public.product_models for select to authenticated using (true);
create policy "product_models: вставка персонал" on public.product_models for insert to authenticated with check (public.is_staff());
create policy "product_models: изменение персонал" on public.product_models for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "product_models: удаление персонал" on public.product_models for delete to authenticated using (public.is_staff());

create policy "product_parts: чтение" on public.product_parts for select to authenticated using (true);
-- запись деталей — только через save_model_parts

-- ---------------------------------------------------------------------
-- Уведомления и сообщения: в названии товара теперь виден цвет
-- ---------------------------------------------------------------------
create or replace function public.notify_low_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_min  integer;
begin
  if new.quantity < old.quantity then
    select public.product_label(p), p.min_quantity into v_name, v_min
    from public.products p where p.id = new.product_id;

    if new.quantity < v_min then
      insert into public.notifications (type, message, product_id)
      values (
        'low_stock',
        format('⚠️ DIQQAT! %s tugayapti! Qoldi %s, minimum %s', v_name, new.quantity, v_min),
        new.product_id
      );
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.notify_order_ready()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if new.status = 'ready_to_ship'
     and (tg_op = 'INSERT' or old.status is distinct from 'ready_to_ship') then
    select public.product_label(p) into v_name from public.products p where p.id = new.product_id;

    insert into public.notifications (type, message, order_id, product_id)
    values (
      'order_ready',
      format(
        E'📦 Joʻnatish uchun yangi buyurtma №%s: %s × %s dona\nMijoz: %s, tel. %s\nManzil: %s',
        new.order_number, v_name, new.quantity,
        new.client_name, new.client_phone, new.client_address
      ),
      new.id,
      new.product_id
    );
  end if;
  return new;
end;
$$;

create or replace function public.create_order(
  p_source          public.order_source,
  p_product_id      uuid,
  p_quantity        integer,
  p_client_name     text,
  p_client_phone    text,
  p_client_address  text
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock   integer;
  v_min     integer;
  v_name    text;
  v_status  public.order_status;
  v_order   public.orders;
begin
  if not public.is_staff() then
    raise exception 'Buyurtma yaratish uchun huquq yetarli emas' using errcode = '42501';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Soni noldan katta boʻlishi kerak';
  end if;
  if coalesce(trim(p_client_name), '') = '' or coalesce(trim(p_client_phone), '') = ''
     or coalesce(trim(p_client_address), '') = '' then
    raise exception 'Mijozning F.I.Sh., telefoni va manzilini toʻldiring';
  end if;

  -- Блокируем остаток товара до конца транзакции
  select i.quantity, p.min_quantity, public.product_label(p)
    into v_stock, v_min, v_name
  from public.inventory_finished i
  join public.products p on p.id = i.product_id
  where i.product_id = p_product_id
  for update of i;

  if not found then
    raise exception 'Mahsulot topilmadi';
  end if;

  v_status := case when v_stock >= p_quantity then 'ready_to_ship' else 'waiting_production' end;

  insert into public.orders (source, client_name, client_phone, client_address, product_id, quantity, status, created_by)
  values (p_source, trim(p_client_name), trim(p_client_phone), trim(p_client_address), p_product_id, p_quantity, v_status, auth.uid())
  returning * into v_order;

  if v_status = 'ready_to_ship' then
    -- Списание со склада. Если остаток станет < минимума — сработает триггер notify_low_stock
    update public.inventory_finished
       set quantity = quantity - p_quantity
     where product_id = p_product_id;
  else
    insert into public.notifications (type, message, order_id, product_id)
    values (
      'order_waiting',
      format(E'⏳ №%s buyurtma ishlab chiqarishni kutmoqda: %s × %s dona. Omborda: %s',
             v_order.order_number, v_name, p_quantity, v_stock),
      v_order.id,
      p_product_id
    );
    -- Остаток не изменился, поэтому триггер не сработает — проверяем минимум вручную
    if v_stock < v_min then
      insert into public.notifications (type, message, product_id)
      values (
        'low_stock',
        format('⚠️ DIQQAT! %s tugayapti! Qoldi %s, minimum %s', v_name, v_stock, v_min),
        p_product_id
      );
    end if;
  end if;

  return v_order;
end;
$$;

create or replace function public.create_cut_batch(
  p_sheet_count    integer,
  p_items          jsonb,
  p_sketchcut_url  text default null,
  p_notes          text default null
)
returns public.cut_batches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch  public.cut_batches;
  v_total  integer;
  v_count  integer;
  v_lines  text;
begin
  if not public.is_staff() then
    raise exception 'Partiya yaratish uchun huquq yetarli emas' using errcode = '42501';
  end if;
  if p_sheet_count is null or p_sheet_count <= 0 then
    raise exception 'LDSP listlari sonini kiriting';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Kamida bitta mahsulotni tanlang';
  end if;

  insert into public.cut_batches (ldsp_sheet_count, sketchcut_file_url, notes, created_by)
  values (p_sheet_count, nullif(trim(p_sketchcut_url), ''), nullif(trim(p_notes), ''), auth.uid())
  returning * into v_batch;

  insert into public.cut_batch_items (batch_id, product_id, quantity_to_produce, notes)
  select v_batch.id,
         (e ->> 'product_id')::uuid,
         (e ->> 'quantity')::integer,
         nullif(trim(e ->> 'notes'), '')
  from jsonb_array_elements(p_items) e;

  -- Текст для Telegram
  select coalesce(sum(i.quantity_to_produce), 0),
         count(*),
         string_agg(format('• %s — %s dona', public.product_label(p), i.quantity_to_produce), E'\n' order by p.name, p.color)
    into v_total, v_count, v_lines
  from public.cut_batch_items i
  join public.products p on p.id = i.product_id
  where i.batch_id = v_batch.id;

  insert into public.notifications (type, message, batch_id)
  values (
    'batch_created',
    format(E'🪚 Yangi partiya №%s: %s list, %s xil mahsulot (%s dona)\n%s',
           v_batch.batch_number, p_sheet_count, v_count, v_total, v_lines),
    v_batch.id
  );

  return v_batch;
end;
$$;
