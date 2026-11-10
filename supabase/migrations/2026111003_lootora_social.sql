-- ===== LOOTORA · гильдии, рынок, арена, турниры, жалобы =====

alter table public.ratings add column if not exists arena_points int not null default 0;
alter table public.ratings add column if not exists arena_best  int not null default 0;

-- ---------- ГИЛЬДИИ ----------
create table if not exists public.guilds (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique check (char_length(name) between 3 and 20),
  tag        text not null check (char_length(tag) between 2 and 5),
  emblem     jsonb not null default '{}'::jsonb,
  motto      text not null default '' check (char_length(motto) <= 120),
  leader     uuid not null references public.profiles(id) on delete cascade,
  exp        bigint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.guild_members (
  guild_id  uuid not null references public.guilds(id) on delete cascade,
  user_id   uuid primary key references public.profiles(id) on delete cascade,
  role      text not null default 'member' check (role in ('leader','officer','member')),
  joined_at timestamptz not null default now()
);

create table if not exists public.guild_messages (
  id         bigserial primary key,
  guild_id   uuid not null references public.guilds(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  nick       text not null,
  body       text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now()
);

create or replace view public.guild_board as
  select g.*, count(m.user_id) as members,
         1 + floor(ln(1 + g.exp / 400.0) / ln(1.7))::int as level
  from public.guilds g
  left join public.guild_members m on m.guild_id = g.id
  group by g.id;

alter table public.guilds         enable row level security;
alter table public.guild_members  enable row level security;
alter table public.guild_messages enable row level security;

create policy "гильдии видны всем" on public.guilds for select using (true);
create policy "состав виден всем" on public.guild_members for select using (true);
create policy "чат только для своих" on public.guild_messages for select using (
  exists (select 1 from public.guild_members m
           where m.guild_id = guild_messages.guild_id and m.user_id = auth.uid())
);
create policy "писать могут свои" on public.guild_messages for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.guild_members m
               where m.guild_id = guild_messages.guild_id and m.user_id = auth.uid())
  and not exists (select 1 from public.profiles p
                   where p.id = auth.uid() and p.muted_until > now())
);
grant select on public.guild_board to anon, authenticated;

create or replace function public.guild_create(p_name text, p_tag text, p_emblem jsonb, p_motto text)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); gid uuid; cnt int;
begin
  if me is null then raise exception 'Нужна авторизация'; end if;
  select count(*) into cnt from public.guilds where leader = me;
  if cnt > 0 then raise exception 'Вы уже возглавляете гильдию'; end if;
  delete from public.guild_members where user_id = me;
  insert into public.guilds(name, tag, emblem, motto, leader)
    values (p_name, p_tag, coalesce(p_emblem, '{}'::jsonb), coalesce(p_motto, ''), me)
    returning id into gid;
  insert into public.guild_members(guild_id, user_id, role) values (gid, me, 'leader');
  return gid;
end;
$$;

create or replace function public.guild_join(p_guild uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Нужна авторизация'; end if;
  delete from public.guild_members where user_id = me;
  insert into public.guild_members(guild_id, user_id, role) values (p_guild, me, 'member');
end;
$$;

create or replace function public.guild_leave()
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); gid uuid; heir uuid;
begin
  if me is null then raise exception 'Нужна авторизация'; end if;
  select guild_id into gid from public.guild_members where user_id = me;
  if gid is null then return; end if;
  delete from public.guild_members where user_id = me;
  if exists (select 1 from public.guilds where id = gid and leader = me) then
    select user_id into heir from public.guild_members
      where guild_id = gid order by joined_at asc limit 1;
    if heir is null then
      delete from public.guilds where id = gid;
    else
      update public.guilds set leader = heir where id = gid;
      update public.guild_members set role = 'leader' where guild_id = gid and user_id = heir;
    end if;
  end if;
end;
$$;

