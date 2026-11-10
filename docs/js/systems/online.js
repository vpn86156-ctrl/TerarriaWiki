/* Мультиплеер. Все спорные действия (бой, сделка, рейд) выполняются
   процедурами в базе: клиент получает только результат.
   Никаких имитаций живых людей — пустые разделы показываются честно. */
import { cloud } from '../core/supabase.js';

const rpc = (name, args) => cloud.rpc(name, args);

export const online = {
  ready: () => cloud.ready(),

  /* ---------- PVP: рейтинговые дуэли ---------- */
  pvpMatch: () => rpc('pvp_match'),
  pvpLeave: () => rpc('pvp_leave'),
  async duelHistory(limit = 8){
    const c = cloud;
    const rows = await c.select('duels', {
      select:'id, a, b, winner, a_power, b_power, delta, created_at',
      order:{ by:'created_at', asc:false }, limit
    });
    const nicks = {};
    const ids = [...new Set(rows.flatMap(r => [r.a, r.b]))];
    const profs = await c.select('profiles', { select:'id, nick' });
    profs.forEach(p => { nicks[p.id] = p.nick; });
    return rows.map(r => ({ ...r, a_nick: nicks[r.a] || '—', b_nick: nicks[r.b] || '—',
                            win: r.winner === r.a }));
  },

  /* ---------- Арена: быстрые бои без рейтинга ---------- */
  arenaMatch: () => rpc('arena_match'),

  /* ---------- Турнир недели ---------- */
  tournamentJoin:  () => rpc('tournament_join'),
  tournamentFight: () => rpc('tournament_fight'),
  async tournamentTable(limit = 30){
    const tid = await rpc('tournament_current');
    const rows = await cloud.select('tournament_members', {
      select:'user_id, nick, power, fights, wins, score',
      eq:{ tournament_id: tid },
      order:{ by:'score', asc:false }, limit
    });
    return { tournament: tid, rows };
  },
  async tournamentMine(){
    const { rows } = await this.tournamentTable(500);
    const me = await cloud.user();
    return rows.find(r => r.user_id === me?.id) || null;
  },

  /* ---------- Гильдии ---------- */
  guildList: () => cloud.select('guild_board', { order:{ by:'exp', asc:false }, limit:60 }),
  guildMembers: gid => cloud.select('guild_members', {
    select:'guild_id, user_id, role, joined_at, profiles(nick)', eq:{ guild_id: gid }
  }),
  async guildMine(){
    const me = await cloud.user();
    if(!me) return null;
    const rows = await cloud.select('guild_members', { select:'guild_id, role', eq:{ user_id: me.id } });
    if(!rows.length) return null;
    const board = await cloud.select('guild_board', { eq:{ id: rows[0].guild_id } });
    return board.length ? { ...board[0], myRole: rows[0].role } : null;
  },
  async guildRoster(gid){
    const [members, progress] = await Promise.all([
      cloud.select('guild_members', { select:'user_id, role, joined_at, profiles(nick)', eq:{ guild_id: gid } }),
      cloud.select('progress', { select:'user_id, level, power, kills' })
    ]);
    const byId = Object.fromEntries(progress.map(p => [p.user_id, p]));
    return members.map(m => ({
      user_id: m.user_id, role: m.role, joined_at: m.joined_at,
      nick: m.profiles?.nick || '—',
      level: byId[m.user_id]?.level || 1,
      power: byId[m.user_id]?.power || 0
    })).sort((a, b) => b.power - a.power);
  },
  guildCreate: (name, tag, emblem, motto) =>
    rpc('guild_create', { p_name:name, p_tag:tag, p_emblem:emblem, p_motto:motto }),
  guildJoin:  gid => rpc('guild_join', { p_guild: gid }),
  guildLeave: ()  => rpc('guild_leave'),
  guildRole:  (uid, role) => rpc('guild_role', { p_user:uid, p_role:role }),
  guildKick:  uid => rpc('guild_kick', { p_user:uid }),
  guildSay:   text => rpc('guild_say', { p_body: text }),
  guildChat:  (limit = 60) => cloud.select('guild_messages', {
    select:'id, user_id, nick, body, created_at',
    order:{ by:'created_at', asc:false }, limit
  }).then(rows => rows.reverse()),

  /* ---------- Совместный рейд ---------- */
  guildRaid:     () => rpc('guild_raid'),
  guildRaidHit:  () => rpc('guild_raid_hit'),

  /* ---------- Рынок ---------- */
  marketList({ order = 'created_at', limit = 60, mine = false, uid = null } = {}){
    const eq = mine ? { seller: uid } : {};
    return cloud.select('market_lots', {
      select:'id, seller, seller_nick, item, price, buyer, sold_at, created_at',
      eq, is: mine ? null : { sold_at: null },
      order:{ by: order, asc:false }, limit
    });
  },
  marketSell: (item, price) => rpc('market_sell', { p_item: item, p_price: price }),
  marketBuy:  lotId => rpc('market_buy', { p_lot: lotId }),
  marketCancel: lotId => rpc('market_cancel', { p_lot: lotId }),

  /* ---------- Друзья ---------- */
  friendRequest: nick => rpc('friend_request', { p_nick: nick }),
  friendAccept:  uid  => rpc('friend_accept', { p_user: uid }),
  friendRemove:  uid  => rpc('friend_remove', { p_user: uid }),
  async friendList(){
    const me = await cloud.user();
    if(!me) return { friends: [], pending: [] };
    const rows = await cloud.select('friends', { select:'user_id, friend_id, status', eq:{ user_id: me.id } });
    const profs = await cloud.select('profiles', { select:'id, nick' });
    const nick = Object.fromEntries(profs.map(p => [p.id, p.nick]));
    const friends = [], pending = [];
    rows.forEach(r => {
      const item = { user_id: r.friend_id, nick: nick[r.friend_id] || '—' };
      (r.status === 'accepted' ? friends : pending).push(item);
    });
    return { friends, pending };
  },

  /* ---------- Общий чат «Таверна» ---------- */
  tavern: (limit = 60) => cloud.select('tavern_messages', {
    select:'id, user_id, nick, body, created_at', order:{ by:'created_at', asc:false }, limit
  }).then(rows => rows.reverse()),
  tavernSay: text => rpc('tavern_say', { p_body: text }),

  /* ---------- Жалобы ---------- */
  async report(kind, targetNick, body){
    const me = await cloud.user();
    if(!me) throw new Error('Нужна авторизация');
    let target = null;
    if(targetNick){
      const profs = await cloud.select('profiles', { select:'id', eq:{ nick: targetNick } });
      target = profs[0]?.id || null;
      if(!target) throw new Error('Игрок с таким ником не найден');
    }
    await cloud.insert('reports', { reporter: me.id, target, kind, body: (body || '').slice(0, 500) });
    return true;
  },

  /* ---------- Рилтайм ---------- */
  async subscribe(table, onEvent){
    const ch = await cloud.channel('lootora-' + table);
    if(!ch) return null;
    ch.on('postgres_changes', { event:'*', schema:'public', table }, onEvent).subscribe();
    return ch;
  }
};
