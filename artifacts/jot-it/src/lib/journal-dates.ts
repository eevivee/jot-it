import {
  addDays,
  endOfISOWeek,
  endOfQuarter,
  endOfYear,
  format,
  getISOWeek,
  getISOWeekYear,
  getQuarter,
  parseISO,
  startOfISOWeek,
  startOfQuarter,
  startOfYear,
} from 'date-fns';
import type { GoalPeriod } from './journal-types';

export const iso = (d: Date) => format(d, 'yyyy-MM-dd');
export const todayISO = () => iso(new Date());
export const parse = (s: string) => parseISO(s);
export const shiftISO = (s: string, n: number) => iso(addDays(parseISO(s), n));

export function periodRange(period: GoalPeriod, ref: string): { start: string; end: string } {
  const d = parseISO(ref);
  switch (period) {
    case 'day': {
      const t = iso(addDays(d, 1));
      return { start: t, end: t };
    }
    case 'week':
      return { start: iso(startOfISOWeek(d)), end: iso(endOfISOWeek(d)) };
    case 'quarter':
      return { start: iso(startOfQuarter(d)), end: iso(endOfQuarter(d)) };
    case 'year':
      return { start: iso(startOfYear(d)), end: iso(endOfYear(d)) };
  }
}

export function periodLabel(period: GoalPeriod, start: string, end: string): string {
  const s = parseISO(start);
  switch (period) {
    case 'day':
      return format(s, 'EEEE, MMM d');
    case 'week':
      return `Week ${getISOWeek(s)} · ${format(s, 'MMM d')} – ${format(parseISO(end), 'MMM d')}`;
    case 'quarter':
      return `Q${getQuarter(s)} ${format(s, 'yyyy')}`;
    case 'year':
      return format(s, 'yyyy');
  }
}

export function weekKey(date: string) {
  const d = parseISO(date);
  const monday = startOfISOWeek(d);
  return {
    isoYear: getISOWeekYear(d),
    week: getISOWeek(d),
    monday: iso(monday),
    sunday: iso(endOfISOWeek(d)),
    monthKey: format(monday, 'yyyy-MM'),
    monthLabel: format(monday, 'MMMM'),
  };
}

export const prettyDate = (s: string, f = 'EEEE, MMMM d') => format(parseISO(s), f);
