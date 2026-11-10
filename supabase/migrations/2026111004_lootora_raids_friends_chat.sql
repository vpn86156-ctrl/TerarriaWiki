-- ===== LOOTORA · совместные рейды, друзья, общий чат =====

-- ---------- СОВМЕСТНЫЕ РЕЙДЫ ГИЛЬДИИ ----------
create table if not exists public.guild_raids (
  id         bigserial primary key,
  guild_id   uuid not null references public.guilds(id) on delete cascade,
  boss       jsonb not null,
  hp         numeric not null,
  max_hp     numeric not null,
  started_at timestamptz not null default now(),
  ended_at   timestamptz,
  week       int not null
);

create table if not exists public.guild_raid_hits (
  raid_id     bigint not null references public.guild_raids(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  nick        text not null,
  damage      numeric not null default 0,
  hits        int not null default 0,
  last_hit_at timestamptz not null default now(),
  primary key (raid_id, user_id)
);

alter table public.guild_raids     enable row level security;
alter table public.guild_raid_hits enable row level security;
create policy "рейд виден своей гильдии" on public.guild_raids for select using (
  exists (select 1 from public.guild_members m
           where m.guild_id = guild_raids.guild_id and m.user_id = auth.uid())
);
create policy "вклад виден своей гильдии" on public.guild_raid_hits for select using (
  exists (select 1 from public.guild_raids r
           join public.guild_members m on m.guild_id = r.guild_id
           where r.id = guild_raid_hits.raid_id and m.user_id = auth.uid())
);

create or replace function public.guild_raid()
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); gid uuid; rid bigint; wk int;
begin
  if me is null then raise exception 'Нужна авторизация'; end if;
  select guild_id into gid from public.guild_members where user_id = me;
  if gid is null then raise exception 'Вы не в гильдии'; end if;

  wk := extract(week from now())::int + extract(year from now())::int * 100;
  select id into rid from public.guild_raids
   where guild_id = gid and week = wk order by id desc limit 1;

  if rid is null then
    insert into public.guild_raids(guild_id, boss, hp, max_hp, week)
      values (gid,
              jsonb_build_object('name','Порождение разлома','icon','◈'),
              20000 + (select count(*) from public.guild_members m where m.guild_id = gid) * 40000,
              20000 + (select count(*) from public.guild_members m where m.guild_id = gid) * 40000,
              wk)
      returning id into rid;
  end if;

  return jsonb_build_object(
    'raid', (select to_jsonb(r) - 'guild_id' from public.guild_raids r where r.id = rid),
    'mine', coalesce((select to_jsonb(h) from public.guild_raid_hits h
                       where h.raid_id = rid and h.user_id = me), 'null'::jsonb),
    'top', coalesce((select jsonb_agg(t order by (t->>'damage')::numeric desc)
                     from (select to_jsonb(h) - 'last_hit_at' as t
                           from public.guild_raid_hits h where h.raid_id = rid
                           order by h.damage desc limit 12) s), '[]'::jsonb),
    'cooldown', greatest(0, 180 - extract(epoch from (now() - coalesce(
                 (select last_hit_at from public.guild_raid_hits h
                   where h.raid_id = rid and h.user_id = me), now() - interval '10 minutes'))))
  );
end;
$$;

-- Удар по рейдовому боссу: урон считает сервер из сохранённой мощи.
create or replace function public.guild_raid_hit()
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); gid uuid; rid bigint; wk int;
        st jsonb; pw numeric; dmg numeric; last timestamptz; nm text;
        raid record;
