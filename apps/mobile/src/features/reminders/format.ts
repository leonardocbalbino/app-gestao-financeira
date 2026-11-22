import { addDays, formatRelativeDay, toISODate } from '@app/shared';

/** Data local (YYYY-MM-DD) + hora "HH:MM" → ISO com fuso do aparelho. */
export function toDueIso(date: string, time: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const [hh, mm] = time.split(':').map(Number) as [number, number];
  return new Date(y, m - 1, d, hh, mm, 0, 0).toISOString();
}

export function fromDueIso(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: toISODate(d),
    time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
  };
}

/** "Hoje · 21 nov às 09:00" */
export function formatDue(iso: string, now: Date = new Date()): string {
  const { date, time } = fromDueIso(iso);
  return `${formatRelativeDay(date, now)} às ${time}`;
}

export const OFFSET_OPTIONS = [
  { value: 0, label: 'Na hora' },
  { value: 60, label: '1 h antes' },
  { value: 1440, label: '1 dia antes' },
  { value: 4320, label: '3 dias antes' },
  { value: 10080, label: '1 semana antes' },
];

export const TIME_OPTIONS = ['08:00', '09:00', '12:00', '18:00', '20:00'];

export function quickDates(today = toISODate(new Date())) {
  return [
    { label: 'Hoje', value: today },
    { label: 'Amanhã', value: addDays(today, 1) },
    { label: 'Em 1 semana', value: addDays(today, 7) },
  ];
}
