/* Адаптер Supabase: вход, профиль, облачное сохранение, рейтинги.
   SDK лежит в vendor/ — внешних запросов к CDN нет.
   Политика доступа к данным задаётся Row Level Security в базе:
   клиент видит ровно то, что разрешено правилами. */
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

let client = null;
let cachedUser = null;

export const cloudReady = () => !!(SUPABASE_URL && SUPABASE_ANON_KEY);

/** Инициализация: ничего не грузим, пока не понадобится. */
export async function initCloud(){
  if(!cloudReady()) return false;
  const c = await sb();
  if(!c) return false;
  try{ const { data } = await c.auth.getSession(); cachedUser = data?.session?.user || null; }
  catch(e){ cachedUser = null; }
  return true;
}

async function sb(){
  if(!cloudReady()) return null;
  if(client) return client;
  try{
    const { createClient } = await import('../../vendor/supabase.esm.js');
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true, flowType:'pkce' }
    });
    return client;
  }catch(e){ return null; }
}

const err = e => new Error(e?.message || e?.error_description || 'Ошибка запроса к серверу');

/** «Вес» сохранения — по нему решаем, чей прогресс больше. */
export function worth(s){
  if(!s) return -1;
  return (s.level || 1) * 1e12 + (s.kills || 0) * 1e5 + (s.totalDamage || 0);
}

export const cloud = {
  ready: cloudReady,
  get config(){ return { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY }; },

  async session(){
    const c = await sb(); if(!c) return null;
    const { data } = await c.auth.getSession();
    cachedUser = data?.session?.user || null;
    return data?.session || null;
  },
  async user(){
    if(cachedUser) return cachedUser;
    const s = await this.session();
    return s?.user || null;
  },
  async signOut(){
    const c = await sb(); if(!c) return;
    await c.auth.signOut(); cachedUser = null;
  },

  async nickTaken(nick){
    const c = await sb(); if(!c) return false;
    const { data } = await c.from('profiles').select('id').eq('nick', nick).maybeSingle();
    return !!data;
  },

  async signUp(email, password, nick){
    const c = await sb(); if(!c) throw new Error('Supabase недоступен');
    if(await this.nickTaken(nick)) throw new Error('Такой ник уже занят');
    const { data, error } = await c.auth.signUp({ email, password, options:{ data:{ nick } } });
    if(error) throw err(error);
    if(data?.user && !data?.session){
      return { user:data.user, session:null };
    }
    cachedUser = data?.user || null;
    await this.ensureProfile(nick);
    return data;
  },

  async signIn(email, password){
    const c = await sb(); if(!c) throw new Error('Supabase недоступен');
    const { data, error } = await c.auth.signInWithPassword({ email, password });
    if(error) throw err(error);
    cachedUser = data?.user || null;
    return data;
  },

  async resetPassword(email){
    const c = await sb(); if(!c) throw new Error('Supabase недоступен');
    const { error } = await c.auth.resetPasswordForEmail(email, {
      redirectTo: location.origin + location.pathname
    });
    if(error) throw err(error);
  },

  /** Профиль создаётся один раз: если входа не было (например, вход по ссылке). */
  async ensureProfile(nick){
    const c = await sb(); if(!c) return null;
    const u = await this.user(); if(!u) return null;
    const { data, error } = await c
      .from('profiles')
      .upsert({ id:u.id, nick, last_seen:new Date().toISOString() }, { onConflict:'id', ignoreDuplicates:true })
      .select().maybeSingle();
    if(error && error.code !== '23505') throw err(error);
    return data || null;
  },

  async profile(){
    const c = await sb(); if(!c) return null;
    const u = await this.user(); if(!u) return null;
    const { data } = await c.from('profiles').select('*').eq('id', u.id).maybeSingle();
    return data || null;
  },

  async saveProgress(state){
    const c = await sb(); if(!c) return null;
    const u = await this.user(); if(!u) return null;
    const { data, error } = await c.from('progress')
      .upsert({ user_id:u.id, state }, { onConflict:'user_id' })
      .select('power, level, kills, fair, updated_at').maybeSingle();
    if(error) throw err(error);
    return data || null;
  },

  async loadProgress(){
    const c = await sb(); if(!c) return null;
    const u = await this.user(); if(!u) return null;
    const { data, error } = await c.from('progress')
      .select('state, power, level, kills, fair, updated_at').eq('user_id', u.id).maybeSingle();
    if(error) return null;
    return data || null;
  },

  /** При входе: берём то сохранение, где прогресс больше, и синхронизируем. */
  async reconcile(local, apply){
    const remote = await this.loadProgress();
    if(!remote?.state) { await this.saveProgress(local); return { from:'local', state:local }; }
    if(worth(remote.state) > worth(local)){
      apply(remote.state);
      return { from:'cloud', state:remote.state, power:remote.power, fair:remote.fair };
    }
    const meta = await this.saveProgress(local);
    return { from:'local', state:local, power:meta?.power, fair:meta?.fair };
  },

  async leaderboard(sort = 'rating', limit = 50){
    const c = await sb(); if(!c) return [];
    const cols = { rating:'rating', power:'power', level:'level', kills:'kills' };
    const col = cols[sort] || 'rating';
    const { data } = await c.from('leaderboard')
      .select('nick, user_id, rating, wins, losses, streak, level, kills, power, fair, updated_at')
      .order(col, { ascending:false }).limit(limit);
    return data || [];
  },

  async myRating(){
    const c = await sb(); if(!c) return null;
    const u = await this.user(); if(!u) return null;
    const { data } = await c.from('ratings').select('*').eq('user_id', u.id).maybeSingle();
    return data || null;
  },

  /** Вызов серверной процедуры (бои, гильдии, рынок считаются в базе). */
  async rpc(name, args = {}){
    const c = await sb(); if(!c) throw new Error('Supabase недоступен');
    const { data, error } = await c.rpc(name, args);
    if(error) throw err(error);
    return data;
  },

  async select(table, { select = '*', eq, order, limit, is } = {}){
    const c = await sb(); if(!c) return [];
    let q = c.from(table).select(select);
    for(const [k, v] of Object.entries(eq || {})) q = q.eq(k, v);
    for(const [k, v] of Object.entries(is || {})) q = q.is(k, v);
    if(order) q = q.order(order.by, { ascending: !!order.asc });
    if(limit) q = q.limit(limit);
    const { data } = await q;
    return data || [];
  },

  async insert(table, row){
    const c = await sb(); if(!c) throw new Error('Supabase недоступен');
    const { data, error } = await c.from(table).insert(row).select().maybeSingle();
    if(error) throw err(error);
    return data;
  },

  async channel(name){
    const c = await sb(); if(!c) return null;
    return c.channel(name);
  }
};

/** Честный статус подключения для индикатора в шапке. */
export function connectionLabel(){
  if(!cloudReady()) return { cls:'offline', text:'локально' };
  return { cls:'online', text: cachedUser ? 'облако' : 'не вошёл' };
}
