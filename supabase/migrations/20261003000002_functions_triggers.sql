-- =====================================================================
-- UYA HOME — функции, триггеры и RPC бизнес-логики
-- Вся работа со складом идёт через транзакционные функции, чтобы
-- два одновременных заказа не «продали» один и тот же стол.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Вспомогательные функции ролей
-- ---------------------------------------------------------------------
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Директор или менеджер
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('director', 'manager'), false);
$$;

-- Русское склонение: plural_ru(2, 'лист', 'листа', 'листов') → 'листа'
create or replace function public.plural_ru(n integer, one text, few text, many text)
returns text
language sql
immutable
as $$
  select case
    when n % 100 between 11 and 14 then many
    when n % 10 = 1 then one
    when n % 10 between 2 and 4 then few
    else many
  end;
$$;

-- ---------------------------------------------------------------------
-- Профиль создаётся автоматически при регистрации пользователя.
-- Самый первый пользователь становится директором, остальные — мастерами
-- (директор потом меняет роль в /admin/users).
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    case when exists (select 1 from public.profiles) then 'master' else 'director' end::public.user_role
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger inventory_touch before update on public.inventory_finished
  for each row execute function public.touch_updated_at();

create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Новый товар → сразу строка на складе с нулевым остатком
-- ---------------------------------------------------------------------
create or replace function public.create_inventory_for_product()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.inventory_finished (product_id, quantity)
  values (new.id, 0)
  on conflict (product_id) do nothing;
  return new;
end;
$$;

create trigger products_create_inventory
  after insert on public.products
  for each row execute function public.create_inventory_for_product();

-- ---------------------------------------------------------------------
-- ТРИГГЕР: остаток уменьшился и стал ниже минимума → уведомление
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
    select name, min_quantity into v_name, v_min
    from public.products where id = new.product_id;

    if new.quantity < v_min then
      insert into public.notifications (type, message, product_id)
      values (
        'low_stock',
        format('⚠️ ВНИМАНИЕ! %s заканчивается! Осталось %s, минимум %s', v_name, new.quantity, v_min),
        new.product_id
      );
    end if;
  end if;
  return new;
end;
$$;

create trigger inventory_low_stock
  after update of quantity on public.inventory_finished
  for each row execute function public.notify_low_stock();