create or replace function public.guild_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); gid uuid;
begin
  select guild_id into gid from public.guild_members where user_id = me and role = 'leader';
  if gid is null then raise exception 'Только глава гильдии меняет роли'; end if;
  if p_role not in ('officer','member') then raise exception 'Недопустимая роль'; end if;
  update public.guild_members set role = p_role
   where guild_id = gid and user_id = p_user and role <> 'leader';
end;
$$;

create or replace function public.guild_kick(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); gid uuid; my_role text;
begin
  select guild_id, role into gid, my_role from public.guild_members where user_id = me;
  if gid is null or my_role not in ('leader','officer') then raise exception 'Недостаточно прав'; end if;
  delete from public.guild_members where guild_id = gid and user_id = p_user and role <> 'leader';
end;
$$;

create or replace function public.guild_say(p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); gid uuid; nm text;
begin
  if me is null then raise exception 'Нужна авторизация'; end if;
  if exists (select 1 from public.profiles p where p.id = me and p.muted_until > now())
  then raise exception 'Чат временно недоступен'; end if;
  select guild_id into gid from public.guild_members where user_id = me;
  if gid is null then raise exception 'Вы не в гильдии'; end if;
  select nick into nm from public.profiles where id = me;
  insert into public.guild_messages(guild_id, user_id, nick, body)
    values (gid, me, nm, left(btrim(p_body), 300));
end;
$$;

-- ---------- РЫНОК (только игровое золото) ----------
create table if not exists public.market_lots (
  id          uuid primary key default gen_random_uuid(),
  seller      uuid not null references public.profiles(id) on delete cascade,
  seller_nick text not null,
  item        jsonb not null,
  price       bigint not null check (price > 0 and price <= 100000000000),
  buyer       uuid references public.profiles(id) on delete set null,
  sold_at     timestamptz,
  created_at  timestamptz not null default now()
);
alter table public.market_lots enable row level security;
create policy "лоты видны всем" on public.market_lots for select using (true);
create policy "свой лот: снять" on public.market_lots for delete
  using (auth.uid() = seller and sold_at is null);

create or replace function public.market_sell(p_item jsonb, p_price bigint)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); nm text; lid uuid; cnt int;
begin
  if me is null then raise exception 'Нужна авторизация'; end if;
  if not exists (select 1 from public.progress where user_id = me and fair)
  then raise exception 'Торговля недоступна для этого профиля'; end if;
  select nick into nm from public.profiles where id = me;
  select count(*) into cnt from public.market_lots where seller = me and sold_at is null;
  if cnt >= 12 then raise exception 'Можно выставить не более 12 лотов'; end if;
  insert into public.market_lots(seller, seller_nick, item, price)
    values (me, nm, p_item, p_price) returning id into lid;
  return lid;
end;
$$;

-- Атомарная покупка: списание, зачисление и передача вещи в одной транзакции.
create or replace function public.market_buy(p_lot uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); lot record; gold bigint; fee bigint; inv_cnt int;
        new_inv jsonb; st jsonb;
begin
  if me is null then raise exception 'Нужна авторизация'; end if;
  select * into lot from public.market_lots where id = p_lot for update;
  if lot.id is null then raise exception 'Лот не найден'; end if;
  if lot.sold_at is not null then raise exception 'Лот уже куплен'; end if;
  if lot.seller = me then raise exception 'Нельзя купить свой лот'; end if;
  if not exists (select 1 from public.progress where user_id = me and fair)
  then raise exception 'Покупка недоступна для этого профиля'; end if;

  select state into st from public.progress where user_id = me for update;
  gold := coalesce((st ->> 'gold')::bigint, 0);
  if gold < lot.price then raise exception 'Недостаточно золота'; end if;
  inv_cnt := coalesce(jsonb_array_length(coalesce(st -> 'inv', '[]'::jsonb)), 0);
  if inv_cnt >= 120 then raise exception 'Инвентарь заполнен'; end if;

  fee := floor(lot.price * 0.03);
  st := jsonb_set(st, '{gold}', to_jsonb(gold - lot.price));
  new_inv := coalesce(st -> 'inv', '[]'::jsonb) || jsonb_build_array(lot.item);
  st := jsonb_set(st, '{inv}', new_inv);
  update public.progress set state = st where user_id = me;

  update public.progress
     set state = jsonb_set(state, '{gold}',
           to_jsonb(coalesce((state ->> 'gold')::bigint, 0) + lot.price - fee))
   where user_id = lot.seller;

  update public.market_lots set sold_at = now(), buyer = me where id = p_lot;

  return jsonb_build_object('gold', gold - lot.price, 'fee', fee,
                            'item', lot.item, 'price', lot.price,
                            'seller', lot.seller_nick);
