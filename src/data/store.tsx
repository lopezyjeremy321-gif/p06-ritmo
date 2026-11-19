import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import type { RealtimeChannel, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { config } from '../lib/env';
import { secureStorage } from '../lib/secureStorage';
import { applyLocal, enqueue, LocalStore, mergeServer, stripUser, syncOnce, type Remote } from './sync';
import { emptyCache, TABLES, type Cache, type Entry, type Habit, type Op, type SyncState, type TableName } from './types';
import { toISODate } from './stats';
import { REDIRECT_BASE, buildRedirect, parseCallback, randomState } from '../auth/deeplink';

// La comprobacion de red apunta a NUESTRO servidor (no a un host de terceros): offline = no llego a Supabase.
if (config) {
  NetInfo.configure({
    reachabilityUrl: `${config.url}/auth/v1/health`,
    reachabilityMethod: 'GET',
    reachabilityHeaders: { apikey: config.anonKey },
    reachabilityTest: async (response) => response.status < 500,
    reachabilityShortTimeout: 5 * 1000,
    reachabilityLongTimeout: 30 * 1000,
    reachabilityRequestTimeout: 15 * 1000,
  });
}

const STATE_KEY = 'ritmo.auth_state';
const store = new LocalStore(AsyncStorage);

const toErr = (e: { code?: string; message: string; status?: number } | null) =>
  e ? { code: e.code, message: e.message, status: e.status } : null;

const remote: Remote = {
  async whoAmI() {
    const { data, error } = await supabase.auth.getUser(); // valida el token en el servidor
    if (error) {
      const status = (error as { status?: number }).status;
      if (status === 401 || status === 403 || /session|jwt|not authenticated/i.test(error.message)) return null;
      throw error; // red caida u otro fallo transitorio
    }
    return data.user?.id ?? null;
  },
  async upsert(table, row) {
    const { error } = await supabase.from(table).upsert(row, { onConflict: 'id' });
    return toErr(error as never);
  },
  async remove(table, id) {
    const { error } = await supabase.from(table).delete().eq('id', id);
    return toErr(error as never);
  },
  async fetchAll(table) {
    const { data, error } = await supabase.from(table).select('*').limit(1000);
    return { rows: (data ?? []) as Record<string, unknown>[], error: toErr(error as never) };
  },
};

const isOnline = async () => {
  const s = await NetInfo.fetch();
  return !!s.isConnected && s.isInternetReachable !== false;
};

export interface Notice { id: number; text: string; undo?: () => void }

interface Ctx {
  ready: boolean;
  user: { id: string; email: string } | null;
  cache: Cache;
  sync: SyncState;
  pending: number;
  lastSyncAt: number | null;
  notice: Notice | null;
  dismissNotice: () => void;
  signIn(email: string, password: string): Promise<string | null>;
  signUp(email: string, password: string): Promise<string | null>;
  resetPassword(email: string): Promise<string | null>;
  signOut(): Promise<void>;
  handleLink(url: string): Promise<string | null>;
  saveHabit(h: Partial<Habit> & { name: string }): string;
  deleteHabit(id: string): void;
  toggleLog(habitId: string, date: string): void;
  saveEntry(e: Partial<Entry> & Pick<Entry, 'kind' | 'amount_cents' | 'category'>): string;
  deleteEntry(id: string): void;
  syncNow(): void;
  deleteMyData(): Promise<string | null>;
}

const C = createContext<Ctx | null>(null);
export const useData = () => {
  const v = useContext(C);
  if (!v) throw new Error('useData fuera de DataProvider');
  return v;
};

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [cache, setCache] = useState<Cache>(emptyCache());
  const [sync, setSync] = useState<SyncState>('offline');
  const [pending, setPending] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const cacheRef = useRef(cache);
  const outboxRef = useRef<Op[]>([]);
  const uidRef = useRef<string | null>(null);
  const busy = useRef(false);
  const again = useRef(false);
  const channels = useRef<RealtimeChannel[]>([]);
  const noticeId = useRef(0);

  const say = useCallback((text: string, undo?: () => void) => setNotice({ id: ++noticeId.current, text, undo }), []);

  const commit = useCallback(async (next: Cache, ops: Op[]) => {
    cacheRef.current = next; outboxRef.current = ops;
    setCache(next); setPending(ops.length);
    const uid = uidRef.current;
    if (uid) { await store.saveCache(uid, next); await store.saveOutbox(uid, ops); }
  }, []);

  const runSync = useCallback(async () => {
    if (!uidRef.current) return;
    if (busy.current) { again.current = true; return; }
    busy.current = true;
    setSync('syncing');
    try {
      const r = await syncOnce({ store, remote, isOnline });
      if (r.status === 'offline') setSync('offline');
      else if (r.status === 'error') setSync('error');
      else if (r.status === 'signed_out') {
        await supabase.auth.signOut({ scope: 'local' });
      } else {
        if (r.cache) { cacheRef.current = r.cache; setCache(r.cache); }
        outboxRef.current = await store.loadOutbox(r.uid!);
        setPending(outboxRef.current.length);
        setLastSyncAt(Date.now());
        setSync('synced');
        if (r.rejected.length) say(`El servidor no aceptó ${r.rejected.length} cambio(s) y se descartaron.`);
      }
    } finally {
      busy.current = false;
      if (again.current) { again.current = false; void runSync(); }
    }
  }, [say]);

  // ---- realtime (filtrado por usuario; RLS ademas lo limita en el servidor)
  const stopRealtime = useCallback(() => {
    channels.current.forEach((ch) => void supabase.removeChannel(ch));
    channels.current = [];
  }, []);
  const startRealtime = useCallback((uid: string) => {
    stopRealtime();
    channels.current = TABLES.map((t) =>
      supabase.channel(`ritmo-${t}-${uid}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: t, filter: `user_id=eq.${uid}` }, (p) => {
          if (uidRef.current !== uid) return;
          const row = (p.eventType === 'DELETE' ? p.old : p.new) as Record<string, unknown>;
          const id = row?.id as string | undefined;
          if (!id || outboxRef.current.some((o) => o.table === t && o.rowId === id)) return; // lo local pendiente manda
          const next = p.eventType === 'DELETE'
            ? applyLocal(cacheRef.current, t, 'delete', { id })
            : applyLocal(cacheRef.current, t, 'upsert', stripUser(row) as { id: string });
          void commit(next, outboxRef.current);
        })
        .subscribe(),
    );
  }, [commit, stopRealtime]);

  // ---- ciclo de sesion
  const attach = useCallback(async (s: Session | null) => {
    setSession(s);
    if (!s) {
      stopRealtime();
      uidRef.current = null; outboxRef.current = [];
      await store.wipeAll();
      await secureStorage.removeItem(STATE_KEY);
      cacheRef.current = emptyCache();
      setCache(emptyCache()); setPending(0); setLastSyncAt(null); setSync('offline');
      return;
    }
    if (uidRef.current === s.user.id) return;
    const owner = await store.owner();
    if (owner && owner !== s.user.id) await store.wipeAll(); // otra cuenta en este dispositivo
    await store.setOwner(s.user.id);
    uidRef.current = s.user.id;
    cacheRef.current = await store.loadCache(s.user.id);
    outboxRef.current = await store.loadOutbox(s.user.id);
    setCache(cacheRef.current); setPending(outboxRef.current.length);
    startRealtime(s.user.id);
    void runSync();
  }, [runSync, startRealtime, stopRealtime]);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      await attach(data.session);
      setReady(true);
    }).catch(() => setReady(true));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { void attach(s); });
    const net = NetInfo.addEventListener((st) => {
      if (st.isConnected && st.isInternetReachable !== false) void runSync(); else setSync('offline');
    });
    return () => { alive = false; sub.subscription.unsubscribe(); net(); stopRealtime(); };
  }, [attach, runSync, stopRealtime]);

  // ---- escritura offline-first
  const write = useCallback((table: TableName, type: 'upsert' | 'delete', id: string, payload?: Record<string, unknown>) => {
    const op: Op = { opId: Crypto.randomUUID(), table, type, rowId: id, payload, queuedAt: Date.now(), attempts: 0 };
    const next = applyLocal(cacheRef.current, table, type, { id, ...(payload ?? {}), updated_at: new Date().toISOString() });
    void commit(next, enqueue(outboxRef.current, op)).then(() => runSync());
  }, [commit, runSync]);

  const saveHabit: Ctx['saveHabit'] = (h) => {
    const id = h.id ?? Crypto.randomUUID();
    write('p06_habits', 'upsert', id, { name: h.name.trim(), icon: h.icon ?? 'check-circle', weekly_target: h.weekly_target ?? 7, archived: h.archived ?? false });
    say(h.id ? 'Hábito guardado' : 'Hábito creado');
    return id;
  };
  const deleteHabit: Ctx['deleteHabit'] = (id) => {
    const h = cacheRef.current.p06_habits.find((x) => x.id === id);
    const logs = cacheRef.current.p06_habit_logs.filter((l) => l.habit_id === id);
    write('p06_habits', 'delete', id);
    say('Hábito eliminado', h ? () => {
      write('p06_habits', 'upsert', id, { name: h.name, icon: h.icon, weekly_target: h.weekly_target, archived: h.archived });
      logs.forEach((l) => write('p06_habit_logs', 'upsert', l.id, { habit_id: id, log_date: l.log_date }));
    } : undefined);
  };
  const toggleLog: Ctx['toggleLog'] = (habitId, date) => {
    const ex = cacheRef.current.p06_habit_logs.find((l) => l.habit_id === habitId && l.log_date === date);
    if (ex) write('p06_habit_logs', 'delete', ex.id);
    else write('p06_habit_logs', 'upsert', Crypto.randomUUID(), { habit_id: habitId, log_date: date });
  };
  const saveEntry: Ctx['saveEntry'] = (e) => {
    const id = e.id ?? Crypto.randomUUID();
    write('p06_entries', 'upsert', id, {
      kind: e.kind, amount_cents: e.amount_cents, category: e.category.trim(), note: (e.note ?? '').trim(), occurred_on: e.occurred_on ?? toISODate(new Date()),
    });
    say(e.id ? 'Movimiento guardado' : 'Movimiento creado');
    return id;
  };
  const deleteEntry: Ctx['deleteEntry'] = (id) => {
    const e = cacheRef.current.p06_entries.find((x) => x.id === id);
    write('p06_entries', 'delete', id);
    say('Movimiento eliminado', e ? () => write('p06_entries', 'upsert', id, { kind: e.kind, amount_cents: e.amount_cents, category: e.category, note: e.note, occurred_on: e.occurred_on }) : undefined);
  };

  // ---- auth
  const authError = (m: string) => {
    if (/invalid login/i.test(m)) return 'Correo o contraseña incorrectos. Revísalos e inténtalo de nuevo.';
    if (/already registered|already been registered/i.test(m)) return 'Ese correo ya tiene cuenta. Usa «Iniciar sesión».';
    if (/password/i.test(m)) return 'La contraseña debe tener 8+ caracteres con mayúscula, minúscula y número.';
    if (/fetch|network/i.test(m)) return 'Sin conexión. Conéctate para iniciar sesión.';
    if (/rate|too many/i.test(m)) return 'Demasiados intentos. Espera un minuto y vuelve a probar.';
    if (/confirm/i.test(m)) return 'Confirma tu correo desde el enlace que te enviamos.';
    return 'No se pudo completar la acción. Inténtalo de nuevo.';
  };
  const newState = async () => {
    const st = randomState(Crypto.getRandomBytes(16));
    await secureStorage.setItem(STATE_KEY, st);
    return st;
  };
  const signIn: Ctx['signIn'] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error ? authError(error.message) : null;
  };
  const signUp: Ctx['signUp'] = async (email, password) => {
    const st = await newState();
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: buildRedirect(st) } });
    if (error) return authError(error.message);
    if (!data.session) return 'Te enviamos un correo: abre el enlace para confirmar tu cuenta.';
    return null;
  };
  const resetPassword: Ctx['resetPassword'] = async (email) => {
    const st = await newState();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: buildRedirect(st) });
    return error ? authError(error.message) : null;
  };
  const handleLink: Ctx['handleLink'] = async (url) => {
    if (!url.startsWith(REDIRECT_BASE)) return null; // otros enlaces no son nuestros
    const expected = await secureStorage.getItem(STATE_KEY);
    const r = parseCallback(url, expected);
    await secureStorage.removeItem(STATE_KEY); // un solo uso
    if (!r.ok) return 'Enlace no válido o caducado. Pide uno nuevo desde la app.';
    const { error } = await supabase.auth.exchangeCodeForSession(r.code);
    return error ? 'No se pudo abrir la sesión con ese enlace. Pide uno nuevo.' : null;
  };
  const signOut: Ctx['signOut'] = async () => {
    stopRealtime();
    const { error } = await supabase.auth.signOut({ scope: 'local' }); // cierra solo este dispositivo (no las demas sesiones)
    if (error) await supabase.auth.signOut({ scope: 'local' }); // sin red: igual se cierra aqui
    await attach(null);
  };
  const deleteMyData: Ctx['deleteMyData'] = async () => {
    const { error } = await supabase.rpc('p06_delete_my_data');
    if (error) return 'No se pudieron borrar tus datos (¿sin conexión?). Inténtalo de nuevo.';
    outboxRef.current = [];
    await commit(emptyCache(), []);
    return null;
  };

  const value = useMemo<Ctx>(() => ({
    ready, user: session ? { id: session.user.id, email: session.user.email ?? '' } : null,
    cache, sync, pending, lastSyncAt, notice, dismissNotice: () => setNotice(null),
    signIn, signUp, resetPassword, signOut, handleLink, saveHabit, deleteHabit, toggleLog, saveEntry, deleteEntry,
    syncNow: () => void runSync(), deleteMyData,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [ready, session, cache, sync, pending, lastSyncAt, notice, runSync]);

  return <C.Provider value={value}>{children}</C.Provider>;
}

export { mergeServer };
