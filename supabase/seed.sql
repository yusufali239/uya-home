-- Тестовые данные (необязательно). Выполнить в SQL Editor после миграций.
insert into public.products (name, sku, color, dimensions, price, cost_price, min_quantity)
values
  ('Стол-5',   'ST-005', 'Дуб сонома', '1200×600×750',  6500, 3900, 5),
  ('Полка-2',  'PL-002', 'Белый',      '800×250×200',   1800,  900, 3),
  ('Тумба-1',  'TB-001', 'Венге',      '400×400×600',   3200, 1700, 4),
  ('Шкаф-3',   'SH-003', 'Белый',      '900×450×2000', 14500, 8200, 2)
on conflict (sku) do nothing;

-- Начальные остатки
update public.inventory_finished i set quantity = v.qty, location = v.loc
from (values ('ST-005', 7, 'Стеллаж А1'), ('PL-002', 2, 'Стеллаж А2'),
             ('TB-001', 6, 'Стеллаж Б1'), ('SH-003', 1, 'Зона В')) as v(sku, qty, loc)
join public.products p on p.sku = v.sku
where i.product_id = p.id;
