import { z } from 'zod';
import type { JournalRecord } from './journal-types';

// Google access tokens live only in memory, never in storage or the repository.
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const API = 'https://sheets.googleapis.com/v4/spreadsheets';
const TAB = 'Jot It';
const HEADERS = ['ID', 'Type', 'Date', 'Title / period', 'Text', 'Mood / outcome', 'Updated at', 'Record JSON'];
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timestamp = z.string().datetime();
const base = { id: z.string().min(1), updatedAt: timestamp };
const entry = z.object({
  ...base, date, title: z.string(), body: z.string(),
  mood: z.enum(['radiant', 'good', 'okay', 'low', 'rough']).nullable(),
  favorite: z.boolean(), deleted: z.boolean().optional(),
});
const goal = z.object({
  ...base, period: z.enum(['day', 'week', 'quarter', 'year']),
  start: date, end: date, text: z.string(), deleted: z.boolean().optional(),
});
const reflection = z.object({
  ...base, goalId: z.string(), outcome: z.enum(['yes', 'partly', 'not-yet']),
  body: z.string(), date,
});
const recordSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('entry'), payload: entry }),
  z.object({ ...base, type: z.literal('goal'), payload: goal }),
  z.object({ ...base, type: z.literal('reflection'), payload: reflection }),
  z.object({ ...base, type: z.literal('profile'), payload: z.object({ name: z.string() }) }),
]);

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}
interface GoogleIdentity {
  accounts: { oauth2: {
    initTokenClient: (options: {
      client_id: string;
      scope: string;
      callback: (response: TokenResponse) => void;
      error_callback: (error: { type: string }) => void;
    }) => { requestAccessToken: (options: { prompt: string }) => void };
    hasGrantedAllScopes: (response: TokenResponse, scope: string) => boolean;
    revoke: (token: string, callback: () => void) => void;
  } };
}
declare global { interface Window { google?: GoogleIdentity } }

let accessToken = '';
let expiresAt = 0;
let busy = false;
let libraryPromise: Promise<GoogleIdentity> | null = null;

function loadGoogle(): Promise<GoogleIdentity> {
  if (window.google?.accounts.oauth2) return Promise.resolve(window.google);
  if (libraryPromise) return libraryPromise;
  libraryPromise = new Promise<GoogleIdentity>((resolve, reject) => {
    const oldScript = document.getElementById('jot-google-identity');
    oldScript?.remove();
    const script = document.createElement('script');
    script.id = 'jot-google-identity';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    const timer = window.setTimeout(() => {
      script.remove();
      reject(new Error('Google could not load. Check your connection and try again.'));
    }, 20000);
    script.onload = () => {
      window.clearTimeout(timer);
      if (window.google?.accounts.oauth2) resolve(window.google);
      else reject(new Error('Google authorization is unavailable in this browser.'));
    };
    script.onerror = () => {
      window.clearTimeout(timer);
      script.remove();
      reject(new Error('Google could not load. Check your connection or content blocker.'));
    };
    document.head.append(script);
  }).catch((error: unknown) => {
    libraryPromise = null;
    throw error;
  });
  return libraryPromise;
}

// Preload the public library, so the later popup can open directly from a tap.
if (typeof window !== 'undefined') void loadGoogle().catch(() => undefined);

export function isGoogleConnected(): boolean {
  return Boolean(accessToken && Date.now() < expiresAt);
}

export async function connectGoogle(clientId: string): Promise<void> {
  const trimmed = clientId.trim();
  if (!/^[\w.-]+\.apps\.googleusercontent\.com$/.test(trimmed)) {
    throw new Error('Enter the public Google OAuth client ID from your Google Cloud project. Never enter a client secret.');
  }
  const google = await loadGoogle();
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error('Google sign-in timed out. Please try again.')), 120000);
    const fail = (message: string) => {
      window.clearTimeout(timeout);
      reject(new Error(message));
    };
    google.accounts.oauth2.initTokenClient({
      client_id: trimmed,
      scope: SCOPE,
      callback: (response) => {
        window.clearTimeout(timeout);
        if (response.error || !response.access_token) {
          fail(response.error_description || 'Google access was not granted. Your local journal is unchanged.');
          return;
        }
        if (!google.accounts.oauth2.hasGrantedAllScopes(response, SCOPE)) {
          fail('Please allow Google Sheets access to connect your journal.');
          return;
        }
        accessToken = response.access_token;
        expiresAt = Date.now() + Math.max(0, (Number(response.expires_in) || 3600) - 60) * 1000;
        resolve();
      },
      error_callback: (error) => fail(error.type === 'popup_closed'
        ? 'The Google window was closed. Nothing was changed.'
        : 'Google could not open its sign-in window. Allow popups, or open Jot It in a full browser tab.'),
    }).requestAccessToken({ prompt: 'select_account' });
  });
}

