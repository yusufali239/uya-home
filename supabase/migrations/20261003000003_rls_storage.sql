-- =====================================================================
-- UYA HOME — Row Level Security, Storage, Realtime
-- Чтение — любой вошедший сотрудник. Запись — директор/менеджер.
-- Действия мастера (принять/завершить партию, отгрузить заказ) идут
-- через SECURITY DEFINER функции из предыдущей миграции.
-- =====================================================================

alter table public.profiles           enable row level security;
alter table public.products           enable row level security;
alter table public.inventory_finished enable row level security;
alter table public.orders             enable row level security;
alter table public.cut_batches        enable row level security;
alter table public.cut_batch_items    enable row level security;
alter table public.scrap_remnants     enable row level security;
alter table public.notifications      enable row level security;

-- ---------- profiles ----------
create policy "profiles: свой профиль или персонал"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());

create policy "profiles: роли меняет директор"
  on public.profiles for update to authenticated
  using (public.current_user_role() = 'director')
  with check (public.current_user_role() = 'director');

-- ---------- справочники и операционные таблицы ----------
do $$
declare
  t text;
begin
  foreach t in array array[
    'products', 'inventory_finished', 'orders',
    'cut_batches', 'cut_batch_items', 'scrap_remnants'
  ]
  loop
    execute format(
      'create policy "%1$s: чтение для сотрудников" on public.%1$I for select to authenticated using (true)', t);
    execute format(
      'create policy "%1$s: вставка персонал" on public.%1$I for insert to authenticated with check (public.is_staff())', t);
    execute format(
      'create policy "%1$s: изменение персонал" on public.%1$I for update to authenticated using (public.is_staff()) with check (public.is_staff())', t);
    execute format(
      'create policy "%1$s: удаление персонал" on public.%1$I for delete to authenticated using (public.is_staff())', t);
  end loop;
end;
$$;

-- ---------- notifications: читает персонал, пишут только триггеры/сервер ----------
create policy "notifications: чтение персонал"
  on public.notifications for select to authenticated
  using (public.is_staff());

-- =====================================================================
-- Storage: публичные бакеты (фото нужны на бейджике, PDF — мастеру)
-- =====================================================================
insert into storage.buckets (id, name, public)
values
  ('products', 'products', true),  -- фото, инструкции, раскрой товара
  ('batches',  'batches',  true)   -- PDF раскроя партий
on conflict (id) do nothing;

create policy "storage: загрузка персонал"
  on storage.objects for insert to authenticated
  with check (bucket_id in ('products', 'batches') and public.is_staff());

create policy "storage: изменение персонал"
  on storage.objects for update to authenticated
  using (bucket_id in ('products', 'batches') and public.is_staff());

create policy "storage: удаление персонал"
  on storage.objects for delete to authenticated
  using (bucket_id in ('products', 'batches') and public.is_staff());

-- =====================================================================
-- Realtime: экран мастера обновляется сам при новых задачах
-- =====================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.orders, public.cut_batches;
  end if;
end;
$$;
