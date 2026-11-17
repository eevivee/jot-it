import { useMemo } from 'react';
import { useJournal } from '@/lib/journal-store';
import { periodLabel, prettyDate, todayISO } from '@/lib/journal-dates';
import { CheckinCard, EmptyNote, dueGoals, outcomeLabel } from '@/components/journal-bits';
import { cn } from '@/lib/utils';

export default function ReflectionsPage() {
  const { goals, reflections } = useJournal();
  const today = todayISO();
  const due = useMemo(() => dueGoals(goals, reflections, today), [goals, reflections, today]);
  const history = useMemo(
    () => [...reflections].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt)),
    [reflections],
  );
  const reflected = new Set(reflections.map((r) => r.goalId));
  const ahead = goals
    .filter((g) => g.text.trim() && !reflected.has(g.id) && !due.includes(g))
    .sort((a, b) => a.end.localeCompare(b.end));
  const goalById = new Map(goals.map((g) => [g.id, g]));

  return (
    <div className="mx-auto max-w-3xl px-4 pb-12 pt-8 md:px-10 md:pt-14">
      <h1 className="rise font-display text-5xl font-light">Reflections</h1>
      <p className="rise mt-2 max-w-md text-sm text-muted-foreground" style={{ animationDelay: '60ms' }}>
        Gentle accountability. Each intention gets asked about once, after its time is up — and your answer stays here.
      </p>

      <section className="mt-8 space-y-3">
        <h2 className="font-display text-2xl">Waiting for you</h2>
        {due.length === 0 ? (
          <p className="rounded-2xl bg-secondary/40 px-5 py-4 text-sm" data-testid="text-no-due">All caught up. Nothing is asking for an answer today.</p>
        ) : (
          <div className="grid gap-3">{due.map((g, i) => <CheckinCard key={g.id} goal={g} date={today} index={i} />)}</div>
        )}
      </section>

      {ahead.length > 0 && (
        <section className="mt-10 space-y-2">
          <h2 className="font-display text-2xl">Still in motion</h2>
          {ahead.map((g) => (
            <div key={g.id} className="flex gap-4 rounded-2xl border border-card-border bg-card px-5 py-3" data-testid={`row-ahead-${g.id}`}>
              <p className="w-28 shrink-0 text-[11px] uppercase tracking-[.16em] text-muted-foreground">{periodLabel(g.period, g.start, g.end)}</p>
              <p className="font-display whitespace-pre-line">{g.text}</p>
            </div>
          ))}
        </section>
      )}

      <section className="mt-10 space-y-3">
        <h2 className="font-display text-2xl">What you said</h2>
        {history.length === 0 ? (
          <EmptyNote title="No reflections yet">
            Set an intention for tomorrow on the Journal page. When tomorrow comes, Jot It will ask how it went.
          </EmptyNote>
        ) : (
          <ol className="relative space-y-4 border-l border-primary/30 pl-6">
            {history.map((r) => {
              const g = goalById.get(r.goalId);
              const o = outcomeLabel(r.outcome);
              return (
                <li key={r.id} className="relative" data-testid={`item-reflection-${r.id}`}>
                  <span className="absolute -left-[29px] top-2 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
                  <p className="text-[11px] uppercase tracking-[.18em] text-muted-foreground">
                    {prettyDate(r.date, 'MMM d, yyyy')}{g ? ` · ${periodLabel(g.period, g.start, g.end)}` : ''}
                  </p>
                  <p className="font-display mt-1 whitespace-pre-line text-lg">{g ? g.text : 'A goal that has since been removed'}</p>
                  <div className="mt-2 flex items-start gap-2">
                    <span className={cn('shrink-0 rounded-full px-3 py-0.5 text-xs', o.cls)}>{o.label}</span>
                    {r.body && <p className="whitespace-pre-line text-sm text-muted-foreground">{r.body}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
