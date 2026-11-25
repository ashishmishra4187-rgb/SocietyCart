import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { makePool, renderApp, SESSION } from '../test/utils';

vi.mock('../api/poolApi', () => ({
  getPool: vi.fn(),
  getSocietyPools: vi.fn(),
  getSociety: vi.fn(),
  getMySocieties: vi.fn(),
}));
vi.mock('../api/orderApi', () => ({
  createOrder: vi.fn(),
  cancelOrder: vi.fn(),
  myOrders: vi.fn(),
  getOrder: vi.fn(),
}));
vi.mock('../api/authApi', () => ({
  requestOtp: vi.fn(),
  signup: vi.fn(),
  getSignupSocieties: vi.fn(),
  verifyOtp: vi.fn(),
  logoutRequest: vi.fn(),
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
}));
vi.mock('../hooks/useStompWebSocket', () => ({ useStompWebSocket: () => ({ connected: true }) }));

import { getPool } from '../api/poolApi';
import { cancelOrder, createOrder, myOrders } from '../api/orderApi';
import { getSignupSocieties, requestOtp, signup, verifyOtp } from '../api/authApi';
import CheckoutPage from './CheckoutPage';
import LoginPage from './LoginPage';
import MyOrdersPage from './MyOrdersPage';

const httpError = (status: number, message?: string) =>
  new AxiosError('fail', 'ERR', undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: {} as never,
    data: message ? { message } : {},
  });

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe('CheckoutPage', () => {
  const open = () => renderApp(<CheckoutPage />, { route: '/pools/pool-123/checkout', path: '/pools/:poolId/checkout' });

  it('orders against the real product SKU (not the pool id) with an idempotency key', async () => {
    vi.mocked(getPool).mockResolvedValue(makePool());
    vi.mocked(createOrder).mockResolvedValue(makePool({ aggregateQuantity: 25 }));
    open();

    await userEvent.click(await screen.findByRole('button', { name: /Confirm order/ }));

    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1));
    const [poolId, payload, key] = vi.mocked(createOrder).mock.calls[0]!;
    expect(poolId).toBe('pool-123');
    expect(payload.items).toEqual([{ sku: 'SKU-MILK-A2', quantity: 1 }]);
    expect(payload.flatNumber).toBe('B-1204');
    expect(key).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('blocks submit for an invalid flat number', async () => {
    vi.mocked(getPool).mockResolvedValue(makePool());
    open();
    const input = await screen.findByLabelText(/Flat \/ door number/i);
    await userEvent.clear(input);
    await userEvent.type(input, '<b>');
    expect(screen.getByRole('button', { name: /Confirm order/ })).toBeDisabled();
  });

  it('shows the already-joined banner on 409', async () => {
    vi.mocked(getPool).mockResolvedValue(makePool());
    vi.mocked(createOrder).mockRejectedValue(httpError(409));
    open();
    await userEvent.click(await screen.findByRole('button', { name: /Confirm order/ }));
    expect(await screen.findByText(/already joined/i)).toBeInTheDocument();
  });

  it('surfaces other failures and lets the user retry', async () => {
    vi.mocked(getPool).mockResolvedValue(makePool());
    vi.mocked(createOrder).mockRejectedValue(httpError(500, 'Supplier unavailable'));
    open();
    await userEvent.click(await screen.findByRole('button', { name: /Confirm order/ }));
    expect(await screen.findByText('Supplier unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm order/ })).toBeEnabled();
  });

  it('reuses the key after a 5xx but rotates it after a 4xx', async () => {
    vi.mocked(getPool).mockResolvedValue(makePool());
    vi.mocked(createOrder).mockRejectedValue(httpError(500));
    open();
    const btn = await screen.findByRole('button', { name: /Confirm order/ });
    await userEvent.click(btn);
    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(btn).toBeEnabled());
    await userEvent.click(btn);
    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(2));
    const calls = vi.mocked(createOrder).mock.calls;
    expect(calls[1]![2]).toBe(calls[0]![2]);

    vi.mocked(createOrder).mockRejectedValue(httpError(422));
    await waitFor(() => expect(btn).toBeEnabled());
    await userEvent.click(btn);
    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(btn).toBeEnabled());
    await userEvent.click(btn);
    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(4));
    expect(vi.mocked(createOrder).mock.calls[3]![2]).not.toBe(calls[2]![2]);
  });

  it('tells the resident when the price drops while they are on the page', async () => {
    vi.mocked(getPool).mockResolvedValue(makePool());
    const { client } = open();
    await screen.findByRole('button', { name: /Confirm order/ });
    act(() => {
      client.setQueryData(['pool', 'pool-123'], makePool({ currentUnitPrice: 130, savingsPercent: 35, aggregateQuantity: 31 }));
    });
    expect(await screen.findByText(/price just dropped to ₹130/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm order · ₹130.00/ })).toBeInTheDocument();
  });

  it('disables ordering once the pool is closed', async () => {
    vi.mocked(getPool).mockResolvedValue(makePool({ status: 'LOCKED' }));
    open();
    expect(await screen.findByText(/closed before you could join/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm order/ })).toBeDisabled();
  });

  it('shows a retryable error state when the pool cannot load', async () => {
    vi.mocked(getPool).mockRejectedValue(httpError(500));
    open();
    expect(await screen.findByRole('alert')).toHaveTextContent(/Couldn't load deal details/);
  });
});

