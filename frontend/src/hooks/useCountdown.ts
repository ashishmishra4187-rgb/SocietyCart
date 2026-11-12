import { useEffect, useState } from 'react';
import { FIVE_MINUTES, getTimeLeft, type TimeLeft } from '../lib/time';

/**
 * Live countdown. Ticks every 30s while far away and every second in the last five minutes,
 * so cards stay cheap but the final stretch is precise.
 */
export const useCountdown = (cutoffAt?: string | null): TimeLeft => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!cutoffAt) return;
    const target = new Date(cutoffAt).getTime();
    if (Number.isNaN(target)) return;

    let timer: number | undefined;
    const schedule = () => {
      const remaining = target - Date.now();
      if (remaining <= 0) return;
      timer = window.setTimeout(() => {
        setNow(Date.now());
        schedule();
      }, remaining > FIVE_MINUTES ? 30_000 : 1_000);
    };
    setNow(Date.now());
    schedule();
    return () => window.clearTimeout(timer);
  }, [cutoffAt]);

  return getTimeLeft(cutoffAt, now);
};
