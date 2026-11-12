import { afterEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import axiosClient, { setMemoryToken, setUnauthorizedHandler } from './axiosClient';

const failWith = (status: number) => async (config: InternalAxiosRequestConfig) => {
  throw new AxiosError('x', 'ERR', config, {}, { status, statusText: '', headers: {}, config, data: {} });
};

afterEach(() => {
  setUnauthorizedHandler(null);
  setMemoryToken(null);
  axiosClient.defaults.adapter = undefined;
});

describe('axiosClient', () => {
  it('sends cookies and never puts a token in storage', () => {
    expect(axiosClient.defaults.withCredentials).toBe(true);
  });

  it('is configured for the backend double-submit CSRF cookie', () => {
    expect(axiosClient.defaults.xsrfCookieName).toBe('XSRF-TOKEN');
    expect(axiosClient.defaults.xsrfHeaderName).toBe('X-XSRF-TOKEN');
  });

  it('signs the user out on a 401 from a protected endpoint', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    axiosClient.defaults.adapter = failWith(401);
    await expect(axiosClient.get('/api/orders/me')).rejects.toBeTruthy();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('does not treat a wrong OTP (401 on /api/auth/*) as an expired session', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    axiosClient.defaults.adapter = failWith(401);
    await expect(axiosClient.post('/api/auth/verify', {})).rejects.toBeTruthy();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('adds a bearer header only when an in-memory token exists', async () => {
    let seen: string | undefined;
    axiosClient.defaults.adapter = async (config) => {
      seen = config.headers.get('Authorization') as string | undefined;
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
    };
    await axiosClient.get('/api/x');
    expect(seen).toBeUndefined();
    setMemoryToken('abc');
    await axiosClient.get('/api/x');
    expect(seen).toBe('Bearer abc');
  });
});
