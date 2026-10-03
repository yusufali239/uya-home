-- =====================================================================
-- UYA HOME — интерфейс на узбекском + обрезки под контролем мастеров
--
-- 1. Те же функции, что в миграциях 2 и 4 (логика без изменений),
--    но тексты уведомлений и ошибок — на узбекском (латиница).
-- 2. Обрезки ЛДСП: добавлять/списывать может любой сотрудник (мастер тоже).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Обрезки: мастер ведёт сам
-- ---------------------------------------------------------------------
drop policy if exists "scrap_remnants: вставка персонал" on public.scrap_remnants;
drop policy if exists "scrap_remnants: изменение персонал" on public.scrap_remnants;
drop policy if exists "scrap_remnants: удаление персонал" on public.scrap_remnants;

create policy "scrap_remnants: вставка сотрудники"
  on public.scrap_remnants for insert to authenticated
  with check (public.current_user_role() is not null);
create policy "scrap_remnants: изменение сотрудники"
  on public.scrap_remnants for update to authenticated
  using (public.current_user_role() is not null)
  with check (public.current_user_role() is not null);
create policy "scrap_remnants: удаление сотрудники"
  on public.scrap_remnants for delete to authenticated
  using (public.current_user_role() is not null);

-- Единица мелочей по умолчанию — «dona»
alter table public.supplies alter column unit set default 'dona';
update public.supplies set unit = 'dona' where unit = 'шт';

-- ---------------------------------------------------------------------
-- Функции с узбекскими текстами
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
    select name into v_name from public.products where id = new.product_id;

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
  select i.quantity, p.min_quantity, p.name
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
         string_agg(format('• %s — %s dona', p.name, i.quantity_to_produce), E'\n' order by p.name)
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
    raise exception 'Tizimga kiring' using errcode = '42501';
  end if;

  update public.cut_batches
     set status = 'in_progress', started_at = now()
   where id = p_batch_id and status = 'planned'
  returning * into v_batch;

  if not found then
    raise exception 'Partiya topilmadi yoki allaqachon ishda';
  end if;
  return v_batch;
end;
$$;

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
    raise exception 'Tizimga kiring' using errcode = '42501';
  end if;

  select * into v_batch from public.cut_batches where id = p_batch_id for update;
  if not found then
    raise exception 'Partiya topilmadi';
  end if;
  if v_batch.status = 'completed' then
    raise exception '№% partiya allaqachon yakunlangan', v_batch.batch_number;
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
      raise exception '% pozitsiya bu partiyaga tegishli emas', v_item.item_id;
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
    raise exception 'Tizimga kiring' using errcode = '42501';
  end if;

  update public.orders
     set status = 'shipped', shipped_at = now()
   where id = p_order_id and status = 'ready_to_ship'
  returning * into v_order;

  if not found then
    raise exception 'Buyurtma topilmadi yoki joʻnatishga tayyor emas';
  end if;
  return v_order;
end;
$$;

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
    raise exception 'Huquq yetarli emas' using errcode = '42501';
  end if;
  if p_quantity is null or p_quantity < 0 then
    raise exception 'Qoldiq manfiy boʻlishi mumkin emas';
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

create or replace function public.create_supply(
  p_name          text,
  p_unit          text default 'dona',
  p_quantity      numeric default 0,
  p_min_quantity  numeric default 0,
  p_location      text default null
)
returns public.supplies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_supply public.supplies;
begin
  if public.current_user_role() is null then
    raise exception 'Tizimga kiring' using errcode = '42501';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Nomini kiriting';
  end if;
  if coalesce(p_quantity, 0) < 0 or coalesce(p_min_quantity, 0) < 0 then
    raise exception 'Soni manfiy boʻlishi mumkin emas';
  end if;

  insert into public.supplies (name, unit, quantity, min_quantity, location, updated_by)
  values (trim(p_name), coalesce(nullif(trim(p_unit), ''), 'dona'), coalesce(p_quantity, 0),
          coalesce(p_min_quantity, 0), nullif(trim(p_location), ''), auth.uid())
  returning * into v_supply;

  if v_supply.quantity > 0 then
    insert into public.supply_movements (supply_id, delta, quantity_after, note, created_by)
    values (v_supply.id, v_supply.quantity, v_supply.quantity, 'Boshlangʻich qoldiq', auth.uid());
  end if;
  return v_supply;
exception
  when unique_violation then
    raise exception '«%» pozitsiyasi allaqachon bor', trim(p_name);
end;
$$;

create or replace function public.adjust_supply(
  p_supply_id  uuid,
  p_delta      numeric default null,
  p_set        numeric default null,
  p_note       text default null
)
returns public.supplies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old    public.supplies;
  v_new    public.supplies;
  v_target numeric;
