import { type ReactNode } from 'react';
import { Link, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import { Archive, BookOpen, Download, Settings2, Sparkles } from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import JournalPage from '@/pages/journal';
import ArchivePage from '@/pages/archive';
import ReflectionsPage from '@/pages/reflections';
import SettingsPage from '@/pages/settings';
import { JournalProvider, downloadJSON, useJournal } from '@/lib/journal-store';
import { dueGoals } from '@/components/journal-bits';
import { todayISO } from '@/lib/journal-dates';
import { cn } from '@/lib/utils';
import { AutoSyncProvider, useAutoSync } from '@/lib/auto-sync';

const NAV = [
  { href: '/', label: 'Journal', icon: BookOpen },
  { href: '/archive', label: 'Archive', icon: Archive },
  { href: '/reflections', label: 'Reflections', icon: Sparkles },
  { href: '/settings', label: 'Settings', icon: Settings2 },
];

function Shell({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  const { goals, reflections } = useJournal();
  const due = dueGoals(goals, reflections, todayISO()).length;
  return (
    <div className="paper-grain min-h-[100dvh] bg-background md:pl-24">
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:inset-y-0 md:left-0 md:right-auto md:w-24 md:border-r md:border-t-0 md:pb-0">
        <div className="hidden pt-8 text-center md:block">
          <span className="font-display text-2xl italic text-primary">Jot</span>
          <span className="font-display block text-xs uppercase tracking-[.35em] text-muted-foreground">it</span>
        </div>
        <ul className="grid grid-cols-4 md:mt-10 md:grid-cols-1 md:gap-2">
          {NAV.map((n) => {
            const on = n.href === '/' ? loc === '/' : loc.startsWith(n.href);
            return (
              <li key={n.href}>
                <Link href={n.href} data-testid={`link-${n.label.toLowerCase()}`}
                  className={cn('relative flex flex-col items-center gap-1 py-2.5 text-[11px] transition-colors', on ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}>
                  <span className={cn('relative rounded-full px-4 py-1 transition-all duration-300', on && 'bg-secondary')}>
                    <n.icon className="h-5 w-5" strokeWidth={1.6} />
                    {n.href === '/reflections' && due > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[9px] text-primary-foreground" data-testid="badge-due">{due}</span>
                    )}
                  </span>
                  {n.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <main className="pb-24 md:pb-0">{children}</main>
    </div>
  );
}

function Recovery() {
  const { loadError, startFresh } = useJournal();
  if (!loadError) return null;
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background p-6">
      <div className="max-w-md rounded-[2rem] border border-card-border bg-card p-7">
        <h1 className="font-display text-3xl">Your journal needs a moment</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The saved journal on this device couldn’t be read ({loadError.error}). Nothing has been changed or erased. Download the raw data first so nothing is lost.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button className="rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground" data-testid="button-export-raw"
            onClick={() => downloadJSON('jot-it-recovery.json', loadError.raw)}>
            <Download className="mr-1 inline h-4 w-4" /> Download raw data
          </button>
          <button className="rounded-full border border-border px-5 py-2.5 text-sm" data-testid="button-start-fresh"
            onClick={() => { if (window.confirm('Start a new empty journal? The unreadable data is kept aside in this browser, but you should download it first.')) startFresh(); }}>
            Start fresh
          </button>
        </div>
      </div>
    </div>
  );
}

function Routes() {
  const { loadError } = useJournal();
  const cloud = useAutoSync();
  const [location] = useLocation();
  if (loadError) return <Recovery />;
  return (
    <Shell>
      <div role="status" aria-live="polite" className="mx-auto max-w-5xl px-4 pt-4 text-xs text-muted-foreground md:px-10" data-testid="global-sync-status">
        <Link href="/settings" className="underline-offset-4 hover:underline">{cloud.label}</Link>
      </div>
      <ErrorBoundary resetKey={location}>
        <Switch>
          <Route path="/" component={JournalPage} />
          <Route path="/archive" component={ArchivePage} />
          <Route path="/reflections" component={ReflectionsPage} />
          <Route path="/settings" component={SettingsPage} />
          <Route component={NotFound} />
        </Switch>
      </ErrorBoundary>
    </Shell>
  );
}

function App() {
  return (
    <TooltipProvider>
      <JournalProvider>
        <AutoSyncProvider>
        <WouterRouter hook={useHashLocation}>
          <Routes />
        </WouterRouter>
        </AutoSyncProvider>
      </JournalProvider>
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
