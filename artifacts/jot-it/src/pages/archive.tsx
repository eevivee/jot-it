import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { ChevronRight, Heart, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { Entry } from '@/lib/journal-types';
import { nowStamp, useJournal } from '@/lib/journal-store';
import { prettyDate, todayISO, weekKey } from '@/lib/journal-dates';
import { EmptyNote, MoodBadge } from '@/components/journal-bits';
import { EDIT_REQUEST_KEY, EntryActions } from './journal';

interface Week { key: string; week: number; monday: string; sunday: string; entries: Entry[] }
interface Month { key: string; label: string; weeks: Week[] }
interface Year { year: number; months: Month[] }

export default function ArchivePage() {
  const { entries, saveEntry } = useJournal();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [q, setQ] = useState('');
  const [favOnly, setFavOnly] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const searching = q.trim().length > 0 || favOnly;
  const now = weekKey(todayISO());

  const tree = useMemo<Year[]>(() => {
    const needle = q.trim().toLowerCase();
    const list = entries
      .filter((e) => !favOnly || e.favorite)
      .filter((e) => !needle || `${e.title}\n${e.body}`.toLowerCase().includes(needle))
      .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
    const years: Year[] = [];
    for (const e of list) {
      const k = weekKey(e.date);
      let y = years.find((x) => x.year === k.isoYear);
      if (!y) years.push((y = { year: k.isoYear, months: [] }));
      let m = y.months.find((x) => x.key === k.monthKey);
      if (!m) y.months.push((m = { key: k.monthKey, label: k.monthLabel, weeks: [] }));
      let w = m.weeks.find((x) => x.key === k.monday);
      if (!w) m.weeks.push((w = { key: k.monday, week: k.week, monday: k.monday, sunday: k.sunday, entries: [] }));
      w.entries.push(e);
    }
    return years;
  }, [entries, q, favOnly]);

  const update = (e: Entry, patch: Partial<Entry>, msg?: string) => {
    const r = saveEntry({ ...e, ...patch, updatedAt: nowStamp() });
    if (!r.ok) toast({ title: 'Not saved', description: r.error, variant: 'destructive' });
    else if (msg) toast({ title: msg });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-12 pt-8 md:px-10 md:pt-14">
      <h1 className="rise font-display text-5xl font-light">Archive</h1>
      <p className="rise mt-2 text-sm text-muted-foreground" style={{ animationDelay: '60ms' }}>
        {entries.length} {entries.length === 1 ? 'entry' : 'entries'}, folded by year, month and Monday-to-Sunday week.
      </p>

      <div className="sticky top-0 z-10 -mx-4 mt-6 bg-background/90 px-4 py-3 backdrop-blur md:mx-0 md:px-0">
        <div className="flex gap-2">
          <label className="flex flex-1 items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 focus-within:ring-2 focus-within:ring-ring">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles and words"
              className="w-full bg-transparent text-sm outline-none" data-testid="input-search" />
          </label>
          <button onClick={() => setFavOnly((f) => !f)} data-testid="button-filter-favorites" aria-pressed={favOnly}
            className={cn('flex items-center gap-1.5 rounded-full border px-4 text-sm transition-colors', favOnly ? 'border-transparent bg-primary text-primary-foreground' : 'border-border bg-card')}>
            <Heart className={cn('h-4 w-4', favOnly && 'fill-current')} /> <span className="hidden sm:inline">Favorites</span>
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {tree.length === 0 ? (
          entries.length === 0 ? (
            <EmptyNote title="Your archive begins with one entry">Everything you keep on the Journal page settles here, week by week.</EmptyNote>
          ) : (
            <EmptyNote title="Nothing matches">Try fewer words{favOnly ? ', or turn off the favorites filter' : ''}.</EmptyNote>
          )
        ) : (
          tree.map((y) => (
            <details key={`${y.year}-${searching}`} open={searching || y.year === now.isoYear} className="group/y" data-testid={`group-year-${y.year}`}>
              <summary className="flex items-center gap-2 py-2">
                <ChevronRight className="chev h-4 w-4 text-muted-foreground" />
                <span className="font-display text-3xl">{y.year}</span>
                <span className="ml-auto font-mono text-xs text-muted-foreground">{y.months.reduce((n, m) => n + m.weeks.reduce((k, w) => k + w.entries.length, 0), 0)}</span>
              </summary>
              <div className="space-y-2 border-l border-border pl-4 md:ml-2">
                {y.months.map((m) => (
                  <details key={`${m.key}-${searching}`} open={searching || m.key === now.monthKey} data-testid={`group-month-${m.key}`}>
                    <summary className="flex items-center gap-2 py-1.5">
                      <ChevronRight className="chev h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-display text-xl italic">{m.label}</span>
                    </summary>
                    <div className="space-y-2 pl-2">
                      {m.weeks.map((w) => (
                        <details key={`${w.key}-${searching}`} open={searching || w.key === now.monday} className="rounded-2xl bg-muted/50 px-3 py-1" data-testid={`group-week-${w.key}`}>
                          <summary className="flex items-center gap-2 py-2 text-sm">
                            <ChevronRight className="chev h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-mono text-xs text-primary">W{String(w.week).padStart(2, '0')}</span>
                            <span>{prettyDate(w.monday, 'MMM d')} – {prettyDate(w.sunday, 'MMM d')}</span>
                            {w.key === now.monday && <span className="rounded-full bg-secondary px-2 text-[10px] uppercase tracking-wider">this week</span>}
                            <span className="ml-auto font-mono text-xs text-muted-foreground">{w.entries.length}</span>
                          </summary>
                          <div className="space-y-2 pb-3">
                            {w.entries.map((e) => (
                              <article key={e.id} className="rounded-2xl border border-card-border bg-card p-4" data-testid={`card-archive-${e.id}`}>
                                <div className="flex items-start gap-2">
                                  <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(open === e.id ? null : e.id)} data-testid={`button-open-${e.id}`}>
                                    <p className="text-[11px] uppercase tracking-[.18em] text-muted-foreground">{prettyDate(e.date, 'EEE, MMM d')}</p>
                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                      <h3 className="font-display text-lg">{e.title || 'Untitled'}</h3>
                                      <MoodBadge mood={e.mood} />
                                    </div>
                                    <p className={cn('mt-1 whitespace-pre-line text-sm text-muted-foreground', open !== e.id && 'line-clamp-2')}>{e.body}</p>
                                  </button>
                                  <EntryActions e={e}
                                    onFav={() => update(e, { favorite: !e.favorite })}
                                    onEdit={() => { sessionStorage.setItem(EDIT_REQUEST_KEY, e.id); navigate('/'); }}
                                    onDelete={() => update(e, { deleted: true }, 'Entry deleted')} />
                                </div>
                              </article>
                            ))}
                          </div>
                        </details>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </details>
          ))
        )}
      </div>
    </div>
  );
}