begin
  if me is null then raise exception 'Нужна авторизация'; end if;
  select guild_id into gid from public.guild_members where user_id = me;
  if gid is null then raise exception 'Вы не в гильдии'; end if;

  wk := extract(week from now())::int + extract(year from now())::int * 100;
  select id into rid from public.guild_raids
   where guild_id = gid and week = wk order by id desc limit 1;
  if rid is null then raise exception 'Рейд ещё не начался — откройте вкладку рейда'; end if;

  select * into raid from public.guild_raids where id = rid for update;
  if raid.ended_at is not null then raise exception 'Рейд уже завершён'; end if;

  select last_hit_at into last from public.guild_raid_hits where raid_id = rid and user_id = me;
  if last is not null and last > now() - interval '3 minutes' then
    raise exception 'Отдых перед следующим ударом: % с',
      ceil(180 - extract(epoch from (now() - last)));
  end if;

  select p.state, f.nick into st, nm
    from public.progress p join public.profiles f on f.id = p.user_id
   where p.user_id = me;
  if st is null then raise exception 'Нет сохранённого прогресса'; end if;

  pw := public.lootora_power(st);
  dmg := greatest(1, round(pw * (6 + random() * 6) * (1 + public.lootora_dr(st))));

  insert into public.guild_raid_hits(raid_id, user_id, nick, damage, hits, last_hit_at)
    values (rid, me, nm, dmg, 1, now())
    on conflict (raid_id, user_id) do update
      set damage = guild_raid_hits.damage + dmg,
          hits = guild_raid_hits.hits + 1,
          last_hit_at = now();

  update public.guild_raids set hp = greatest(0, hp - dmg) where id = rid;

  if (select hp from public.guild_raids where id = rid) <= 0 then
    update public.guild_raids set ended_at = now() where id = rid;
    update public.guilds set exp = exp + 1200 where id = gid;
  end if;

  return jsonb_build_object('damage', dmg,
    'hp', (select hp from public.guild_raids where id = rid),
    'max_hp', raid.max_hp,
    'killed', (select hp from public.guild_raids where id = rid) <= 0);
end;
$$;

-- ---------- ДРУЗЬЯ ----------
create table if not exists public.friends (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  friend_id  uuid not null references public.profiles(id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  constraint friends_no_self check (user_id <> friend_id)
);
alter table public.friends enable row level security;
create policy "свои связи видны" on public.friends for select
  using (auth.uid() = user_id or (auth.uid() = friend_id and status = 'accepted'));
create policy "заявку посылаю сам" on public.friends for insert with check (auth.uid() = user_id);
create policy "свою связь удаляю сам" on public.friends for delete using (auth.uid() = user_id or auth.uid() = friend_id);

create or replace function public.friend_request(p_nick text)
returns text language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); fid uuid;
begin
  if me is null then raise exception 'Нужна авторизация'; end if;
  select id into fid from public.profiles where nick = p_nick;
  if fid is null then raise exception 'Игрок с таким ником не найден'; end if;
  if fid = me then raise exception 'Нельзя добавить себя'; end if;
  if exists (select 1 from public.friends where user_id = fid and friend_id = me and status = 'accepted')
     and not exists (select 1 from public.friends where user_id = me and friend_id = fid) then
    insert into public.friends(user_id, friend_id, status) values (me, fid, 'accepted');
    insert into public.friends(user_id, friend_id, status) values (fid, me, 'accepted');
    return 'accepted';
  end if;
  insert into public.friends(user_id, friend_id, status) values (me, fid, 'pending')
    on conflict do nothing;
  return 'pending';
end;
$$;

create or replace function public.friend_accept(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  update public.friends set status = 'accepted'
   where user_id = p_user and friend_id = me and status = 'pending';
  insert into public.friends(user_id, friend_id, status) values (me, p_user, 'accepted')
    on conflict (user_id, friend_id) do update set status = 'accepted';
end;
$$;

create or replace function public.friend_remove(p_user uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.friends
   where (user_id = auth.uid() and friend_id = p_user)
      or (friend_id = auth.uid() and user_id = p_user);
$$;

-- ---------- ОБЩИЙ ЧАТ «ТАВЕРНА» ----------
create table if not exists public.tavern_messages (
  id         bigserial primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  nick       text not null,
  body       text not null check (char_length(body) between 1 and 240),
  created_at timestamptz not null default now()
);
alter table public.tavern_messages enable row level security;
create policy "таверна видна всем" on public.tavern_messages for select using (true);

create or replace function public.tavern_say(p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); last timestamptz; nm text;
begin
  if me is null then raise exception 'Нужна авторизация'; end if;
  if exists (select 1 from public.profiles p where p.id = me and p.muted_until > now())
  then raise exception 'Чат временно недоступен'; end if;
  select created_at into last from public.tavern_messages
   where user_id = me order by created_at desc limit 1;
  if last is not null and last > now() - interval '5 seconds' then
    raise exception 'Не чаще одного сообщения в 5 секунд';
  end if;
  select nick into nm from public.profiles where id = me;
  insert into public.tavern_messages(user_id, nick, body)
    values (me, nm, left(btrim(p_body), 240));
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.tavern_messages;
exception when others then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.guild_raids;
exception when others then null;
end $$;
