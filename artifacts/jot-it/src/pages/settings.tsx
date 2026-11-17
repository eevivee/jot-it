import { useState } from 'react';
import { AlertTriangle, CloudOff, Cloud, Download, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { GOOGLE_KEY, downloadJSON, readGoogleSettings, useJournal, writeJSON } from '@/lib/journal-store';
import { connectGoogle, createJournalSheet, disconnectGoogle } from '@/lib/google-sheets';
import { useAutoSync } from '@/lib/auto-sync';
import { todayISO } from '@/lib/journal-dates';

const sheetIdFrom = (v: string) => v.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1] ?? v.trim();

export default function SettingsPage() {
  const { name, saveName, records } = useJournal();
  const cloud = useAutoSync();
  const { connected } = cloud;
  const { toast } = useToast();
  const [nameDraft, setNameDraft] = useState(name);
  const initial = readGoogleSettings();
  const [clientId, setClientId] = useState(initial.clientId);
  const [sheet, setSheet] = useState(initial.spreadsheetId);
  const [busy, setBusy] = useState<null | 'connect' | 'create' | 'sync'>(null);
  const [error, setError] = useState<string | null>(null);

  const sheetId = sheetIdFrom(sheet);

  const persistSettings = (patch: { clientId?: string; spreadsheetId?: string }) => {
    const ok = writeJSON(GOOGLE_KEY, { clientId: clientId.trim(), spreadsheetId: sheetId, ...patch });
    cloud.refresh();
    if (!ok) toast({ title: 'Settings not stored', description: 'This browser refused to save them.', variant: 'destructive' });
    return ok;
  };

  const run = async (kind: 'connect' | 'create' | 'sync', fn: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (e) {
      const msg = (e as Error)?.message || String(e);
      setError(msg);
      cloud.refresh();
    } finally {
      setBusy(null);
    }
  };

  const connect = () => run('connect', async () => {
    if (!clientId.trim()) throw new Error('Paste your OAuth client ID first.');
    if (!persistSettings({})) throw new Error('Save your Google settings before connecting.');
    await connectGoogle(clientId.trim());
    cloud.refresh();
    toast({ title: 'Google connected', description: 'Your saved journal will sync automatically when a sheet is selected.' });
  });

  const create = () => run('create', async () => {
    const id = await createJournalSheet();
    setSheet(id);
    persistSettings({ spreadsheetId: id });
    toast({ title: 'Your sheet is ready', description: 'Your saved journal will sync automatically.' });
  });

  const sync = () => run('sync', async () => {
    if (!sheetId) throw new Error('Add a spreadsheet ID or create a sheet first.');
    if (!persistSettings({})) throw new Error('This browser could not store your Sheet settings.');
    await cloud.syncNow();
    toast({ title: 'Synced', description: 'Your saved journal is in step with your sheet.' });
  });

  const disconnect = () => {
    disconnectGoogle();
    cloud.refresh();
    toast({ title: 'Disconnected from Google', description: 'Your entries stay on this device.' });
  };

  const status = { icon: connected ? Cloud : CloudOff, label: cloud.label, tone: connected ? 'bg-secondary' : 'bg-muted' };
  const working = !!busy || cloud.syncing;
  const displayError = error || cloud.error;

  const field = 'w-full rounded-2xl border border-input bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring';
  const btn = 'inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm transition-all active:scale-[.97] disabled:opacity-40';

  return (
    <div className="mx-auto max-w-2xl space-y-10 px-4 pb-12 pt-8 md:px-10 md:pt-14">
      <div>
        <h1 className="rise font-display text-5xl font-light">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">Yours to arrange.</p>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-2xl">What should I call you?</h2>
        <div className="flex gap-2">
          <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} className={field} maxLength={40} data-testid="input-name" />
          <button className={cn(btn, 'bg-primary text-primary-foreground')} disabled={!nameDraft.trim() || nameDraft.trim() === name}
            data-testid="button-save-name"
            onClick={() => { const r = saveName(nameDraft.trim()); toast(r.ok ? { title: `Hello, ${nameDraft.trim()}.` } : { title: 'Not saved', description: r.error, variant: 'destructive' }); }}>
            Save
          </button>
        </div>
      </section>

      <section className="space-y-4 rounded-[2rem] border border-card-border bg-card p-5 md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-2xl">Google Sheets backup</h2>
          <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs', status.tone)} data-testid="status-sync">
            <status.icon className="h-3.5 w-3.5" /> {status.label}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Saved entries, goals and reflections sync automatically while Google is connected and you’re online. A backup stays on this device. Offline changes retry when you reconnect.
        </p>
        <details className="rounded-2xl bg-muted/60 px-4 py-3 text-sm">
          <summary className="font-medium">Before connecting: one-time Google Cloud setup</summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>In Google Cloud Console, create a project and enable the Google Sheets API.</li>
            <li>Configure the OAuth consent screen and add your Google account as a test user.</li>
            <li>Create an OAuth client ID (Web application) and add this site’s address <span className="font-mono text-xs">{window.location.origin}</span> as an authorized JavaScript origin.</li>
            <li>Paste the client ID below. It is public, not a secret.</li>
          </ol>
        </details>

        <label className="block space-y-1.5">
          <span className="text-xs uppercase tracking-[.18em] text-muted-foreground">OAuth client ID</span>
          <input value={clientId} disabled={working} onChange={(e) => { disconnectGoogle(); cloud.refresh(); setClientId(e.target.value); }} onBlur={() => persistSettings({})}
            placeholder="1234…apps.googleusercontent.com" className={cn(field, 'font-mono text-xs')} data-testid="input-client-id" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs uppercase tracking-[.18em] text-muted-foreground">Spreadsheet ID or URL</span>
          <input value={sheet} disabled={working} onChange={(e) => setSheet(e.target.value)} onBlur={() => persistSettings({})}
            placeholder="Paste a sheet link, or create one below" className={cn(field, 'font-mono text-xs')} data-testid="input-sheet-id" />
        </label>
        {sheetId && (
          <a href={`https://docs.google.com/spreadsheets/d/${sheetId}`} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline" data-testid="link-sheet">
            Open my sheet <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}

        {displayError && (
          <div className="flex gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm" data-testid="text-sync-error">
            <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p>{displayError}</p>
              <p className="mt-1 text-muted-foreground">Your saved changes remain on this device. Automatic retries run while connected. If your Google session expired, reconnect.</p>
              <button className="mt-2 text-primary underline" disabled={working} onClick={connect} data-testid="button-reconnect">Reconnect Google</button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          {connected ? (
            <button className={cn(btn, 'border border-border')} disabled={working} onClick={disconnect} data-testid="button-disconnect">Disconnect</button>
          ) : (
            <button className={cn(btn, 'bg-primary text-primary-foreground')} onClick={connect} disabled={working} data-testid="button-connect">
              {busy === 'connect' && <Loader2 className="h-4 w-4 animate-spin" />} Connect Google
            </button>
          )}
          <button className={cn(btn, 'bg-accent text-accent-foreground')} onClick={create} disabled={!connected || working} data-testid="button-create-sheet">
            {busy === 'create' && <Loader2 className="h-4 w-4 animate-spin" />} Create my sheet
          </button>
          <button className={cn(btn, 'bg-secondary text-secondary-foreground')} onClick={sync} disabled={!connected || !sheetId || working} data-testid="button-sync">
            {cloud.syncing || busy === 'sync' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Sync now
          </button>
        </div>
        <p className="text-xs text-muted-foreground">Tap Save on an entry to queue automatic syncing; unfinished drafts stay on this device. Keep Jot It open until “Saved to Google Sheets” appears. Sync now is available as a manual retry.</p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-2xl">Take it with you</h2>
        <p className="text-sm text-muted-foreground">Download every record — entries, intentions, reflections and deletions — as JSON.</p>
        <button className={cn(btn, 'border border-border bg-card')} data-testid="button-export"
          onClick={() => downloadJSON(`jot-it-${todayISO()}.json`, { exportedAt: new Date().toISOString(), records })}>
          <Download className="h-4 w-4" /> Export {records.length} records
        </button>
      </section>

      <section className="rounded-3xl bg-[#94b5d8]/20 p-5 text-sm">
        <p className="font-medium">On a shared device?</p>
        <p className="mt-1 text-muted-foreground">
          Your journal is stored unencrypted in this browser. Anyone using this browser profile can read it. Disconnecting Google does not erase anything here — clear this site’s data in your browser settings to remove it.
        </p>
      </section>
    </div>
  );
}