end;
$$;

create or replace function public.market_cancel(p_lot uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); lot record; st jsonb; new_inv jsonb; inv_cnt int;
begin
  if me is null then raise exception 'Нужна авторизация'; end if;
  select * into lot from public.market_lots where id = p_lot for update;
  if lot.id is null then raise exception 'Лот не найден'; end if;
  if lot.seller <> me then raise exception 'Это чужой лот'; end if;
  if lot.sold_at is not null then raise exception 'Лот уже продан'; end if;

  select state into st from public.progress where user_id = me for update;
  inv_cnt := coalesce(jsonb_array_length(coalesce(st -> 'inv', '[]'::jsonb)), 0);
  if inv_cnt >= 120 then raise exception 'Инвентарь заполнен — сначала продайте лишнее'; end if;
  new_inv := coalesce(st -> 'inv', '[]'::jsonb) || jsonb_build_array(lot.item);
  st := jsonb_set(st, '{inv}', new_inv);
  update public.progress set state = st where user_id = me;
  delete from public.market_lots where id = p_lot;
  return jsonb_build_object('item', lot.item);
end;
$$;

-- ---------- АРЕНА (быстрые бои без рейтинга) ----------
create or replace function public.arena_match()
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); opp uuid; st_a jsonb; st_b jsonb;
        p_a numeric; p_b numeric; c_a numeric; c_b numeric; cd_a numeric; cd_b numeric;
        dr_a numeric; dr_b numeric; hp_a numeric; hp_b numeric; max_a numeric; max_b numeric;
        r int := 0; dmg numeric; is_crit boolean; lg jsonb := '[]'::jsonb; winner uuid;
        pts int; best int;
begin
  if me is null then raise exception 'Нужна авторизация'; end if;
  select state into st_a from public.progress where user_id = me;
  if st_a is null then raise exception 'Нет сохранённого прогресса'; end if;

  select g.user_id into opp
    from public.progress g
   where g.user_id <> me and g.fair
     and g.power between greatest(public.lootora_power(st_a) / 3, 0.5)
                     and public.lootora_power(st_a) * 3
     and g.updated_at > now() - interval '7 days'
   order by random() limit 1;

  if opp is null then
    return jsonb_build_object('status', 'empty',
      'note', 'На арене сейчас некого вызвать — нужны другие игроки с близкой силой');
  end if;

  select state into st_b from public.progress where user_id = opp;
  p_a := public.lootora_power(st_a);      p_b := public.lootora_power(st_b);
  c_a := public.lootora_crit(st_a);       c_b := public.lootora_crit(st_b);
  cd_a := public.lootora_critdmg(st_a);   cd_b := public.lootora_critdmg(st_b);
  dr_a := public.lootora_dr(st_a);        dr_b := public.lootora_dr(st_b);
  max_a := public.lootora_pvphp(st_a);    max_b := public.lootora_pvphp(st_b);
  hp_a := max_a; hp_b := max_b;

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
                                 * (case when is_crit then cd_a else 1 end) * (1 - dr_b)));
    hp_b := greatest(0, hp_b - dmg);
    lg := lg || jsonb_build_object('r', r, 'who', 'a', 'dmg', dmg, 'crit', is_crit, 'hp', hp_b);
    exit when hp_b <= 0;
    is_crit := random() < c_b;
    dmg := greatest(1, round(p_b * (0.7 + random() * 0.6)
                                 * (case when is_crit then cd_b else 1 end) * (1 - dr_a)));
    hp_a := greatest(0, hp_a - dmg);
    lg := lg || jsonb_build_object('r', r, 'who', 'b', 'dmg', dmg, 'crit', is_crit, 'hp', hp_a);
  end loop;

  winner := case when hp_b <= 0 and hp_a > 0 then me
                  when hp_a <= 0 and hp_b > 0 then opp else null end;
  pts := case when winner = me then 10 when winner is null then 3 else 1 end;

  insert into public.ratings(user_id) values (me) on conflict do nothing;
  update public.ratings set arena_points = arena_points + pts,
    arena_best = greatest(arena_best, arena_points + pts), updated_at = now()
   where user_id = me;

  return jsonb_build_object('status','fight','winner',winner,'i_won', winner = me,
    'draw', winner is null, 'points', pts, 'rounds', r,
    'me', jsonb_build_object('nick', coalesce(st_a ->> 'nick','Охотник'), 'power', p_a, 'hp', hp_a, 'maxHp', max_a),
    'foe', jsonb_build_object('nick', coalesce(st_b ->> 'nick','Охотник'), 'power', p_b, 'hp', hp_b, 'maxHp', max_b),
    'log', lg);
