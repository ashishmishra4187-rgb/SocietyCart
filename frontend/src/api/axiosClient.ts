import axios from 'axios';

/**
 * Auth model: the backend sets an httpOnly, Secure, SameSite cookie on OTP verify, so no
 * credential ever lives in localStorage (XSS-safe). `withCredentials` sends it on every call.
 * If a backend still returns a bearer token, it is kept in memory only (lost on reload).
 */
let memoryToken: string | null = null;
export const setMemoryToken = (t: string | null): void => {
  memoryToken = t;
};

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: (() => void) | null): void => {
  onUnauthorized = fn;
};

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '',
  withCredentials: true,
  // Spring Security's double-submit CSRF: read the XSRF-TOKEN cookie, echo it in X-XSRF-TOKEN (same origin).
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

axiosClient.interceptors.request.use((config) => {
  if (memoryToken) config.headers.set('Authorization', `Bearer ${memoryToken}`);
  return config;
});

axiosClient.interceptors.response.use(
  (res) => res,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const url = error.config?.url ?? '';
      // A wrong OTP is a 401 too; only treat it as "session expired" for non-auth endpoints.
      if (!url.startsWith('/api/auth/')) onUnauthorized?.();
    }
    return Promise.reject(error);
  },
);

export default axiosClient;
