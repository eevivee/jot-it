import { useEffect, useMemo, useRef, useState } from 'react';
import { Heart, Pencil, RotateCcw, Trash2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { Entry, Goal, GoalPeriod, Mood } from '@/lib/journal-types';
import { DRAFT_KEY, nowStamp, readJSON, uid, useJournal, writeJSON } from '@/lib/journal-store';
import { periodLabel, periodRange, prettyDate, todayISO } from '@/lib/journal-dates';
import { CheckinCard, ConfirmDelete, EmptyNote, MoodBadge, MoodBar, dueGoals } from '@/components/journal-bits';

interface Draft {
  editingId: string | null;
  date: string;
  title: string;
  body: string;
  mood: Mood | null;
  savedAt: string;
}
export const EDIT_REQUEST_KEY = 'jotit.editRequest';

const GREETINGS = [
  (n: string) => `Hello again, ${n}.`,
  (n: string) => `Pull up a chair, ${n}.`,
  (n: string) => `What’s on your mind, ${n}?`,
  (n: string) => `There you are, ${n}.`,
  (n: string) => `Take a breath, ${n}.`,
  (n: string) => `Let’s write it down, ${n}.`,
  (n: string) => `A quiet page for you, ${n}.`,
];
function greeting(name: string) {
  const h = new Date().getHours();
  const day = Math.floor(Date.now() / 864e5);
  const timed = h < 5 ? `Up late, ${name}?` : h < 12 ? `Good morning, ${name}.` : h < 18 ? `Good afternoon, ${name}.` : `Good evening, ${name}.`;
  return day % 3 === 0 ? timed : GREETINGS[day % GREETINGS.length](name);
}

const blank = (date: string): Draft => ({ editingId: null, date, title: '', body: '', mood: null, savedAt: '' });

export default function JournalPage() {
  const { entries, goals, reflections, name, saveEntry } = useJournal();
  const { toast } = useToast();
  const today = todayISO();
  const [draft, setDraft] = useState<Draft>(() => blank(today));
  const [draftStorageError, setDraftStorageError] = useState(false);
  const [pending, setPending] = useState<Draft | null>(() => {
    const d = readJSON<Draft | null>(DRAFT_KEY, null);
    return d && (d.title.trim() || d.body.trim()) ? d : null;
  });
  const dirty = useRef(false);
  const titleRef = useRef<HTMLInputElement>(null);

  // Handle "edit" handoff from Archive
  useEffect(() => {
    const id = sessionStorage.getItem(EDIT_REQUEST_KEY);
    if (!id) return;
    sessionStorage.removeItem(EDIT_REQUEST_KEY);
    const e = entries.find((x) => x.id === id);
    if (e) {
      setDraft({ editingId: e.id, date: e.date, title: e.title, body: e.body, mood: e.mood, savedAt: '' });
      setTimeout(() => titleRef.current?.focus(), 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const edit = (patch: Partial<Draft>) => {
    if (pending && !window.confirm('An older unsaved draft is waiting. Replace it with this new draft? Choose Cancel to recover it first.')) return;
    dirty.current = true;
    if (pending) setPending(null);
    const next = { ...draft, ...patch, savedAt: nowStamp() };
    // Write before navigation can unmount the composer; don't debounce away
    // the last words when someone switches to Settings or Archive.
    setDraftStorageError(!writeJSON(DRAFT_KEY, next));
    setDraft(next);
  };

  const dayEntries = useMemo(
    () => entries.filter((e) => e.date === draft.date).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [entries, draft.date],
  );
  const due = useMemo(() => dueGoals(goals, reflections, draft.date), [goals, reflections, draft.date]);

  const save = () => {
    if (!draft.title.trim() && !draft.body.trim()) {
      toast({ title: 'Nothing to keep yet', description: 'Write a title or a few words first.' });
      return;
    }
    const existing = draft.editingId ? entries.find((e) => e.id === draft.editingId) : undefined;
    const e: Entry = {
      id: existing?.id ?? uid(),
      date: draft.date,
      title: draft.title.trim(),
      body: draft.body,
      mood: draft.mood,
      favorite: existing?.favorite ?? false,
      updatedAt: nowStamp(),
    };
    const r = saveEntry(e);
    if (!r.ok) {
      toast({ title: 'Not saved', description: `${r.error} Your words are still here. Keep this page open until you can save or copy them.`, variant: 'destructive' });
      return;
    }
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* draft cleanup is best-effort */ }
    dirty.current = false;
    setDraft(blank(draft.date));
    toast({ title: existing ? 'Entry updated' : 'Saved to this device', description: prettyDate(e.date) });
  };

  const startEdit = (e: Entry) => {
    if ((dirty.current || pending) && !window.confirm('Replace the current unsaved draft with this entry?')) return;
    dirty.current = true;
    const next = { editingId: e.id, date: e.date, title: e.title, body: e.body, mood: e.mood, savedAt: nowStamp() };
    setPending(null);
    setDraftStorageError(!writeJSON(DRAFT_KEY, next));
    setDraft(next);
    titleRef.current?.focus();
    window.scrollTo({ top: titleRef.current ? titleRef.current.getBoundingClientRect().top + window.scrollY - 120 : 0, behavior: 'smooth' });
  };

  const toggleFav = (e: Entry) => {
    const r = saveEntry({ ...e, favorite: !e.favorite, updatedAt: nowStamp() });
    if (!r.ok) toast({ title: 'Not saved', description: r.error, variant: 'destructive' });
  };
  const remove = (e: Entry) => {
    const r = saveEntry({ ...e, deleted: true, updatedAt: nowStamp() });
    if (!r.ok) toast({ title: 'Not deleted', description: r.error, variant: 'destructive' });
    else {
      if (draft.editingId === e.id) setDraft(blank(draft.date));
      toast({ title: 'Entry deleted' });
    }
  };

  return (
    <div className="pb-10">
      <header className="relative overflow-hidden bg-sidebar px-5 pb-24 pt-8 text-sidebar-foreground md:rounded-b-[2.5rem] md:px-10 md:pt-12">
        <div aria-hidden className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[#b6dfd2]/35" />
        <div aria-hidden className="absolute -bottom-24 right-24 h-56 w-56 rounded-full bg-[#94b5d8]/40" />
        <div className="relative mx-auto max-w-5xl">
          <p className="rise text-[11px] uppercase tracking-[.3em] opacity-80" data-testid="text-today">{prettyDate(today, 'EEEE · MMMM d, yyyy')}</p>
          <h1 className="rise font-display mt-3 max-w-xl text-4xl font-light leading-[1.05] md:text-6xl" style={{ animationDelay: '80ms' }} data-testid="text-greeting">
            {greeting(name)}
          </h1>
        </div>
      </header>

      <div className="relative mx-auto -mt-16 max-w-5xl space-y-8 px-4 md:px-10">
        <GoalsBoard today={today} />

        {due.length > 0 && (
          <section className="space-y-3" data-testid="section-checkins">
            <h2 className="font-display px-1 text-2xl">Before you write</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {due.map((g, i) => <CheckinCard key={g.id} goal={g} date={draft.date} index={i} />)}
            </div>
          </section>
        )}

        {pending && (
          <div className="rise flex flex-wrap items-center gap-3 rounded-2xl border border-[#b6dfd2] bg-secondary/50 px-4 py-3 text-sm" data-testid="banner-draft">
            <RotateCcw className="h-4 w-4 text-secondary-foreground" />
            <span className="flex-1">
              An unsaved draft from {pending.savedAt ? prettyDate(pending.savedAt.slice(0, 10), 'MMM d') : 'earlier'} is waiting{pending.title ? ` — “${pending.title}”` : ''}.
            </span>
            <button className="rounded-full bg-primary px-4 py-1.5 text-primary-foreground" data-testid="button-recover-draft"
              onClick={() => { dirty.current = true; setDraft({ ...pending }); setPending(null); }}>Recover</button>
            <button className="rounded-full px-3 py-1.5 hover:bg-card" data-testid="button-discard-draft"
              onClick={() => { localStorage.removeItem(DRAFT_KEY); setPending(null); }}>Discard</button>
          </div>
        )}

        <section className="rounded-[2rem] border border-card-border bg-card p-5 shadow-[0_30px_60px_-40px_hsl(343_20%_30%/.45)] md:p-8" data-testid="section-composer">
          {draftStorageError && (
            <p role="alert" className="mb-4 rounded-xl border border-destructive/40 p-3 text-sm text-destructive">
              This browser could not save your recovery draft. Keep this page open and copy your words somewhere safe before leaving.
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] uppercase tracking-[.25em] text-muted-foreground">
              {draft.editingId ? 'Editing entry' : 'New entry'}
            </p>
            <label className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-sm">
              <span className="text-muted-foreground">Dated</span>
              <input
                type="date"
                value={draft.date}
                max="9999-12-31"
                onChange={(e) => e.target.value && edit({ date: e.target.value })}
                className="bg-transparent font-mono text-xs outline-none"
                data-testid="input-entry-date"
              />
            </label>
          </div>
          <input
            ref={titleRef}
            value={draft.title}
            onChange={(e) => edit({ title: e.target.value })}
            placeholder="Give today a title"
            className="font-display mt-5 w-full bg-transparent text-3xl font-light outline-none placeholder:text-muted-foreground/50 md:text-4xl"
            data-testid="input-entry-title"
          />
          <div className="mt-5">
            <p className="mb-2 text-xs text-muted-foreground">How are you, honestly?</p>
            <MoodBar value={draft.mood} onChange={(m) => edit({ mood: m })} />
          </div>
          <textarea
            value={draft.body}
            onChange={(e) => edit({ body: e.target.value })}
            placeholder="Start anywhere. This is your space."
            rows={9}
            className="ruled mt-6 w-full resize-y bg-transparent text-[17px] outline-none placeholder:text-muted-foreground/60"
            data-testid="input-entry-body"
          />
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            {draft.editingId && (
              <button className="flex items-center gap-1 rounded-full px-4 py-2 text-sm hover:bg-muted" data-testid="button-cancel-edit"
                onClick={() => { dirty.current = false; localStorage.removeItem(DRAFT_KEY); setDraft(blank(draft.date)); }}>
                <X className="h-4 w-4" /> Cancel edit
              </button>
            )}
            <button
              onClick={save}
              className="rounded-full bg-primary px-7 py-2.5 text-sm font-medium text-primary-foreground shadow-[0_10px_24px_-12px_hsl(343_13%_30%)] transition-all hover:-translate-y-0.5 active:translate-y-0"
              data-testid="button-save-entry"
            >
              {draft.editingId ? 'Save changes' : 'Keep this entry'}
            </button>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-display px-1 text-2xl">
            {draft.date === today ? 'Today’s pages' : prettyDate(draft.date)}
          </h2>
          {dayEntries.length === 0 ? (
            <EmptyNote title="This page is still blank">
              Whatever you keep for {draft.date === today ? 'today' : prettyDate(draft.date, 'MMMM d')} will gather here.
            </EmptyNote>
          ) : (
            dayEntries.map((e) => (
              <article key={e.id} className="rise group rounded-3xl border border-card-border bg-card p-5" data-testid={`card-entry-${e.id}`}>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-xl">{e.title || 'Untitled'}</h3>
                      <MoodBadge mood={e.mood} />
                    </div>
                    <p className="mt-2 line-clamp-4 whitespace-pre-line text-sm text-muted-foreground">{e.body}</p>
                  </div>
                  <EntryActions e={e} onEdit={() => startEdit(e)} onFav={() => toggleFav(e)} onDelete={() => remove(e)} />
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </div>
  );
}

export function EntryActions({ e, onEdit, onFav, onDelete }: { e: Entry; onEdit: () => void; onFav: () => void; onDelete: () => void }) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <button aria-label={e.favorite ? 'Unfavorite' : 'Favorite'} onClick={onFav} data-testid={`button-favorite-${e.id}`}
        className="rounded-full p-2 transition-transform hover:bg-muted active:scale-90">
        <Heart className={cn('h-4 w-4 transition-colors', e.favorite ? 'fill-primary text-primary' : 'text-muted-foreground')} />
      </button>
      <button aria-label="Edit" onClick={onEdit} data-testid={`button-edit-${e.id}`} className="rounded-full p-2 text-muted-foreground hover:bg-muted">
        <Pencil className="h-4 w-4" />
      </button>
      <ConfirmDelete
        what={e.title || prettyDate(e.date)}
        onConfirm={onDelete}
        trigger={
          <button aria-label="Delete" data-testid={`button-delete-${e.id}`} className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </button>
        }
      />
    </div>
  );
}

const SLOTS: { period: GoalPeriod; label: string; tone: string }[] = [
  { period: 'day', label: 'Tomorrow', tone: 'bg-[#b6dfd2]' },
  { period: 'week', label: 'This week', tone: 'bg-[#94b5d8]' },
  { period: 'quarter', label: 'This quarter', tone: 'bg-[#d9c6cb]' },
  { period: 'year', label: 'This year', tone: 'bg-[#9c8188]' },
];

function GoalsBoard({ today }: { today: string }) {
  return (
    <section className="rise grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" style={{ animationDelay: '160ms' }} data-testid="section-goals">
      {SLOTS.map((s) => <GoalSlot key={s.period} slot={s} today={today} />)}
    </section>
  );
}

function GoalSlot({ slot, today }: { slot: (typeof SLOTS)[number]; today: string }) {
  const { goals, saveGoal } = useJournal();
  const { toast } = useToast();
  const range = periodRange(slot.period, today);
  const goal = goals.find((g) => g.period === slot.period && g.start === range.start);
  const [text, setText] = useState(goal?.text ?? '');
  const saved = goal?.text ?? '';
  useEffect(() => { setText(saved); }, [saved]);
  const changed = text.trim() !== saved.trim();

  const commit = () => {
    const g: Goal = { id: goal?.id ?? uid(), period: slot.period, start: range.start, end: range.end, text: text.trim(), updatedAt: nowStamp() };
    const r = saveGoal(g);
    if (r.ok) toast({ title: 'Intention set', description: periodLabel(slot.period, range.start, range.end) });
    else toast({ title: 'Not saved', description: r.error, variant: 'destructive' });
  };

  return (
    <div className="relative rounded-3xl border border-card-border bg-card/95 p-4 shadow-[0_20px_40px_-34px_hsl(343_20%_30%/.6)] backdrop-blur" data-testid={`card-goal-${slot.period}`}>
      <div className="flex items-center gap-2">
        <span className={cn('h-2.5 w-2.5 rounded-full', slot.tone)} />
        <p className="text-[11px] uppercase tracking-[.2em] text-muted-foreground">{slot.label}</p>
      </div>
      <p className="mt-0.5 text-[11px] text-muted-foreground/80">{periodLabel(slot.period, range.start, range.end)}</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder={slot.period === 'day' ? 'One small thing per line…' : 'What would make this count?'}
        className="font-display mt-2 w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none placeholder:font-sans placeholder:text-sm placeholder:text-muted-foreground/60"
        data-testid={`input-goal-${slot.period}`}
      />
      <div className={cn('flex justify-end gap-1 transition-all duration-300', changed ? 'opacity-100' : 'pointer-events-none h-0 opacity-0')}>
        <button onMouseDown={(e) => e.preventDefault()} onClick={() => setText(saved)} className="rounded-full px-3 py-1 text-xs hover:bg-muted" data-testid={`button-revert-goal-${slot.period}`}>Revert</button>
        <button onMouseDown={(e) => e.preventDefault()} onClick={commit} className="rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground" data-testid={`button-save-goal-${slot.period}`}>Save</button>
      </div>
    </div>
  );
}
