-- В PvP бой не должен решаться одним ударом: запас здоровья
-- масштабируется вместе с мощью, но вклад защиты сохранён.
create or replace function public.lootora_pvphp(state jsonb)
returns numeric language sql immutable as $$
  select round(public.lootora_hpmax(state) * 3 + public.lootora_power(state) * 5, 1);
$$;
