import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { isGoogleConnected, normalizeSpreadsheetId, syncJournal } from './google-sheets';
import { readGoogleSettings, readJSON, SYNC_META_KEY, useJournal, writeJSON } from './journal-store';

interface SyncMeta { at: string; spreadsheetId: string; versions: Record<string, string> }
function validSheetId(value: string) {
  try { return normalizeSpreadsheetId(value); } catch { return ''; }
}
const Context = createContext<{
  connected: boolean; syncing: boolean; error: string | null;
  label: string; refresh: () => void; syncNow: () => Promise<void>;
} | null>(null);

export function AutoSyncProvider({ children }: { children: ReactNode }) {
  const journal = useJournal();
  const latest = useRef(journal);
  latest.current = journal;
  const [settings, setSettings] = useState(readGoogleSettings);
  const [connected, setConnected] = useState(isGoogleConnected);
  const [online, setOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<SyncMeta | null>(() => readJSON(SYNC_META_KEY, null));
  const flight = useRef<Promise<void> | null>(null);

  const refresh = useCallback(() => {
    const next = readGoogleSettings();
    setSettings((old) => old.clientId === next.clientId && old.spreadsheetId === next.spreadsheetId ? old : next);
    setConnected(isGoogleConnected());
    setOnline(navigator.onLine);
  }, []);

  const syncNow = useCallback((): Promise<void> => {
    if (flight.current) return flight.current;
    const task = async () => {
      const target = readGoogleSettings();
      setError(null);
      try {
        const sheetId = validSheetId(target.spreadsheetId);
        if (latest.current.loadError) throw new Error('Recover your saved journal before syncing.');
        if (!isGoogleConnected()) throw new Error('Reconnect Google in Settings to sync your saved changes.');
        if (!navigator.onLine) throw new Error('You’re offline. Your changes are saved on this device.');
        if (!sheetId) throw new Error('Add a spreadsheet in Settings first.');
        setSyncing(true);
        const result = await syncJournal(latest.current.records, sheetId);
        const current = readGoogleSettings();
        // Never apply an old request to a newly selected Sheet or Google connection.
        if (current.clientId !== target.clientId || current.spreadsheetId !== target.spreadsheetId || !isGoogleConnected()) return;
        const saved = latest.current.replaceAll(result.records);
        if (!saved.ok) throw new Error(`Google synced, but the device backup could not be saved: ${saved.error}`);
        const receipt: SyncMeta = {
          at: new Date().toISOString(), spreadsheetId: result.spreadsheetId,
          versions: Object.fromEntries(result.records.map((r) => [r.id, r.updatedAt])),
        };
        if (!writeJSON(SYNC_META_KEY, receipt)) throw new Error('Google synced, but the device could not store the sync receipt. Retrying is safe.');
        setMeta(receipt);
      } catch (e) {
        setError((e as Error).message || 'Could not sync. Your changes remain on this device.');
        throw e;
      } finally {
        setSyncing(false);
        refresh();
      }
    };
    flight.current = task().finally(() => { flight.current = null; });
    return flight.current;
  }, [refresh]);

  const sheetId = validSheetId(settings.spreadsheetId);
  const pending = meta?.spreadsheetId !== sheetId ||
    journal.records.some((r) => meta.versions[r.id] !== r.updatedAt);
  const ready = connected && online && !!sheetId && !journal.loadError;

  useEffect(() => {
    if (ready) void syncNow().catch(() => {});
  }, [ready, settings.clientId, sheetId, syncNow]);

  useEffect(() => {
    // Debounce consecutive goal edits; an in-flight save is never cancelled.
    if (!ready || !pending || syncing || error) return;
    const timer = window.setTimeout(() => { void syncNow().catch(() => {}); }, 1200);
    return () => window.clearTimeout(timer);
  }, [ready, pending, syncing, error, journal.records, syncNow]);

  useEffect(() => {
    const reconnect = () => {
      refresh();
      if (isGoogleConnected() && navigator.onLine && readGoogleSettings().spreadsheetId)
        void syncNow().catch(() => {});
    };
    const visible = () => { if (document.visibilityState === 'visible') reconnect(); };
    const timer = window.setInterval(() => {
      refresh();
      // Retry failures and fetch edits from another device while the app is open.
      if (document.visibilityState === 'visible' && isGoogleConnected() && navigator.onLine && readGoogleSettings().spreadsheetId)
        void syncNow().catch(() => {});
    }, 30000);
    window.addEventListener('online', reconnect);
    window.addEventListener('offline', refresh);
    window.addEventListener('focus', reconnect);
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('online', reconnect);
      window.removeEventListener('offline', refresh);
      window.removeEventListener('focus', reconnect);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [refresh, syncNow]);

  const label = syncing ? 'Syncing with Google Sheets…'
    : !connected ? 'Saved on this device · connect Google to sync'
    : !sheetId ? 'Saved on this device · choose a Google Sheet'
    : !online ? 'Saved on this device · offline, sync pending'
    : error ? 'Saved on this device · sync needs attention'
    : pending ? 'Saved on this device · sync pending'
    : 'Saved to Google Sheets';
  return <Context.Provider value={{ connected, syncing, error, label, refresh, syncNow }}>{children}</Context.Provider>;
}

export function useAutoSync() {
  const value = useContext(Context);
  if (!value) throw new Error('useAutoSync outside provider');
  return value;
}
