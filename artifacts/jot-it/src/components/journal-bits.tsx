import { useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { Goal, Mood, Reflection } from '@/lib/journal-types';
import { nowStamp, uid, useJournal } from '@/lib/journal-store';
import { periodLabel, prettyDate, shiftISO } from '@/lib/journal-dates';

export const MOODS: { id: Mood; emoji: string; label: string; tint: string }[] = [
  { id: 'radiant', emoji: '\u{1F929}', label: 'Radiant', tint: 'bg-[#b6dfd2]' },
  { id: 'good', emoji: '\u{1F642}', label: 'Good', tint: 'bg-[#cfe6dc]' },
  { id: 'okay', emoji: '\u{1F610}', label: 'Okay', tint: 'bg-[#e7dde0]' },
  { id: 'low', emoji: '\u{1F614}', label: 'Low', tint: 'bg-[#c9d8ea]' },
  { id: 'rough', emoji: '\u{1F623}', label: 'Rough', tint: 'bg-[#94b5d8]/70' },
];
export const moodOf = (m: Mood | null) => MOODS.find((x) => x.id === m);

export function MoodBar({ value, onChange }: { value: Mood | null; onChange: (m: Mood | null) => void }) {
  return (
    <div role="radiogroup" aria-label="Mood" className="grid grid-cols-5 gap-1.5">
      {MOODS.map((m) => {
        const on = value === m.id;
        return (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={on}
            data-testid={`button-mood-${m.id}`}
            onClick={() => onChange(on ? null : m.id)}
            className={cn(
              'group flex flex-col items-center gap-1 rounded-2xl py-2.5 transition-all duration-300 active:scale-95',
              on ? `${m.tint} shadow-[0_6px_18px_-10px_hsl(343_13%_30%/.6)]` : 'hover:bg-muted',
            )}
          >
            <span className={cn('text-2xl transition-transform duration-300', on ? 'scale-110' : 'grayscale-[.5] opacity-70 group-hover:opacity-100 group-hover:grayscale-0')}>
              {m.emoji}
            </span>
            <span className={cn('text-[11px] tracking-wide', on ? 'text-foreground font-medium' : 'text-muted-foreground')}>{m.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function MoodBadge({ mood }: { mood: Mood | null }) {
  const m = moodOf(mood);
  if (!m) return null;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]', m.tint)} data-testid="badge-mood">
      <span>{m.emoji}</span>
      {m.label}
    </span>
  );
}

export function ConfirmDelete({ trigger, what, onConfirm }: { trigger: ReactNode; what: string; onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent className="rounded-3xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-2xl font-normal">Let this one go?</AlertDialogTitle>
          <AlertDialogDescription>
            “{what}” will be removed from your journal. If you sync with Google Sheets, the deletion syncs too.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-full" data-testid="button-cancel-delete">Keep it</AlertDialogCancel>
          <AlertDialogAction className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={onConfirm} data-testid="button-confirm-delete">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function dueGoals(goals: Goal[], reflections: Reflection[], date: string) {
  const done = new Set(reflections.map((r) => r.goalId));
  const order = { day: 0, week: 1, quarter: 2, year: 3 };
  return goals
    .filter((g) => g.text.trim() && !done.has(g.id))
    .filter((g) => (g.period === 'day' ? g.start <= date : g.end < date))
    .sort((a, b) => order[a.period] - order[b.period] || a.start.localeCompare(b.start));
}

export function checkinPrompt(g: Goal, date: string) {
  if (g.period === 'day') {
    if (g.start === date) return { lead: 'Yesterday you planned', ask: 'How did it go?' };
    if (g.start === shiftISO(date, -1)) return { lead: 'For yesterday you planned', ask: 'How did it go?' };
    return { lead: `For ${prettyDate(g.start, 'EEEE, MMM d')} you planned`, ask: 'How did it go?' };
  }
  const span = periodLabel(g.period, g.start, g.end);
  const noun = g.period === 'week' ? 'that week' : g.period === 'quarter' ? 'that quarter' : 'that year';
  return { lead: `${span} is behind you. You set out to`, ask: `Did you get there in ${noun} — and how?` };
}

const OUTCOMES: { id: Reflection['outcome']; label: string; cls: string }[] = [
  { id: 'yes', label: 'Yes', cls: 'bg-secondary text-secondary-foreground' },
  { id: 'partly', label: 'Partly', cls: 'bg-muted text-foreground' },
  { id: 'not-yet', label: 'Not yet', cls: 'bg-accent text-accent-foreground' },
];
export const outcomeLabel = (o: Reflection['outcome']) => OUTCOMES.find((x) => x.id === o)!;

export function CheckinCard({ goal, date, index = 0 }: { goal: Goal; date: string; index?: number }) {
  const { saveReflection } = useJournal();
  const { toast } = useToast();
  const [outcome, setOutcome] = useState<Reflection['outcome'] | null>(null);
  const [body, setBody] = useState('');
  const p = checkinPrompt(goal, date);
  const save = () => {
    if (!outcome) return;
    const r = saveReflection({ id: uid(), goalId: goal.id, outcome, body: body.trim(), date, updatedAt: nowStamp() });
    if (r.ok) toast({ title: 'Reflection kept', description: 'It lives in Reflections now.' });
    else toast({ title: 'Not saved', description: r.error, variant: 'destructive' });
  };
  return (
    <article
      className="rise relative overflow-hidden rounded-3xl border border-[#94b5d8]/50 bg-[linear-gradient(140deg,#eef3fa,#f7f2f3)] p-5"
      style={{ animationDelay: `${index * 80}ms` }}
      data-testid={`card-checkin-${goal.id}`}
    >
      <p className="text-[11px] uppercase tracking-[.22em] text-accent-foreground/70">Check-in · {goal.period}</p>
      <p className="mt-2 text-sm text-muted-foreground">{p.lead}</p>
      <p className="font-display mt-1 whitespace-pre-line text-xl leading-snug">{goal.text}</p>
      <p className="mt-3 text-sm">{p.ask}</p>
      <div className="mt-3 flex gap-2">
        {OUTCOMES.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setOutcome(o.id)}
            data-testid={`button-outcome-${o.id}-${goal.id}`}
            className={cn(
              'flex items-center gap-1 rounded-full border px-4 py-1.5 text-sm transition-all active:scale-95',
              outcome === o.id ? `${o.cls} border-transparent` : 'border-border bg-card/70 hover:bg-card',
            )}
          >
            {outcome === o.id && <Check className="h-3.5 w-3.5" />}
            {o.label}
          </button>
        ))}
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        placeholder={goal.period === 'day' ? 'A line or two, if you like…' : 'What helped, what got in the way…'}
        className="mt-3 w-full resize-none rounded-2xl border border-border bg-card/80 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        data-testid={`input-reflection-${goal.id}`}
      />
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          disabled={!outcome}
          onClick={save}
          className="rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0"
          data-testid={`button-save-reflection-${goal.id}`}
        >
          Save reflection
        </button>
      </div>
    </article>
  );
}

export function EmptyNote({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-primary/30 px-6 py-10 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
        <span className="font-display text-xl italic text-secondary-foreground">j</span>
      </div>
      <p className="font-display text-xl">{title}</p>
      <div className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{children}</div>
    </div>
  );
}
