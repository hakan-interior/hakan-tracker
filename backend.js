// Data layer. Uses Supabase (hosted, shared, realtime) when config.js is filled in,
// otherwise the local Node server in server.js.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const COLS = ['projects', 'rooms', 'materials', 'log', 'orders'];

export async function createBackend({ onStatus = () => {} } = {}) {
  return SUPABASE_URL && SUPABASE_ANON_KEY ? supabaseBackend(onStatus) : serverBackend(onStatus);
}

// Wraps a request so the sync dot shows busy / ok / offline.
function tracked(onStatus) {
  return async fn => {
    onStatus('busy');
    try { const r = await fn(); onStatus('ok'); return r; }
    catch (e) { onStatus('off'); throw e; }
  };
}

/* ---------- Supabase ---------- */
async function supabaseBackend(onStatus) {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  const run = tracked(onStatus);
  const check = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

  async function fetchAll(table) {
    const out = [];
    for (let from = 0; ; from += 1000) {
      const rows = check(await sb.from(table).select('data').order('id').range(from, from + 999));
      out.push(...rows.map(r => r.data));
      if (rows.length < 1000) return out;
    }
  }

  return {
    mode: 'supabase',
    needsLogin: true,
    async user() { const { data } = await sb.auth.getSession(); return data.session?.user || null; },
    async signIn(email, password) { const { data, error } = await sb.auth.signInWithPassword({ email, password }); if (error) throw error; return data.user; },
    async signOut() { await sb.auth.signOut(); },
    async changePassword(password) { const { error } = await sb.auth.updateUser({ password }); if (error) throw error; },
    load: () => run(async () => {
      const [settings, ...lists] = await Promise.all([
        sb.from('settings').select('data').eq('id', 1).maybeSingle().then(check),
        ...COLS.map(fetchAll),
      ]);
      const db = { settings: settings?.data || null };
      COLS.forEach((c, i) => { db[c] = lists[i]; });
      db.log.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
      return db;
    }),
    put: (col, item) => run(async () => check(await sb.from(col).upsert({ id: item.id, data: item, updated_at: new Date().toISOString() }))),
    del: (col, id) => run(async () => {
      if (col === 'projects') check(await sb.from('rooms').delete().eq('data->>projectId', id));
      check(await sb.from(col).delete().eq('id', id));
    }),
    putSettings: settings => run(async () => check(await sb.from('settings').upsert({ id: 1, data: settings, updated_at: new Date().toISOString() }))),
    importAll: db => run(async () => {
      for (const c of COLS) {
        check(await sb.from(c).delete().neq('id', ''));
        const rows = db[c] || [];
        for (let i = 0; i < rows.length; i += 500) {
          check(await sb.from(c).insert(rows.slice(i, i + 500).map(x => ({ id: x.id, data: x }))));
        }
      }
      check(await sb.from('settings').upsert({ id: 1, data: db.settings }));
    }),
    // Calls onChange (debounced) whenever anyone on the team changes data.
    watch(onChange) {
      let t;
      const ping = () => { clearTimeout(t); t = setTimeout(onChange, 400); };
      const ch = sb.channel('hakan-all');
      for (const table of [...COLS, 'settings']) ch.on('postgres_changes', { event: '*', schema: 'public', table }, ping);
      ch.subscribe(status => { if (status === 'SUBSCRIBED') onStatus('ok'); if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') onStatus('off'); });
      document.addEventListener('visibilitychange', () => { if (!document.hidden) ping(); });
      setInterval(() => { if (!document.hidden) ping(); }, 60000);
    },
  };
}

/* ---------- Local Node server ---------- */
function serverBackend(onStatus) {
  const run = tracked(onStatus);
  let version = 0;
  async function api(method, url, body) {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
    const data = await res.json();
    if (data.version) version = data.version;
    return data;
  }
  const strip = db => { const { version: _, ...rest } = db; return rest; };
  return {
    mode: 'server',
    needsLogin: false,
    async user() { return null; },
    load: () => run(async () => strip(await api('GET', 'api/state'))),
    put: (col, item) => run(() => api('PUT', `api/${col}/${encodeURIComponent(item.id)}`, item)),
    del: (col, id) => run(() => api('DELETE', `api/${col}/${encodeURIComponent(id)}`)),
    putSettings: settings => run(() => api('PUT', 'api/settings', settings)),
    importAll: db => run(() => api('POST', 'api/import', db)),
    watch(onChange) {
      const poll = async () => {
        if (document.hidden) return;
        try { const r = await api('GET', `api/state?since=${version}`); onStatus('ok'); if (!r.unchanged) onChange(); }
        catch { onStatus('off'); }
      };
      setInterval(poll, 8000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
    },
  };
}
