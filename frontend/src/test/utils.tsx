import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../context/AuthContext';
import type { PoolProgress, UserSession } from '../types';

export const SESSION: UserSession = { residentId: 'res-1', societyId: 'soc-1', flatNumber: 'B-1204' };

export const makePool = (over: Partial<PoolProgress> = {}): PoolProgress => ({
  poolWindowId: 'pool-123',
  productSku: 'SKU-MILK-A2',
  productName: 'Organic Desi Cow A2 Milk 1L',
  basePrice: 200,
  currentUnitPrice: 144,
  savingsPercent: 28,
  aggregateQuantity: 24,
  participantCount: 14,
  tiers: [
    { minQuantity: 10, discountPercent: 10 },
    { minQuantity: 20, discountPercent: 28 },
    { minQuantity: 30, discountPercent: 35 },
  ],
  status: 'OPEN',
  cutoffAt: new Date(Date.now() + 3 * 3600_000).toISOString(),
  ...over,
});

interface Options {
  route?: string;
  path?: string;
  session?: UserSession | null;
}

export const renderApp = (ui: React.ReactElement, { route = '/', path = '*', session = SESSION }: Options = {}) => {
  if (session) window.localStorage.setItem('sc_session', JSON.stringify(session));
  else window.localStorage.removeItem('sc_session');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>
        <AuthProvider>
          <Routes>
            <Route path={path} element={ui} />
            <Route path="*" element={<div>other-route</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...utils, client };
};
