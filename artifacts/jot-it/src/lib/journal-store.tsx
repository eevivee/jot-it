import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Entry, Goal, GoogleSettings, JournalRecord, Reflection } from './journal-types';

export const RECORDS_KEY = 'jotit.records.v1';
export const DRAFT_KEY = 'jotit.draft.v1';
export const GOOGLE_KEY = 'jotit.google.v1';
export const SYNC_META_KEY = 'jotit.syncmeta.v1';

export const uid = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
export const nowStamp = () => new Date().toISOString();

type LoadResult = { ok: true; records: JournalRecord[] } | { ok: false; raw: string; error: string };

function loadRecords(): LoadResult {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(RECORDS_KEY);
  } catch (e) {
    return { ok: false, raw: '', error: `This browser blocked local storage: ${(e as Error).message}` };
  }
  if (!raw) return { ok: true, records: [] };
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('Stored journal is not a list of records.');
    for (const r of parsed) {
      if (!r || typeof r.id !== 'string' || typeof r.type !== 'string' || typeof r.payload !== 'object')
        throw new Error('A stored record is missing its id, type or payload.');
    }
    return { ok: true, records: parsed };
  } catch (e) {
    return { ok: false, raw, error: (e as Error).message };
  }
}

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function writeJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function downloadJSON(filename: string, data: unknown) {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export type SaveResult = { ok: true } | { ok: false; error: string };

interface Store {
  loadError: { raw: string; error: string } | null;
  records: JournalRecord[];
  entries: Entry[];
  goals: Goal[];
  reflections: Reflection[];
  name: string;
  saveEntry: (e: Entry) => SaveResult;
  saveGoal: (g: Goal) => SaveResult;
  saveReflection: (r: Reflection) => SaveResult;
  saveName: (name: string) => SaveResult;
  replaceAll: (records: JournalRecord[]) => SaveResult;
  startFresh: () => SaveResult;
}

const Ctx = createContext<Store | null>(null);

export function JournalProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(loadRecords, []);
  const [loadError, setLoadError] = useState(initial.ok ? null : { raw: initial.raw, error: initial.error });
  const [records, setRecords] = useState<JournalRecord[]>(initial.ok ? initial.records : []);
  const ref = useRef(records);

  const commit = useCallback((next: JournalRecord[]): SaveResult => {
    if (loadError) return { ok: false, error: 'Your saved journal could not be read. Export it before changing anything.' };
    try {
      localStorage.setItem(RECORDS_KEY, JSON.stringify(next));
    } catch (e) {
      return { ok: false, error: `Not saved — this device refused to store it (${(e as Error).message}).` };
    }
    ref.current = next;
    setRecords(next);
    return { ok: true };
  }, [loadError]);

  const upsert = useCallback(
    (type: JournalRecord['type'], id: string, payload: JournalRecord['payload'], updatedAt: string) => {
      const cur = ref.current;
      const rec: JournalRecord = { id, type, payload, updatedAt };
      const idx = cur.findIndex((r) => r.id === id);
      const next = idx === -1 ? [...cur, rec] : cur.map((r, i) => (i === idx ? rec : r));
      return commit(next);
    },
    [commit],
  );

  const value = useMemo<Store>(() => {
    const live = <T,>(t: JournalRecord['type']) =>
      records.filter((r) => r.type === t).map((r) => r.payload as T);
    const profile = records.find((r) => r.id === 'profile');
    return {
      loadError,
      records,
      entries: live<Entry>('entry').filter((e) => !e.deleted),
      goals: live<Goal>('goal').filter((g) => !g.deleted),
      reflections: live<Reflection>('reflection'),
      name: (profile?.payload as { name?: string } | undefined)?.name?.trim() || 'Jot It',
      saveEntry: (e) => upsert('entry', e.id, e, e.updatedAt),
      saveGoal: (g) => upsert('goal', g.id, g, g.updatedAt),
      saveReflection: (r) => upsert('reflection', r.id, r, r.updatedAt),
      saveName: (name) => upsert('profile', 'profile', { name }, nowStamp()),
      replaceAll: (next) => {
        // A cloud request can finish after a new local edit or navigation.
        // Preserve those edits instead of replacing them with its old snapshot.
        const merged = new Map(next.map((record) => [record.id, record]));
        for (const record of ref.current) {
          const other = merged.get(record.id);
          if (!other || other.updatedAt < record.updatedAt) merged.set(record.id, record);
        }
        return commit([...merged.values()]);
      },
      startFresh: () => {
        try {
          localStorage.setItem(`${RECORDS_KEY}.unreadable-${Date.now()}`, loadError?.raw ?? '');
          localStorage.setItem(RECORDS_KEY, '[]');
        } catch (e) {
          return { ok: false, error: (e as Error).message };
        }
        ref.current = [];
        setRecords([]);
        setLoadError(null);
        return { ok: true };
      },
    };
  }, [records, loadError, upsert, commit]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useJournal() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useJournal outside provider');
  return c;
}

export function readGoogleSettings(): GoogleSettings {
  return readJSON<GoogleSettings>(GOOGLE_KEY, { clientId: '', spreadsheetId: '' });
}
