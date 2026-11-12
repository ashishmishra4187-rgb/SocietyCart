import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { RequireAdmin, RequireAuth } from './RouteGuards';
import { SESSION } from '../test/utils';

const tree = (route: string) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<div>login-page</div>} />
          <Route path="/s/:id" element={<div>dashboard</div>} />
          <Route element={<RequireAuth />}>
            <Route path="/orders" element={<div>orders-page</div>} />
            <Route element={<RequireAdmin />}>
              <Route path="/admin" element={<div>admin-page</div>} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );

describe('route guards', () => {
  it('redirects signed-out visitors to login', () => {
    window.localStorage.clear();
    tree('/orders');
    expect(screen.getByText('login-page')).toBeInTheDocument();
  });
  it('lets residents in but keeps them out of admin', () => {
    window.localStorage.setItem('sc_session', JSON.stringify(SESSION));
    tree('/orders');
    expect(screen.getByText('orders-page')).toBeInTheDocument();
  });
  it('bounces a resident from admin back to their dashboard', () => {
    window.localStorage.setItem('sc_session', JSON.stringify(SESSION));
    tree('/admin');
    expect(screen.getByText('dashboard')).toBeInTheDocument();
  });
  it('admits a society admin', () => {
    window.localStorage.setItem('sc_session', JSON.stringify({ ...SESSION, role: 'SOCIETY_ADMIN' }));
    tree('/admin');
    expect(screen.getByText('admin-page')).toBeInTheDocument();
  });
});

describe('platform admins', () => {
  it('are admitted to the admin area too', () => {
    window.localStorage.setItem('sc_session', JSON.stringify({ ...SESSION, role: 'PLATFORM_ADMIN' }));
    tree('/admin');
    expect(screen.getByText('admin-page')).toBeInTheDocument();
  });
});