end;
$$;

-- ---------- ТУРНИР НЕДЕЛИ ----------
create table if not exists public.tournaments (
  id         serial primary key,
  starts_at  timestamptz not null default now(),
  ends_at    timestamptz not null default (now() + interval '7 days'),
  status     text not null default 'open'
);
create table if not exists public.tournament_members (
  tournament_id int not null references public.tournaments(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  nick          text not null,
  power         numeric not null default 0,
  fights        int not null default 0,
  wins          int not null default 0,
  score         int not null default 0,
  joined_at     timestamptz not null default now(),
  primary key (tournament_id, user_id)
);
alter table public.tournaments         enable row level security;
alter table public.tournament_members  enable row level security;
create policy "турнир виден всем" on public.tournaments for select using (true);
create policy "участники видны всем" on public.tournament_members for select using (true);

create or replace function public.tournament_current()
returns int language plpgsql security definer set search_path = public as $$
declare tid int;
begin
  select id into tid from public.tournaments
   where status = 'open' and ends_at > now() order by id desc limit 1;
  if tid is null then
    update public.tournaments set status = 'closed' where status = 'open';
    insert into public.tournaments default values returning id into tid;
  end if;
  return tid;
end;
$$;

create or replace function public.tournament_join()
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); tid int; st jsonb; nm text;
begin
  if me is null then raise exception 'Нужна авторизация'; end if;
  tid := public.tournament_current();
  select p.state, f.nick into st, nm
    from public.progress p join public.profiles f on f.id = p.user_id
   where p.user_id = me;
  if st is null then raise exception 'Нет сохранённого прогресса'; end if;
  insert into public.tournament_members(tournament_id, user_id, nick, power)
    values (tid, me, nm, public.lootora_power(st))
    on conflict (tournament_id, user_id) do nothing;
  return jsonb_build_object('tournament', tid);
end;
$$;

create or replace function public.tournament_fight()
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); tid int; opp uuid; mine record;
        st_a jsonb; st_b jsonb; winner uuid; pts int;
        p_a numeric; p_b numeric; c_a numeric; c_b numeric; cd_a numeric; cd_b numeric;
        dr_a numeric; dr_b numeric; hp_a numeric; hp_b numeric; max_a numeric; max_b numeric;
        r int := 0; dmg numeric; is_crit boolean; lg jsonb := '[]'::jsonb;
