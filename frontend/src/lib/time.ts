export const FIVE_MINUTES = 5 * 60 * 1000;

export interface TimeLeft {
  ms: number;
  ended: boolean;
  /** Under an hour left — shown in amber. */
  urgent: boolean;
  /** "2h 5m", "14m", "3m 07s" (seconds only inside the last 5 minutes) or "ended". */
  label: string;
}

export const getTimeLeft = (cutoffAt: string | undefined | null, now: number): TimeLeft => {
  const target = cutoffAt ? new Date(cutoffAt).getTime() : NaN;
  if (Number.isNaN(target)) return { ms: 0, ended: true, urgent: false, label: 'ended' };
  const ms = Math.max(0, target - now);
  if (ms <= 0) return { ms: 0, ended: true, urgent: true, label: 'ended' };

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  let label: string;
  if (ms <= FIVE_MINUTES) {
    label = `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  } else if (hours > 0) {
    label = `${hours}h ${minutes}m`;
  } else {
    label = `${minutes}m`;
  }
  return { ms, ended: false, urgent: ms < 60 * 60 * 1000, label };
};

export const closesLabel = (t: TimeLeft): string => (t.ended ? 'Closed' : `Closes in ${t.label}`);

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO instant to the value format of <input type="datetime-local">, in the viewer's local time. */
export const toDatetimeLocal = (iso: string | undefined | null): string => {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
