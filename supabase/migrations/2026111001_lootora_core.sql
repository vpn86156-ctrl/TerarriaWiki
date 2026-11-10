-- ===== LOOTORA · ядро: профили, прогресс, мощь на стороне сервера =====

-- Бонусы питомцев хранятся на сервере: клиент не может их подменить.
create table if not exists public.pets (
  id    text primary key,
  atk   numeric not null default 0,
  crit  numeric not null default 0,
  gold  numeric not null default 0,
  xp    numeric not null default 0,
  luck  numeric not null default 0,
  speed numeric not null default 0
);
insert into public.pets(id, gold) values ('firewolf', 0.12)   on conflict (id) do nothing;
insert into public.pets(id, xp)   values ('icespirit', 0.15)  on conflict (id) do nothing;
insert into public.pets(id, crit) values ('raven', 0.04)      on conflict (id) do nothing;
insert into public.pets(id, atk)  values ('dragon', 0.10)     on conflict (id) do nothing;
insert into public.pets(id, luck, gold) values ('astral', 0.35, 0.10) on conflict (id) do nothing;

create or replace function public.lootora_upg(state jsonb, key text)
returns int language sql immutable as $$
  select coalesce((state -> 'upg' ->> key)::int, 0);
$$;

-- характеристики вещи лежат во вложенном объекте stats
create or replace function public.lootora_equip(state jsonb, stat_key text)
returns numeric language sql immutable as $$
  select coalesce((
    select sum(coalesce((it.value -> 'stats' ->> stat_key)::numeric, 0))
    from jsonb_each(coalesce(state -> 'equip', '{}'::jsonb)) e
    join lateral (
      select arr.value
      from jsonb_array_elements(coalesce(state -> 'inv', '[]'::jsonb)) arr
      where arr.value ->> 'uid' = e.value #>> '{}'
    ) it on true
  ), 0);
$$;

create or replace function public.lootora_pet(state jsonb, stat_key text)
returns numeric language sql stable as $$
  select coalesce((
    select (case stat_key
             when 'atk'   then p.atk
             when 'crit'  then p.crit
             when 'gold'  then p.gold
             when 'xp'    then p.xp
             when 'luck'  then p.luck
             when 'speed' then p.speed
             else 0 end) * (1 + (coalesce((pe.value ->> 'level')::int, 1) - 1) * 0.42)
    from jsonb_array_elements(coalesce(state -> 'pets', '[]'::jsonb)) pe
    join public.pets p on p.id = pe.value ->> 'id'
    where pe.value ->> 'id' = state ->> 'activePet'
    limit 1
  ), 0);
$$;

create or replace function public.lootora_power(state jsonb)
returns numeric language sql immutable as $$
  select round((
    (8 + public.lootora_equip(state, 'atk'))
    * power(1.16::numeric, public.lootora_upg(state, 'weapon'))
    * power(1.11::numeric, public.lootora_upg(state, 'attack'))
    * (1 + public.lootora_pet(state, 'atk'))
  )::numeric, 1);
$$;

create or replace function public.lootora_crit(state jsonb)
returns numeric language sql immutable as $$
  select least(0.92, 0.05 + public.lootora_upg(state, 'crit') * 0.008
                     + public.lootora_equip(state, 'crit') / 100
                     + public.lootora_pet(state, 'crit'));
$$;

create or replace function public.lootora_critdmg(state jsonb)
returns numeric language sql immutable as $$
  select 1.5 + public.lootora_upg(state, 'critdmg') * 0.08
             + public.lootora_equip(state, 'critdmg') / 100;
$$;

create or replace function public.lootora_defense(state jsonb)
returns numeric language sql immutable as $$
  select public.lootora_upg(state, 'defense') * 6 + public.lootora_equip(state, 'hp') * 0.5;
$$;

create or replace function public.lootora_dr(state jsonb)
returns numeric language sql immutable as $$
  select d.defense / (d.defense + 160) from (select public.lootora_defense(state) as defense) d;
$$;

create or replace function public.lootora_hpmax(state jsonb)
returns numeric language sql immutable as $$
  select 100 + public.lootora_upg(state, 'defense') * 6;
$$;

-- запас здоровья для PvP: бой не должен решаться одним ударом
create or replace function public.lootora_pvphp(state jsonb)
returns numeric language sql immutable as $$
  select round(public.lootora_hpmax(state) * 3 + public.lootora_power(state) * 5, 1);
$$;

create or replace function public.lootora_spent(state jsonb)
returns numeric language sql immutable as $$
  select coalesce(sum(
    case when lvl <= 0 then 0
         else round(base_v * (power(mul_v, lvl) - 1) / (mul_v - 1))
    end), 0)
  from (
    select (rec ->> 'base')::numeric as base_v,
           (rec ->> 'mul')::numeric  as mul_v,
           public.lootora_upg(state, key) as lvl
    from jsonb_each('{
      "weapon":  {"base": 60,  "mul": 1.52},
      "attack":  {"base": 95,  "mul": 1.55},
      "crit":    {"base": 310, "mul": 1.62},
      "critdmg": {"base": 240, "mul": 1.64},
      "speed":   {"base": 280, "mul": 1.60},
      "auto":    {"base": 520, "mul": 1.85},
      "defense": {"base": 190, "mul": 1.55},
      "gold":    {"base": 210, "mul": 1.58},
      "xp":      {"base": 230, "mul": 1.58}
    }'::jsonb) u(key, rec)
  ) s;
$$;

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  nick         text not null unique check (char_length(nick) between 3 and 16),
  created_at   timestamptz not null default now(),
  last_seen    timestamptz not null default now(),
  muted_until  timestamptz
);

create table if not exists public.progress (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  state      jsonb not null,
  level      int not null default 1,
  kills      int not null default 0,
  power      numeric not null default 0,
  spent      numeric not null default 0,
  earned     numeric not null default 0,
  fair       boolean not null default true,
  updated_at timestamptz not null default now()
);

create or replace function public.progress_sync() returns trigger language plpgsql as $$
begin
  new.level  := coalesce((new.state ->> 'level')::int, 1);
  new.kills  := coalesce((new.state ->> 'kills')::int, 0);
  new.power  := public.lootora_power(new.state);
  new.spent  := public.lootora_spent(new.state);
  new.earned := coalesce((new.state ->> 'stats_goldEarned')::numeric, 0);
  new.fair   := new.spent <= new.earned + 2000;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists progress_sync_trg on public.progress;
create trigger progress_sync_trg before insert or update on public.progress
  for each row execute function public.progress_sync();

create table if not exists public.ratings (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  rating     int not null default 1000,
  wins       int not null default 0,
  losses     int not null default 0,
  streak     int not null default 0,
  updated_at timestamptz not null default now()
);

create or replace view public.leaderboard as
  select p.nick,
         r.user_id,
         r.rating,
         r.wins,
         r.losses,
         r.streak,
         g.level,
         g.kills,
         g.power,
         g.fair,
         g.updated_at
  from public.ratings r
  join public.profiles p on p.id = r.user_id
  join public.progress g on g.user_id = r.user_id;
