export type Mood = 'radiant' | 'good' | 'okay' | 'low' | 'rough';
export type GoalPeriod = 'day' | 'week' | 'quarter' | 'year';
export interface Entry {
  id: string;
  date: string;
  title: string;
  body: string;
  mood: Mood | null;
  favorite: boolean;
  updatedAt: string;
  deleted?: boolean;
}
export interface Goal {
  id: string;
  period: GoalPeriod;
  start: string;
  end: string;
  text: string;
  updatedAt: string;
  deleted?: boolean;
}
export interface Reflection {
  id: string;
  goalId: string;
  outcome: 'yes' | 'partly' | 'not-yet';
  body: string;
  date: string;
  updatedAt: string;
}
export interface JournalRecord {
  id: string;
  type: 'entry' | 'goal' | 'reflection' | 'profile';
  payload: Entry | Goal | Reflection | { name: string };
  updatedAt: string;
}
export interface GoogleSettings {
  clientId: string;
  spreadsheetId: string;
}
