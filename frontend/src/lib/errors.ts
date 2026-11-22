import axios from 'axios';

export const getStatus = (err: unknown): number | undefined =>
  axios.isAxiosError(err) ? err.response?.status : undefined;

/** Pulls a human message from an API error without resorting to `any`. */
export const getErrorMessage = (err: unknown, fallback: string): string => {
  if (axios.isAxiosError(err)) {
    const data: unknown = err.response?.data;
    if (data && typeof data === 'object') {
      if ('message' in data) {
        const m = (data as { message?: unknown }).message;
        if (typeof m === 'string' && m.trim()) return m.trim();
      }
      if ('error' in data) {
        const e = (data as { error?: unknown }).error;
        if (typeof e === 'string' && e.trim()) return e.trim();
      }
    }
    if (typeof data === 'string' && data.trim()) return data.trim();
    if (!err.response) return 'Network problem. Check your connection and try again.';
    if (err.response.status === 403) return 'Access denied / CORS origin blocked.';
    if (err.response.status === 429) return 'Too many attempts. Please wait a bit and try again.';
  }
  return fallback;
};