-- ---------------------------------------------------------------------
-- ТРИГГЕР: заказ перешёл в ready_to_ship → уведомление мастеру
-- ---------------------------------------------------------------------
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
    select name into v_name from public.products where id = new.product_id;

    insert into public.notifications (type, message, order_id, product_id)
    values (
      'order_ready',
      format(
        E'📦 Новый заказ на отправку №%s: %s × %s шт.\nКлиент: %s, тел. %s\nАдрес: %s',
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

create trigger orders_notify_ready
  after insert or update of status on public.orders
  for each row execute function public.notify_order_ready();

-- =====================================================================
-- RPC
-- =====================================================================

-- ---------------------------------------------------------------------
-- Создание заказа.
-- Если на складе хватает — резервируем (списываем) и статус ready_to_ship,
-- иначе — waiting_production. Строка склада блокируется FOR UPDATE.
-- ---------------------------------------------------------------------
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
    raise exception 'Недостаточно прав для создания заказа' using errcode = '42501';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Количество должно быть больше нуля';
  end if;
  if coalesce(trim(p_client_name), '') = '' or coalesce(trim(p_client_phone), '') = ''
     or coalesce(trim(p_client_address), '') = '' then
    raise exception 'Заполните ФИО, телефон и адрес клиента';
  end if;

  -- Блокируем остаток товара до конца транзакции
  select i.quantity, p.min_quantity, p.name
    into v_stock, v_min, v_name
  from public.inventory_finished i
  join public.products p on p.id = i.product_id
  where i.product_id = p_product_id
  for update of i;

  if not found then
    raise exception 'Товар не найден';
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
      format(E'⏳ Заказ №%s ждёт производства: %s × %s шт. На складе: %s',
             v_order.order_number, v_name, p_quantity, v_stock),
      v_order.id,
      p_product_id
    );
    -- Остаток не изменился, поэтому триггер не сработает — проверяем минимум вручную
    if v_stock < v_min then
      insert into public.notifications (type, message, product_id)
      values (
        'low_stock',
        format('⚠️ ВНИМАНИЕ! %s заканчивается! Осталось %s, минимум %s', v_name, v_stock, v_min),
        p_product_id
      );
    end if;
  end if;

  return v_order;
end;
$$;

-- ---------------------------------------------------------------------
-- Создание партии раскроя.
-- p_items: [{"product_id": "...", "quantity": 3, "notes": "..."}, ...]
-- ---------------------------------------------------------------------
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
    raise exception 'Недостаточно прав для создания партии' using errcode = '42501';
  end if;
  if p_sheet_count is null or p_sheet_count <= 0 then
    raise exception 'Укажите количество листов ЛДСП';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Выберите хотя бы один товар';
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
         string_agg(format('• %s — %s шт.', p.name, i.quantity_to_produce), E'\n' order by p.name)
    into v_total, v_count, v_lines
  from public.cut_batch_items i
  join public.products p on p.id = i.product_id
  where i.batch_id = v_batch.id;

  insert into public.notifications (type, message, batch_id)
  values (
    'batch_created',
    format(E'🪚 Новая Партия №%s: %s %s, %s %s (%s шт.)\n%s',
           v_batch.batch_number,
           p_sheet_count, public.plural_ru(p_sheet_count, 'лист', 'листа', 'листов'),
           v_count, public.plural_ru(v_count, 'товар', 'товара', 'товаров'),
           v_total, v_lines),
    v_batch.id
  );

  return v_batch;
end;
$$;

-- ---------------------------------------------------------------------
-- Мастер: «Детали принял» — партия в работе
-- ---------------------------------------------------------------------
create or replace function public.start_cut_batch(p_batch_id uuid)
returns public.cut_batches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.cut_batches;
begin
  if public.current_user_role() is null then
    raise exception 'Нужно войти в систему' using errcode = '42501';
  end if;

  update public.cut_batches
     set status = 'in_progress', started_at = now()
   where id = p_batch_id and status = 'planned'
  returning * into v_batch;

  if not found then
    raise exception 'Партия не найдена или уже в работе';
  end if;
  return v_batch;
end;
$$;

-- ---------------------------------------------------------------------
-- Мастер: «Готов».
-- p_items:    [{"item_id": "...", "quantity_produced": 3}, ...]
-- p_remnants: [{"size": "800x600", "color": "Белый", "quantity": 1}, ...]
-- Склад пополняется, партия закрывается, ждущие заказы (FIFO)
-- автоматически резервируются и переходят в ready_to_ship.
-- ---------------------------------------------------------------------
create or replace function public.complete_cut_batch(
  p_batch_id  uuid,
  p_items     jsonb,
  p_remnants  jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch      public.cut_batches;
  v_item       record;
  v_order      record;
  v_product    uuid;
  v_stock      integer;
  v_produced   integer := 0;
  v_fulfilled  integer := 0;
begin
  if public.current_user_role() is null then
    raise exception 'Нужно войти в систему' using errcode = '42501';
  end if;

  select * into v_batch from public.cut_batches where id = p_batch_id for update;
  if not found then
    raise exception 'Партия не найдена';
  end if;
  if v_batch.status = 'completed' then
    raise exception 'Партия №% уже завершена', v_batch.batch_number;
  end if;

  -- 1. Фактический выпуск по каждой позиции → на склад
  for v_item in
    select (e ->> 'item_id')::uuid as item_id,
           greatest(coalesce((e ->> 'quantity_produced')::integer, 0), 0) as qty
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) e
  loop
    update public.cut_batch_items
       set quantity_produced = v_item.qty
     where id = v_item.item_id and batch_id = p_batch_id
    returning product_id into v_product;

    if not found then
      raise exception 'Позиция % не относится к этой партии', v_item.item_id;
    end if;

    if v_item.qty > 0 then
      insert into public.inventory_finished (product_id, quantity)
      values (v_product, v_item.qty)
      on conflict (product_id) do update
        set quantity = public.inventory_finished.quantity + excluded.quantity;
      v_produced := v_produced + v_item.qty;
    end if;
  end loop;

  -- Позиции, по которым мастер ничего не указал, считаем невыпущенными
  update public.cut_batch_items
     set quantity_produced = 0
   where batch_id = p_batch_id and quantity_produced is null;

  -- 2. Обрезки
  insert into public.scrap_remnants (size, color, quantity, batch_id)
  select trim(e ->> 'size'),
         nullif(trim(e ->> 'color'), ''),
         greatest(coalesce((e ->> 'quantity')::integer, 1), 1),
         p_batch_id
  from jsonb_array_elements(coalesce(p_remnants, '[]'::jsonb)) e
  where coalesce(trim(e ->> 'size'), '') <> '';

  -- 3. Закрываем партию
  update public.cut_batches
     set status = 'completed',
         completed_at = now(),
         started_at = coalesce(started_at, now())
   where id = p_batch_id;

  -- 4. Раздаём готовое ждущим заказам (сначала самые старые)
  for v_order in
    select o.id, o.product_id, o.quantity
    from public.orders o
    where o.status = 'waiting_production'
      and o.product_id in (select product_id from public.cut_batch_items where batch_id = p_batch_id)
    order by o.created_at
    for update
  loop
    select quantity into v_stock
    from public.inventory_finished
    where product_id = v_order.product_id
    for update;

    if v_stock >= v_order.quantity then
      update public.orders set status = 'ready_to_ship' where id = v_order.id;
      update public.inventory_finished
         set quantity = quantity - v_order.quantity
       where product_id = v_order.product_id;
      v_fulfilled := v_fulfilled + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'batch_number', v_batch.batch_number,
    'produced', v_produced,
    'fulfilled_orders', v_fulfilled
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Мастер: заказ отгружен
-- ---------------------------------------------------------------------
create or replace function public.ship_order(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  if public.current_user_role() is null then
    raise exception 'Нужно войти в систему' using errcode = '42501';
  end if;

  update public.orders
     set status = 'shipped', shipped_at = now()
   where id = p_order_id and status = 'ready_to_ship'
  returning * into v_order;

  if not found then
    raise exception 'Заказ не найден или не готов к отгрузке';
  end if;
  return v_order;
end;
$$;

-- ---------------------------------------------------------------------
-- Ручная корректировка остатка (инвентаризация) — директор/менеджер.
-- Если после корректировки остаток вырос — пробуем закрыть ждущие заказы.
-- ---------------------------------------------------------------------
create or replace function public.set_inventory(
  p_product_id  uuid,
  p_quantity    integer,
  p_location    text default null
)
returns public.inventory_finished
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv    public.inventory_finished;
  v_order  record;
begin
  if not public.is_staff() then
    raise exception 'Недостаточно прав' using errcode = '42501';
  end if;
  if p_quantity is null or p_quantity < 0 then
    raise exception 'Остаток не может быть отрицательным';
  end if;

  insert into public.inventory_finished (product_id, quantity, location)
  values (p_product_id, p_quantity, nullif(trim(p_location), ''))
  on conflict (product_id) do update
    set quantity = excluded.quantity,
        location = excluded.location
  returning * into v_inv;

  for v_order in
    select o.id, o.quantity
    from public.orders o
    where o.status = 'waiting_production' and o.product_id = p_product_id
    order by o.created_at
    for update
  loop
    select * into v_inv from public.inventory_finished where product_id = p_product_id for update;
    exit when v_inv.quantity < v_order.quantity;
    update public.orders set status = 'ready_to_ship' where id = v_order.id;
    update public.inventory_finished
       set quantity = quantity - v_order.quantity
     where product_id = p_product_id
    returning * into v_inv;
  end loop;

  return v_inv;
end;
$$;

-- ---------------------------------------------------------------------
-- Очередь уведомлений: атомарно «забрать» пачку неотправленных.
-- Вызывается ТОЛЬКО сервером (service_role). SKIP LOCKED исключает
-- двойную отправку при параллельных вызовах.
-- ---------------------------------------------------------------------
create or replace function public.claim_notifications(p_limit integer default 20)
returns setof public.notifications
language sql
security definer
set search_path = public
as $$
  update public.notifications n
     set sent_at = now(),
         attempts = n.attempts + 1
   where n.id in (
     select id from public.notifications
     where sent_at is null and attempts < 5
     order by created_at
     limit p_limit
     for update skip locked
   )
  returning n.*;
$$;

-- ---------------------------------------------------------------------
-- Права на выполнение функций
-- ---------------------------------------------------------------------
revoke execute on function public.create_order(public.order_source, uuid, integer, text, text, text) from public, anon;
revoke execute on function public.create_cut_batch(integer, jsonb, text, text) from public, anon;
revoke execute on function public.start_cut_batch(uuid) from public, anon;
revoke execute on function public.complete_cut_batch(uuid, jsonb, jsonb) from public, anon;
revoke execute on function public.ship_order(uuid) from public, anon;
revoke execute on function public.set_inventory(uuid, integer, text) from public, anon;
revoke execute on function public.claim_notifications(integer) from public, anon, authenticated;

grant execute on function public.create_order(public.order_source, uuid, integer, text, text, text) to authenticated;
grant execute on function public.create_cut_batch(integer, jsonb, text, text) to authenticated;
grant execute on function public.start_cut_batch(uuid) to authenticated;
grant execute on function public.complete_cut_batch(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.ship_order(uuid) to authenticated;
grant execute on function public.set_inventory(uuid, integer, text) to authenticated;
grant execute on function public.claim_notifications(integer) to service_role;
