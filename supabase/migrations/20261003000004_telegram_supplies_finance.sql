-- =====================================================================
-- UYA HOME — Telegram Mini App, мелочи склада, бухгалтерия
-- =====================================================================

-- ---------------------------------------------------------------------
-- Новые типы уведомлений
-- ---------------------------------------------------------------------
alter type public.notification_type add value if not exists 'supply_low';       -- мелочь заканчивается
alter type public.notification_type add value if not exists 'finance_pending';  -- мастер внёс расход/приход

-- ---------------------------------------------------------------------
-- Привязка сотрудника к Telegram (вход в Mini App без пароля)
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists telegram_id bigint unique;

-- Мастеру нужны имена коллег (кому сдал деньги, кто внёс запись)
drop policy if exists "profiles: свой профиль или персонал" on public.profiles;
create policy "profiles: чтение для сотрудников"
  on public.profiles for select to authenticated
  using (true);

-- =====================================================================
-- МЕЛОЧИ СКЛАДА (евровинты, шканты, кромка, клей…)
-- Ведёт мастер: сам добавляет позиции и меняет остатки.
-- =====================================================================
create table public.supplies (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,                 -- «Евровинт 7×50»
  unit          text not null default 'шт',           -- шт, кг, м, уп
  quantity      numeric(12, 2) not null default 0 check (quantity >= 0),
  min_quantity  numeric(12, 2) not null default 0 check (min_quantity >= 0),
  location      text,
  updated_by    uuid references auth.users (id) on delete set null,
  updated_at    timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

-- Журнал движения: кто, когда, сколько
create table public.supply_movements (
  id              uuid primary key default gen_random_uuid(),
  supply_id       uuid not null references public.supplies (id) on delete cascade,
  delta           numeric(12, 2) not null,
  quantity_after  numeric(12, 2) not null,
  note            text,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now()
);

create index supply_movements_supply_idx on public.supply_movements (supply_id, created_at desc);

alter table public.supplies         enable row level security;
alter table public.supply_movements enable row level security;

create policy "supplies: чтение"   on public.supplies for select to authenticated using (true);
create policy "supplies: удаление персонал" on public.supplies for delete to authenticated using (public.is_staff());
create policy "supply_movements: чтение" on public.supply_movements for select to authenticated using (true);
-- Создание и изменение — через функции ниже (их может вызывать и мастер)

-- ---------------------------------------------------------------------
-- Новая позиция мелочей (любой сотрудник)
-- ---------------------------------------------------------------------
create or replace function public.create_supply(
  p_name          text,
  p_unit          text default 'шт',
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
    raise exception 'Нужно войти в систему' using errcode = '42501';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Укажите название';
  end if;
  if coalesce(p_quantity, 0) < 0 or coalesce(p_min_quantity, 0) < 0 then
    raise exception 'Количество не может быть отрицательным';
  end if;

  insert into public.supplies (name, unit, quantity, min_quantity, location, updated_by)
  values (trim(p_name), coalesce(nullif(trim(p_unit), ''), 'шт'), coalesce(p_quantity, 0),
          coalesce(p_min_quantity, 0), nullif(trim(p_location), ''), auth.uid())
  returning * into v_supply;

  if v_supply.quantity > 0 then
    insert into public.supply_movements (supply_id, delta, quantity_after, note, created_by)
    values (v_supply.id, v_supply.quantity, v_supply.quantity, 'Начальный остаток', auth.uid());
  end if;
  return v_supply;
exception
  when unique_violation then
    raise exception 'Позиция «%» уже есть', trim(p_name);
end;
$$;

-- ---------------------------------------------------------------------
-- Изменение остатка мелочей.
-- p_delta — приход (+) или расход (−); p_set — точный пересчёт (инвентаризация).
-- Остаток упал ниже минимума → уведомление.
-- ---------------------------------------------------------------------
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
    raise exception 'Нужно войти в систему' using errcode = '42501';
  end if;

  select * into v_old from public.supplies where id = p_supply_id for update;
  if not found then
    raise exception 'Позиция не найдена';
  end if;

  v_target := coalesce(p_set, v_old.quantity + coalesce(p_delta, 0));
  if v_target < 0 then
    raise exception 'Нельзя списать больше, чем есть (% %)', v_old.quantity, v_old.unit;
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
          coalesce(nullif(trim(p_note), ''), case when p_set is not null then 'Пересчёт' end), auth.uid());

  -- Пересекли минимум сверху вниз — один сигнал, без спама
  if v_new.min_quantity > 0 and v_new.quantity < v_new.min_quantity and v_old.quantity >= v_old.min_quantity then
    insert into public.notifications (type, message)
    values ('supply_low', format('🔩 Заканчивается: %s — осталось %s %s (минимум %s)',
            v_new.name, trim_scale(v_new.quantity), v_new.unit, trim_scale(v_new.min_quantity)));
  end if;

  return v_new;
end;
$$;

-- ---------------------------------------------------------------------
-- Редактирование карточки мелочи (название, ед., минимум, место)
-- ---------------------------------------------------------------------
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
    raise exception 'Нужно войти в систему' using errcode = '42501';
  end if;
  update public.supplies
     set name = trim(p_name),
         unit = coalesce(nullif(trim(p_unit), ''), 'шт'),
         min_quantity = greatest(coalesce(p_min_quantity, 0), 0),
         location = nullif(trim(p_location), ''),
         updated_by = auth.uid(),
         updated_at = now()
   where id = p_supply_id
  returning * into v_supply;
  if not found then
    raise exception 'Позиция не найдена';
  end if;
  return v_supply;
exception
  when unique_violation then
    raise exception 'Позиция «%» уже есть', trim(p_name);
end;
$$;

-- =====================================================================
-- БУХГАЛТЕРИЯ
-- Приход   — сотрудник получил деньги (оплата клиента и т.п.)
-- Расход   — сотрудник потратил деньги (купил для мастерской и т.п.)
-- Передача — один сотрудник отдал деньги другому (сдал в кассу)
--
-- «На руках» у сотрудника = его приходы − его расходы + получил − отдал.
-- Деньги компании = сумма «на руках» у всех = приходы − расходы.
-- Записи мастера ждут подтверждения директора/менеджера.
-- =====================================================================
create type public.finance_kind as enum ('income', 'expense', 'transfer');
create type public.finance_status as enum ('pending', 'approved', 'rejected');

create table public.finance_entries (
  id            uuid primary key default gen_random_uuid(),
  kind          public.finance_kind not null,
  amount        numeric(12, 2) not null check (amount > 0),
  category      text,
  description   text,
  person_id     uuid not null references public.profiles (id) on delete restrict,  -- чьи деньги
  to_person_id  uuid references public.profiles (id) on delete restrict,           -- кому (для передачи)
  entry_date    date not null default (now() at time zone 'Asia/Bishkek')::date,
  status        public.finance_status not null default 'pending',
  created_by    uuid references auth.users (id) on delete set null,
  reviewed_by   uuid references auth.users (id) on delete set null,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now(),
  constraint finance_transfer_target check (
    (kind = 'transfer' and to_person_id is not null and to_person_id <> person_id)
    or (kind <> 'transfer' and to_person_id is null)
  )
);

create index finance_entries_person_idx on public.finance_entries (person_id, entry_date desc);
create index finance_entries_status_idx on public.finance_entries (status, created_at desc);

alter table public.finance_entries enable row level security;

-- Персонал видит всё, мастер — только записи со своим участием
create policy "finance: чтение"
  on public.finance_entries for select to authenticated
  using (public.is_staff() or person_id = auth.uid() or to_person_id = auth.uid() or created_by = auth.uid());

create policy "finance: удаление персонал"
  on public.finance_entries for delete to authenticated
  using (public.is_staff());

-- ---------------------------------------------------------------------
-- Новая запись. Персонал — за любого сотрудника, сразу подтверждена.
-- Мастер — только от себя, ждёт подтверждения.
-- ---------------------------------------------------------------------
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
    raise exception 'Нужно войти в систему' using errcode = '42501';
  end if;
  if not v_staff and v_person <> auth.uid() then
    raise exception 'Мастер может вносить записи только от себя' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Сумма должна быть больше нуля';
  end if;
  if p_kind = 'transfer' and (p_to_person_id is null or p_to_person_id = v_person) then
    raise exception 'Укажите, кому переданы деньги';
  end if;
  if not exists (select 1 from public.profiles where id = v_person) then
    raise exception 'Сотрудник не найден';
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
      format(E'💰 %s: %s %s сом%s%s\nЖдёт подтверждения',
        coalesce(v_name, 'Сотрудник'),
        case p_kind when 'income' then 'приход' when 'expense' then 'расход' else 'передал' end,
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

-- ---------------------------------------------------------------------
-- Подтвердить / отклонить запись (директор, менеджер)
-- ---------------------------------------------------------------------
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
    raise exception 'Подтверждать может директор или менеджер' using errcode = '42501';
  end if;

  update public.finance_entries
     set status = case when p_approve then 'approved' else 'rejected' end::public.finance_status,
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_entry_id and status = 'pending'
  returning * into v_entry;

  if not found then
    raise exception 'Запись не найдена или уже рассмотрена';
  end if;
  return v_entry;
end;
$$;

-- ---------------------------------------------------------------------
-- Права
-- ---------------------------------------------------------------------
revoke execute on function public.create_supply(text, text, numeric, numeric, text) from public, anon;
revoke execute on function public.adjust_supply(uuid, numeric, numeric, text) from public, anon;
revoke execute on function public.update_supply(uuid, text, text, numeric, text) from public, anon;
revoke execute on function public.add_finance_entry(public.finance_kind, numeric, text, text, uuid, uuid, date) from public, anon;
revoke execute on function public.review_finance_entry(uuid, boolean) from public, anon;

grant execute on function public.create_supply(text, text, numeric, numeric, text) to authenticated;
grant execute on function public.adjust_supply(uuid, numeric, numeric, text) to authenticated;
grant execute on function public.update_supply(uuid, text, text, numeric, text) to authenticated;
grant execute on function public.add_finance_entry(public.finance_kind, numeric, text, text, uuid, uuid, date) to authenticated;
grant execute on function public.review_finance_entry(uuid, boolean) to authenticated;