begin
  if me is null then raise exception 'Нужна авторизация'; end if;
  tid := public.tournament_current();
  select * into mine from public.tournament_members where tournament_id = tid and user_id = me;
  if mine.user_id is null then raise exception 'Сначала подайте заявку на турнир'; end if;
  if mine.fights >= 5 then raise exception 'Лимит боёв на турнир исчерпан (5)'; end if;

  select state into st_a from public.progress where user_id = me;
  select tm.user_id into opp
    from public.tournament_members tm
    join public.progress g on g.user_id = tm.user_id
   where tm.tournament_id = tid and tm.user_id <> me and tm.fights < 5 and g.fair
     and abs(ln(greatest(tm.power,1)) - ln(greatest(mine.power,1))) < 0.9
   order by tm.fights asc, random() limit 1;

  if opp is null then
    return jsonb_build_object('status','waiting',
      'note','Подходящий соперник ещё не подал заявку или уже провёл все бои');
  end if;

  select state into st_b from public.progress where user_id = opp;
  p_a := public.lootora_power(st_a);      p_b := public.lootora_power(st_b);
  c_a := public.lootora_crit(st_a);       c_b := public.lootora_crit(st_b);
  cd_a := public.lootora_critdmg(st_a);   cd_b := public.lootora_critdmg(st_b);
  dr_a := public.lootora_dr(st_a);        dr_b := public.lootora_dr(st_b);
  max_a := public.lootora_pvphp(st_a);    max_b := public.lootora_pvphp(st_b);
  hp_a := max_a; hp_b := max_b;

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
    dmg := greatest(1, round(p_a * (0.7 + random()*0.6)
                                 * (case when is_crit then cd_a else 1 end) * (1 - dr_b)));
    hp_b := greatest(0, hp_b - dmg);
    lg := lg || jsonb_build_object('r', r, 'who','a','dmg',dmg,'crit',is_crit,'hp',hp_b);
    exit when hp_b <= 0;
    is_crit := random() < c_b;
    dmg := greatest(1, round(p_b * (0.7 + random()*0.6)
                                 * (case when is_crit then cd_b else 1 end) * (1 - dr_a)));
    hp_a := greatest(0, hp_a - dmg);
    lg := lg || jsonb_build_object('r', r, 'who','b','dmg',dmg,'crit',is_crit,'hp',hp_a);
  end loop;

  winner := case when hp_b <= 0 and hp_a > 0 then me
                  when hp_a <= 0 and hp_b > 0 then opp else null end;
  pts := case when winner = me then 3 when winner is null then 1 else 0 end;

  update public.tournament_members set fights = fights + 1,
    wins = wins + (case when winner = me then 1 else 0 end),
    score = score + pts
   where tournament_id = tid and user_id = me;
  update public.tournament_members set fights = fights + 1,
    wins = wins + (case when winner = opp then 1 else 0 end),
    score = score + (case when winner = opp then 3 when winner is null then 1 else 0 end)
   where tournament_id = tid and user_id = opp;

  return jsonb_build_object('status','fight','winner',winner,'i_won', winner = me,
    'draw', winner is null, 'score', pts, 'fights_left', 5 - (mine.fights + 1), 'rounds', r,
    'me', jsonb_build_object('nick', coalesce(st_a ->> 'nick','Охотник'), 'power', p_a, 'hp', hp_a, 'maxHp', max_a),
    'foe', jsonb_build_object('nick', coalesce(st_b ->> 'nick','Охотник'), 'power', p_b, 'hp', hp_b, 'maxHp', max_b),
    'log', lg);
end;
$$;

-- ---------- ЖАЛОБЫ ----------
create table if not exists public.reports (
  id         bigserial primary key,
  reporter   uuid not null references public.profiles(id) on delete cascade,
  target     uuid references public.profiles(id) on delete cascade,
  kind       text not null check (kind in ('nick','chat','fraud','other')),
  body       text check (char_length(body) <= 500),
  status     text not null default 'new',
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;
create policy "свои жалобы" on public.reports for select using (auth.uid() = reporter);
create policy "пожаловаться может каждый" on public.reports for insert with check (auth.uid() = reporter);

-- ---------- РИЛТАЙМ ----------
do $$
begin
  alter publication supabase_realtime add table public.guild_messages;
exception when others then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.market_lots;
exception when others then null;
end $$;