export function disconnectGoogle(): void {
  // This disconnects this browser session. Google account settings can revoke
  // the app's underlying grant. Local journal records intentionally remain.
  accessToken = '';
  expiresAt = 0;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!isGoogleConnected()) {
    disconnectGoogle();
    throw new Error('Connect Google again before syncing. Your journal is still saved on this device.');
  }
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw new Error('Google Sheets could not be reached. Nothing was removed from this device. Please retry sync when online.');
  }
  if (response.status === 401) {
    disconnectGoogle();
    throw new Error('Your Google connection expired. Reconnect and sync again.');
  }
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 403) throw new Error('Google denied access. Check that the Sheets API is enabled and you own or can edit this spreadsheet.');
    if (response.status === 404) throw new Error('That spreadsheet was not found for the connected Google account.');
    if (response.status === 429) throw new Error('Google’s request limit was reached. Wait a moment, then retry.');
    throw new Error(result.error?.message || 'Google Sheets returned an error. Your local entries remain safe.');
  }
  return result as T;
}

export function normalizeSpreadsheetId(value: string): string {
  const id = value.trim().match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)?.[1] || value.trim();
  if (!/^[a-zA-Z0-9_-]{15,}$/.test(id)) throw new Error('Enter a valid Google spreadsheet link or ID.');
  return id;
}

async function appendRows(id: string, rows: string[][]): Promise<void> {
  if (!rows.length) return;
  await request(`/${id}/values/${encodeURIComponent(`'${TAB}'!A:H`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: 'POST', body: JSON.stringify({ majorDimension: 'ROWS', values: rows }),
  });
}

export async function createJournalSheet(): Promise<string> {
  const result = await request<{ spreadsheetId: string }>('', {
    method: 'POST',
    body: JSON.stringify({
      properties: { title: 'Jot It — My private journal' },
      sheets: [{ properties: { title: TAB, gridProperties: { frozenRowCount: 1 } } }],
    }),
  });
  // Return the new ID even if a later sync must initialize its header.
  return result.spreadsheetId;
}

function parseRecord(value: unknown, source: string): JournalRecord {
  const result = recordSchema.safeParse(value);
  if (!result.success) throw new Error(`${source} contains an unreadable journal record. Sync stopped without overwriting your data.`);
  if (result.data.type !== 'profile' && result.data.id !== result.data.payload.id) {
    throw new Error(`${source} contains a mismatched record ID. Sync stopped safely.`);
  }
  return result.data as JournalRecord;
}

function rowFor(record: JournalRecord): string[] {
  const p = record.payload;
  const json = JSON.stringify(record);
  if (json.length > 45000) throw new Error('An entry is too long for one Google Sheets cell. Split it into shorter entries before syncing. Your local copy is unchanged.');
  return [
    record.id, record.type,
    'date' in p ? p.date : 'start' in p ? p.start : '',
    'title' in p ? p.title : 'period' in p ? `${p.period}: ${p.start} – ${p.end}` : '',
    'body' in p ? p.body : 'text' in p ? p.text : 'name' in p ? p.name : '',
    'mood' in p ? p.mood || '' : 'outcome' in p ? p.outcome : '',
    record.updatedAt, json,
  ];
}

/**
 * Append-only revisions: no range clears, row deletion, or spreadsheet replace.
 * The latest timestamp wins in the app; earlier versions stay in the sheet.
 * Use one device at a time and sync before and after editing across devices.
 */
export async function syncJournal(
  records: JournalRecord[],
  spreadsheetId: string,
): Promise<{ records: JournalRecord[]; spreadsheetId: string }> {
  if (busy) throw new Error('A sync is already running. Please wait for it to finish.');
  busy = true;
  try {
    const id = normalizeSpreadsheetId(spreadsheetId);
    const local = records.map((record) => parseRecord(record, 'Your local journal'));
    const metadata = await request<{ sheets?: { properties: { title: string } }[] }>(
      `/${id}?fields=sheets.properties.title`,
    );
    if (!metadata.sheets?.some((sheet) => sheet.properties.title === TAB)) {
      await request(`/${id}:batchUpdate`, {
        method: 'POST', body: JSON.stringify({ requests: [{ addSheet: { properties: { title: TAB } } }] }),
      });
    }
    const data = await request<{ values?: string[][] }>(
      `/${id}/values/${encodeURIComponent(`'${TAB}'!A:H`)}?valueRenderOption=UNFORMATTED_VALUE`,
    );
    const rows = data.values || [];
    if (rows.length && !HEADERS.every((header, i) => rows[0]?.[i] === header)) {
      throw new Error('The “Jot It” tab contains different data. Choose a dedicated journal spreadsheet; no existing cells were changed.');
    }
    const remote = rows.slice(1).filter((row) => row.some((cell) => cell !== '')).map((row, index) => {
      try {
        return parseRecord(JSON.parse(row[7] || ''), `Spreadsheet row ${index + 2}`);
      } catch {
        throw new Error(`Spreadsheet row ${index + 2} is unreadable. Sync stopped. Keep the “Record JSON” column intact.`);
      }
    });
    const revisions = new Set(remote.map((record) => JSON.stringify(record)));
    const pending = local.filter((record) => !revisions.has(JSON.stringify(record)));
    // Validate all rows before the first journal write.
    const newRows = pending.map(rowFor);
    if (!rows.length) await appendRows(id, [HEADERS]);
    for (let i = 0; i < newRows.length; i += 100) await appendRows(id, newRows.slice(i, i + 100));
    const merged = new Map<string, JournalRecord>();
    for (const record of [...remote, ...local]) {
      const existing = merged.get(record.id);
      if (!existing || existing.updatedAt < record.updatedAt) merged.set(record.id, record);
    }
    return { records: [...merged.values()], spreadsheetId: id };
  } finally {
    busy = false;
  }
}