describe('LoginPage', () => {
  const open = (path = '/login', initialMode?: 'signin' | 'signup') =>
    renderApp(<LoginPage initialMode={initialMode} />, { route: path, path, session: null });

  const societies = [
    { id: 'soc-1', name: 'Greenwood Heights', city: 'Bengaluru' },
    { id: 'soc-2', name: 'Lakeside Habitat', city: 'Bengaluru' },
  ];

  const fillSignup = async (opts: { admin?: boolean } = {}) => {
    if (opts.admin) await userEvent.click(screen.getByLabelText(/Society admin/i));
    await userEvent.type(screen.getByLabelText(/Full name/i), 'Asha Rao');
    await userEvent.type(screen.getByLabelText(/Mobile number/i), '9876543210');
    await userEvent.selectOptions(await screen.findByLabelText(/Your society/i), 'soc-1');
    await userEvent.type(screen.getByLabelText(/Flat \/ door number/i), 'B-1204');
  };

  it('opens on Sign in and keeps Send OTP disabled until a valid Indian mobile is entered', async () => {
    open();
    expect(screen.getByRole('tab', { name: 'Sign in' })).toHaveAttribute('aria-selected', 'true');
    const btn = screen.getByRole('button', { name: 'Send OTP' });
    await userEvent.type(screen.getByLabelText(/Mobile number/i), '1234567890');
    expect(btn).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(/valid 10-digit/);
  });

  it('keeps demo credentials off the sign-in screen', () => {
    open();
    expect(screen.getByRole('button', { name: 'Send OTP' })).toBeDisabled();
    expect(screen.queryByText(/123456|SOCIETY\.ADMIN/)).toBeNull();
  });

  it('signs an existing user in with a pasted OTP and stores no token', async () => {
    vi.mocked(requestOtp).mockResolvedValue();
    vi.mocked(verifyOtp).mockResolvedValue({ residentId: 'res-1', societyId: 'soc-1', flatNumber: 'B-1204' });
    open();

    await userEvent.type(screen.getByLabelText(/Mobile number/i), '9876543210');
    await userEvent.click(screen.getByRole('button', { name: 'Send OTP' }));

    await userEvent.click(await screen.findByLabelText('Digit 1 of 6'));
    await userEvent.paste('123456');
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => expect(verifyOtp).toHaveBeenCalledWith('9876543210', '123456'));
    expect(await screen.findByText('other-route')).toBeInTheDocument();
    expect(window.localStorage.getItem('sc_token')).toBeNull();
    expect(JSON.parse(window.localStorage.getItem('sc_session') ?? '{}')).toMatchObject({ societyId: 'soc-1' });
  });

  it('tells a new number there is no account and offers to create one, keeping the number', async () => {
    vi.mocked(requestOtp).mockRejectedValue(httpError(404, 'No account found for this number. Please create an account.'));
    vi.mocked(getSignupSocieties).mockResolvedValue(societies);
    open();

    await userEvent.type(screen.getByLabelText(/Mobile number/i), '9876543210');
    await userEvent.click(screen.getByRole('button', { name: 'Send OTP' }));
    expect(await screen.findByText(/No account found/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Create an account with this number/ }));
    expect(screen.getByRole('tab', { name: 'Create account' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText(/Mobile number/i)).toHaveValue('9876543210');
    expect(screen.getByLabelText(/Full name/i)).toBeInTheDocument();
  });

  it('creates a resident account: collects details, sends them with the OTP request, then verifies', async () => {
    vi.mocked(getSignupSocieties).mockResolvedValue(societies);
    vi.mocked(signup).mockResolvedValue();
    vi.mocked(verifyOtp).mockResolvedValue({ residentId: 'res-9', societyId: 'soc-1', flatNumber: 'B-1204', name: 'Asha Rao', newAccount: true });
    open('/signup', 'signup');

    const send = screen.getByRole('button', { name: 'Send OTP' });
    expect(send).toBeDisabled();
    await fillSignup();
    expect(screen.queryByLabelText(/Admin code/i)).toBeNull();
    expect(send).toBeEnabled();
    await userEvent.click(send);

    await waitFor(() => expect(signup).toHaveBeenCalledTimes(1));
    expect(vi.mocked(signup).mock.calls[0]![0]).toEqual({
      phone: '9876543210', name: 'Asha Rao', societyId: 'soc-1', flatNumber: 'B-1204', role: 'RESIDENT',
    });

    await userEvent.click(await screen.findByLabelText('Digit 1 of 6'));
    await userEvent.paste('123456');
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
    await waitFor(() => expect(verifyOtp).toHaveBeenCalledWith('9876543210', '123456'));
    expect(await screen.findByText('other-route')).toBeInTheDocument();
  });

  it('requires an admin code for a society-admin account and sends it', async () => {
    vi.mocked(getSignupSocieties).mockResolvedValue(societies);
    vi.mocked(signup).mockResolvedValue();
    open('/signup', 'signup');

    await fillSignup({ admin: true });
    const send = screen.getByRole('button', { name: 'Send OTP' });
    expect(send).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/Admin code/i), 'SOCIETY-ADMIN-DEMO');
    expect(send).toBeEnabled();
    await userEvent.click(send);

    await waitFor(() => expect(signup).toHaveBeenCalledTimes(1));
    expect(vi.mocked(signup).mock.calls[0]![0]).toMatchObject({ role: 'SOCIETY_ADMIN', adminCode: 'SOCIETY-ADMIN-DEMO' });
  });

  it('shows the server reason for a bad admin code', async () => {
    vi.mocked(getSignupSocieties).mockResolvedValue(societies);
    vi.mocked(signup).mockRejectedValue(httpError(403, 'That admin code is not valid.'));
    open('/signup', 'signup');
    await fillSignup({ admin: true });
    await userEvent.type(screen.getByLabelText(/Admin code/i), 'guess');
    await userEvent.click(screen.getByRole('button', { name: 'Send OTP' }));
    expect(await screen.findByText('That admin code is not valid.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Digit 1 of 6')).toBeNull();
  });

  it('tells someone who already has an account to sign in instead', async () => {
    vi.mocked(getSignupSocieties).mockResolvedValue(societies);
    vi.mocked(signup).mockRejectedValue(httpError(409, 'An account already exists for this number. Please sign in instead.'));
    open('/signup', 'signup');
    await fillSignup();
    await userEvent.click(screen.getByRole('button', { name: 'Send OTP' }));
    expect(await screen.findByText(/account already exists/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Sign in instead' }));
    expect(screen.getByRole('tab', { name: 'Sign in' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText(/Mobile number/i)).toHaveValue('9876543210');
  });

  it('validates the sign-up form before enabling Send OTP', async () => {
    vi.mocked(getSignupSocieties).mockResolvedValue(societies);
    open('/signup', 'signup');
    await userEvent.type(screen.getByLabelText(/Full name/i), '1');
    await userEvent.type(screen.getByLabelText(/Mobile number/i), '9876543210');
    await userEvent.selectOptions(await screen.findByLabelText(/Your society/i), 'soc-2');
    await userEvent.type(screen.getByLabelText(/Flat \/ door number/i), '<b>');
    expect(screen.getByRole('button', { name: 'Send OTP' })).toBeDisabled();
  });

  it('lets the user retry when the society list fails to load', async () => {
    vi.mocked(getSignupSocieties).mockRejectedValueOnce(httpError(500)).mockResolvedValue(societies);
    open('/signup', 'signup');
    expect(await screen.findByText(/Could not load societies/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('option', { name: /Greenwood Heights/ })).toBeInTheDocument();
  });

  it('shows the server message and clears the boxes on a wrong OTP', async () => {
    vi.mocked(requestOtp).mockResolvedValue();
    vi.mocked(verifyOtp).mockRejectedValue(httpError(401, 'Invalid OTP'));
    open();
    await userEvent.type(screen.getByLabelText(/Mobile number/i), '9876543210');
    await userEvent.click(screen.getByRole('button', { name: 'Send OTP' }));
    await userEvent.click(await screen.findByLabelText('Digit 1 of 6'));
    await userEvent.paste('000000');
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
    expect(await screen.findByText('Invalid OTP')).toBeInTheDocument();
    expect(screen.getByLabelText('Digit 1 of 6')).toHaveValue('');
    expect(screen.getByLabelText('Digit 1 of 6')).toHaveFocus();
  });

  it('redirects an already signed-in resident away from login', () => {
    renderApp(<LoginPage />, { route: '/login', path: '/login', session: SESSION });
    expect(screen.getByText('other-route')).toBeInTheDocument();
  });
});

describe('MyOrdersPage', () => {
  const order = (over: Record<string, unknown>) => ({
    orderId: 'o1', poolWindowId: 'pool-1', productName: 'Rice 5kg', quantity: 2, unitPriceAtCommit: 90,
    totalAmount: 180, basePrice: 100, status: 'COMMITTED', cutoffAt: '2099-01-01T00:00:00Z', createdAt: '2026-11-10T00:00:00Z', poolStatus: 'OPEN', ...over,
  });

  it('keeps locked/dispatched orders in Active and finished ones in Past', async () => {
    vi.mocked(myOrders).mockImplementation(async past => ({
      orders: past ? [order({ orderId: 'c', productName: 'Delivered item', status: 'DELIVERED' })] :
        [order({ orderId: 'a', productName: 'Committed item' }), order({ orderId: 'b', productName: 'Dispatched item', status: 'DISPATCHED' })],
      active: 2, past: 1, saved: 20,
    } as never));
    renderApp(<MyOrdersPage />, { route: '/orders', path: '/orders' });
    expect(await screen.findByText('Committed item')).toBeInTheDocument();
    expect(screen.getByText('Dispatched item')).toBeInTheDocument();
    expect(screen.queryByText('Delivered item')).toBeNull();
    await userEvent.click(screen.getByRole('tab', { name: /Past/ }));
    expect(await screen.findByText('Delivered item')).toBeInTheDocument();
    expect(screen.getByLabelText('Savings summary')).toHaveTextContent('₹20');
  });

  it('cancels with confirmation and reports failures', async () => {
    vi.mocked(myOrders).mockResolvedValue({ orders: [order({})], active: 1, past: 0, saved: 0 } as never);
    vi.mocked(cancelOrder).mockRejectedValue(httpError(409, 'Pool already locked'));
    renderApp(<MyOrdersPage />, { route: '/orders', path: '/orders' });
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel order' }));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, cancel' }));
    expect(cancelOrder).toHaveBeenCalledWith('pool-1', 'o1');
    expect(await screen.findByText('Pool already locked')).toBeInTheDocument();
  });
});