begin
  if public.current_user_role() is null then
    raise exception 'Tizimga kiring' using errcode = '42501';
  end if;

  select * into v_old from public.supplies where id = p_supply_id for update;
  if not found then
    raise exception 'Pozitsiya topilmadi';
  end if;

  v_target := coalesce(p_set, v_old.quantity + coalesce(p_delta, 0));
  if v_target < 0 then
    raise exception 'Bordan koʻp olib boʻlmaydi (% %)', v_old.quantity, v_old.unit;
  end if;
  if v_target = v_old.quantity then
    return v_old;
  end if;

  update public.supplies
     set quantity = v_target, updated_by = auth.uid(), updated_at = now()
   where id = p_supply_id
  returning * into v_new;

  insert into public.supply_movements (supply_id, delta, quantity_after, note, created_by)
  values (p_supply_id, v_target - v_old.quantity, v_target,
          coalesce(nullif(trim(p_note), ''), case when p_set is not null then 'Qayta sanash' end), auth.uid());

  -- Пересекли минимум сверху вниз — один сигнал, без спама
  if v_new.min_quantity > 0 and v_new.quantity < v_new.min_quantity and v_old.quantity >= v_old.min_quantity then
    insert into public.notifications (type, message)
    values ('supply_low', format('🔩 Tugayapti: %s — qoldi %s %s (minimum %s)',
            v_new.name, trim_scale(v_new.quantity), v_new.unit, trim_scale(v_new.min_quantity)));
  end if;

  return v_new;
end;
$$;

create or replace function public.update_supply(
  p_supply_id     uuid,
  p_name          text,
  p_unit          text,
  p_min_quantity  numeric,
  p_location      text
)
returns public.supplies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_supply public.supplies;
begin
  if public.current_user_role() is null then
    raise exception 'Tizimga kiring' using errcode = '42501';
  end if;
  update public.supplies
     set name = trim(p_name),
         unit = coalesce(nullif(trim(p_unit), ''), 'dona'),
         min_quantity = greatest(coalesce(p_min_quantity, 0), 0),
         location = nullif(trim(p_location), ''),
         updated_by = auth.uid(),
         updated_at = now()
   where id = p_supply_id
  returning * into v_supply;
  if not found then
    raise exception 'Pozitsiya topilmadi';
  end if;
  return v_supply;
exception
  when unique_violation then
    raise exception '«%» pozitsiyasi allaqachon bor', trim(p_name);
end;
$$;

create or replace function public.add_finance_entry(
  p_kind          public.finance_kind,
  p_amount        numeric,
  p_category      text default null,
  p_description   text default null,
  p_person_id     uuid default null,
  p_to_person_id  uuid default null,
  p_entry_date    date default null
)
returns public.finance_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role    public.user_role := public.current_user_role();
  v_staff   boolean := public.is_staff();
  v_person  uuid := coalesce(p_person_id, auth.uid());
  v_entry   public.finance_entries;
  v_name    text;
  v_to_name text;
begin
  if v_role is null then
    raise exception 'Tizimga kiring' using errcode = '42501';
  end if;
  if not v_staff and v_person <> auth.uid() then
    raise exception 'Usta faqat oʻz nomidan yozuv kirita oladi' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Summa noldan katta boʻlishi kerak';
  end if;
  if p_kind = 'transfer' and (p_to_person_id is null or p_to_person_id = v_person) then
    raise exception 'Pul kimga berilganini koʻrsating';
  end if;
  if not exists (select 1 from public.profiles where id = v_person) then
    raise exception 'Xodim topilmadi';
  end if;

  insert into public.finance_entries (
    kind, amount, category, description, person_id, to_person_id, entry_date,
    status, created_by, reviewed_by, reviewed_at
  )
  values (
    p_kind, round(p_amount, 2), nullif(trim(p_category), ''), nullif(trim(p_description), ''),
    v_person, case when p_kind = 'transfer' then p_to_person_id end,
    coalesce(p_entry_date, (now() at time zone 'Asia/Bishkek')::date),
    case when v_staff then 'approved' else 'pending' end::public.finance_status,
    auth.uid(),
    case when v_staff then auth.uid() end,
    case when v_staff then now() end
  )
  returning * into v_entry;

  -- Запись мастера — сигнал директору/менеджеру
  if not v_staff then
    select full_name into v_name from public.profiles where id = v_person;
    select full_name into v_to_name from public.profiles where id = v_entry.to_person_id;
    insert into public.notifications (type, message)
    values (
      'finance_pending',
      format(E'💰 %s: %s %s som%s%s\nTasdiq kutmoqda',
        coalesce(v_name, 'Xodim'),
        case p_kind when 'income' then 'kirim' when 'expense' then 'chiqim' else 'topshirdi' end,
        trim_scale(v_entry.amount),
        case when v_to_name is not null then ' → ' || v_to_name else '' end,
        case when v_entry.category is not null or v_entry.description is not null
             then E'\n' || concat_ws(' — ', v_entry.category, v_entry.description) else '' end
      )
    );
  end if;

  return v_entry;
end;
$$;

create or replace function public.review_finance_entry(p_entry_id uuid, p_approve boolean)
returns public.finance_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry public.finance_entries;
begin
  if not public.is_staff() then
    raise exception 'Faqat direktor yoki menejer tasdiqlay oladi' using errcode = '42501';
  end if;

  update public.finance_entries
     set status = case when p_approve then 'approved' else 'rejected' end::public.finance_status,
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_entry_id and status = 'pending'
  returning * into v_entry;

  if not found then
    raise exception 'Yozuv topilmadi yoki allaqachon koʻrib chiqilgan';
  end if;
  return v_entry;
end;
$$;
