-- ===== LOOTORA · политики доступа и PvP =====

-- ---- RLS ядра ----
alter table public.pets     enable row level security;
alter table public.profiles enable row level security;
alter table public.progress enable row level security;
alter table public.ratings  enable row level security;

create policy "справочник питомцев доступен всем" on public.pets for select using (true);
create policy "профили видны всем" on public.profiles for select using (true);
create policy "свой профиль: создание" on public.profiles for insert with check (auth.uid() = id);
create policy "свой профиль: правка"  on public.profiles for update using (auth.uid() = id);
create policy "свой прогресс" on public.progress for select using (auth.uid() = user_id);
create policy "свой прогресс: запись" on public.progress for insert with check (auth.uid() = user_id);
create policy "свой прогресс: правка" on public.progress for update using (auth.uid() = user_id);
create policy "рейтинг видны всем" on public.ratings for select using (true);

grant select on public.leaderboard to anon, authenticated;

-- ---- PvP ----
create table if not exists public.pvp_queue (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  nick       text not null,
  created_at timestamptz not null default now()
);
alter table public.pvp_queue enable row level security;
create policy "очередь видна" on public.pvp_queue for select using (true);

create table if not exists public.duels (
  id         bigserial primary key,
  a          uuid not null references public.profiles(id) on delete cascade,
  b          uuid not null references public.profiles(id) on delete cascade,
  winner     uuid references public.profiles(id) on delete cascade,
  a_power    numeric not null default 0,
  b_power    numeric not null default 0,
  delta      int not null default 0,
  log        jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.duels enable row level security;
create policy "свои дуэли" on public.duels for select using (auth.uid() in (a, b));

-- Поиск соперника. Если никто не подошёл — встаём в очередь.
-- Бой считает сервер: клиент присылает только сам факт вызова.
create or replace function public.pvp_match()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  opp uuid;
  st_a jsonb; st_b jsonb;
  p_a numeric; p_b numeric; c_a numeric; c_b numeric;
  cd_a numeric; cd_b numeric; dr_a numeric; dr_b numeric;
  hp_a numeric; hp_b numeric; max_a numeric; max_b numeric;
  r int := 0; dmg numeric; is_crit boolean;
  lg jsonb := '[]'::jsonb; winner uuid;
  ra int; rb int; exp_a numeric; delta int;
  nick_a text; nick_b text;
begin
  if me is null then raise exception 'Нужна авторизация'; end if;
  select state into st_a from public.progress where user_id = me;
  if st_a is null then raise exception 'Нет сохранённого прогресса — сначала сыграйте'; end if;

  delete from public.pvp_queue where created_at < now() - interval '2 minutes';

  select q.user_id into opp
    from public.pvp_queue q
    join public.progress g on g.user_id = q.user_id
   where q.user_id <> me
     and g.fair
     and g.power between greatest(public.lootora_power(st_a) / 2.5, 0.5)
                     and public.lootora_power(st_a) * 2.5
   order by q.created_at asc
   limit 1;

  if opp is null then
    insert into public.pvp_queue(user_id, nick)
      values (me, coalesce(st_a ->> 'nick', 'Охотник'))
      on conflict (user_id) do update set created_at = now();
    return jsonb_build_object('status', 'queued');
  end if;

  delete from public.pvp_queue where user_id in (me, opp);
  select state into st_b from public.progress where user_id = opp;
  if st_b is null then return jsonb_build_object('status', 'queued'); end if;

  p_a := public.lootora_power(st_a);  p_b := public.lootora_power(st_b);
  c_a := public.lootora_crit(st_a);    c_b := public.lootora_crit(st_b);
  cd_a := public.lootora_critdmg(st_a); cd_b := public.lootora_critdmg(st_b);
  dr_a := public.lootora_dr(st_a);     dr_b := public.lootora_dr(st_b);
  max_a := public.lootora_pvphp(st_a); max_b := public.lootora_pvphp(st_b);
  hp_a := max_a; hp_b := max_b;
  nick_a := coalesce(st_a ->> 'nick', 'Охотник');
  nick_b := coalesce(st_b ->> 'nick', 'Охотник');

  while r < 40 and hp_a > 0 and hp_b > 0 loop
    r := r + 1;
    -- жребий: кто начинает раунд
    if r = 1 and random() < 0.5 then
      is_crit := random() < c_b;
      dmg := greatest(1, round(p_b * (0.7 + random() * 0.6) * (case when is_crit then cd_b else 1 end) * (1 - dr_a)));
      hp_a := greatest(0, hp_a - dmg);
      lg := lg || jsonb_build_object('r', r, 'who', 'b', 'dmg', dmg, 'crit', is_crit, 'hp', hp_a);
      continue when hp_a <= 0;
    end if;
    is_crit := random() < c_a;
    dmg := greatest(1, round(p_a * (0.7 + random() * 0.6)
                                 * (case when is_crit then cd_a else 1 end)
                                 * (1 - dr_b)));
    hp_b := greatest(0, hp_b - dmg);
    lg := lg || jsonb_build_object('r', r, 'who', 'a', 'dmg', dmg, 'crit', is_crit, 'hp', hp_b);
    exit when hp_b <= 0;

    is_crit := random() < c_b;
    dmg := greatest(1, round(p_b * (0.7 + random() * 0.6)
                                 * (case when is_crit then cd_b else 1 end)
                                 * (1 - dr_a)));
    hp_a := greatest(0, hp_a - dmg);
    lg := lg || jsonb_build_object('r', r, 'who', 'b', 'dmg', dmg, 'crit', is_crit, 'hp', hp_a);
  end loop;

  if hp_b <= 0 and hp_a > 0 then winner := me;
  elsif hp_a <= 0 and hp_b > 0 then winner := opp;
  else winner := null;
  end if;

  insert into public.ratings(user_id) values (me)  on conflict do nothing;
  insert into public.ratings(user_id) values (opp) on conflict do nothing;
  select rating into ra from public.ratings where user_id = me;
  select rating into rb from public.ratings where user_id = opp;
  exp_a := 1 / (1 + power(10, (rb - ra) / 400.0));

  if winner is null then
    delta := 0;
  elsif winner = me then
    delta := greatest(1, round(32 * (1 - exp_a)));
  else
    delta := -1 * greatest(1, round(32 * exp_a));
  end if;

  update public.ratings set
    rating = rating + delta,
    wins   = wins   + (case when winner = me then 1 else 0 end),
    losses = losses + (case when winner = opp then 1 else 0 end),
    streak = case when winner is null then streak
                  when winner = me then greatest(streak, 0) + 1
                  else least(streak, 0) - 1 end,
    updated_at = now()
  where user_id = me;

  update public.ratings set
    rating = rating - delta,
    wins   = wins   + (case when winner = opp then 1 else 0 end),
    losses = losses + (case when winner = me then 1 else 0 end),
    streak = case when winner is null then streak
                  when winner = opp then greatest(streak, 0) + 1
                  else least(streak, 0) - 1 end,
    updated_at = now()
  where user_id = opp;

  insert into public.duels(a, b, winner, a_power, b_power, delta, log)
    values (me, opp, winner, p_a, p_b, delta, lg);

  return jsonb_build_object(
    'status', 'fight',
    'winner', winner,
    'i_won', winner = me,
    'draw', winner is null,
    'delta', delta,
    'rounds', r,
    'me', jsonb_build_object('nick', nick_a, 'power', p_a, 'hp', hp_a, 'maxHp', max_a),
    'foe', jsonb_build_object('nick', nick_b, 'power', p_b, 'hp', hp_b, 'maxHp', max_b),
    'log', lg
  );
end;
$$;

create or replace function public.pvp_leave()
returns void language sql security definer set search_path = public as $$
  delete from public.pvp_queue where user_id = auth.uid();
$$;
