import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { renderApp } from '../../test/utils';
import { toDatetimeLocal } from '../../lib/time';
import type { PoolProgress, PoolStatus, Product } from '../../types';

vi.mock('../../api/adminApi', () => ({
  adminListPools: vi.fn(),
  adminListProducts: vi.fn(),
  adminCreatePool: vi.fn(),
  adminClosePool: vi.fn(),
  adminCancelPool: vi.fn(),
  adminUpdateCutoff: vi.fn(),
  adminCreateProduct: vi.fn(),
  adminUpdateProduct: vi.fn(),
}));

import { adminCancelPool, adminCreatePool, adminListPools, adminListProducts, adminUpdateCutoff } from '../../api/adminApi';
import SocietyAdminPage from './SocietyAdminPage';

const httpError = (status: number, message?: string) =>
  new AxiosError('fail', 'ERR', undefined, undefined, {
    status, statusText: '', headers: {}, config: {} as never, data: message ? { message } : {},
  });

const pool = (id: string, status: PoolStatus, over: Partial<PoolProgress> = {}): PoolProgress => ({
  poolWindowId: id, productSku: `SKU-${id}`, productName: `Product ${id}`, basePrice: 200, currentUnitPrice: 190, savingsPercent: 5,
  aggregateQuantity: 12, participantCount: 3, tiers: [{ minQuantity: 10, discountPercent: 5 }], status,
  cutoffAt: new Date(Date.now() + 5 * 3600_000).toISOString(), ...over,
});

const products: Product[] = [
  { id: 'p1', societyId: 'soc-1', sku: 'OIL-1L', name: 'Sunflower Oil 1L', imageUrl: null, category: 'Groceries', unit: 'L', basePrice: 180, active: true },
  { id: 'p2', societyId: 'soc-1', sku: 'OLD-1', name: 'Archived Thing', imageUrl: null, category: 'Misc', unit: 'unit', basePrice: 50, active: false },
];

const open = () => renderApp(<SocietyAdminPage />, { route: '/admin/s/soc-1', path: '/admin/s/:societyId' });

const rowFor = async (name: string) => within((await screen.findByText(name)).closest('tr') as HTMLElement);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(adminListProducts).mockResolvedValue(products);
  vi.mocked(adminListPools).mockResolvedValue({ pools: [], total: 0 });
});

describe('SocietyAdminPage: deals table actions follow the deal status', () => {
  it('OPEN deals can change time, close or be cancelled', async () => {
    vi.mocked(adminListPools).mockResolvedValue({ pools: [pool('1', 'OPEN')], total: 1 });
    open();
    const row = await rowFor('Product 1');
    expect(row.getByRole('button', { name: /Change closing time/ })).toBeInTheDocument();
    expect(row.getByRole('button', { name: /Close Product 1 now/ })).toBeInTheDocument();
    expect(row.getByRole('button', { name: /Cancel Product 1/ })).toBeInTheDocument();
  });

  it('closed (locked) deals can be dispatched or cancelled but not re-timed', async () => {
    vi.mocked(adminListPools).mockResolvedValue({ pools: [pool('2', 'LOCKED')], total: 1 });
    open();
    const row = await rowFor('Product 2');
    expect(row.getByRole('link', { name: 'Dispatch' })).toHaveAttribute('href', '/admin/pools/2/dispatch');
    expect(row.getByRole('button', { name: /Cancel Product 2/ })).toBeInTheDocument();
    expect(row.queryByRole('button', { name: /Change closing time/ })).toBeNull();
  });

  it('dispatched and delivered deals can only be viewed; cancelled deals have no actions', async () => {
    vi.mocked(adminListPools).mockResolvedValue({ pools: [pool('3', 'DISPATCHED'), pool('4', 'DELIVERED'), pool('5', 'CANCELLED')], total: 3 });
    open();
    for (const id of ['3', '4']) {
      const row = await rowFor(`Product ${id}`);
      expect(row.getByRole('link', { name: 'View PO' })).toHaveAttribute('href', `/admin/pools/${id}/dispatch`);
      expect(row.queryByRole('button', { name: /Cancel/ })).toBeNull();
    }
    const cancelled = await rowFor('Product 5');
    expect(cancelled.queryByRole('button')).toBeNull();
    expect(cancelled.queryByRole('link')).toBeNull();
  });
});

describe('SocietyAdminPage: cancelling a deal', () => {
  it('warns how many neighbours are affected, then cancels', async () => {
    vi.mocked(adminListPools).mockResolvedValue({ pools: [pool('1', 'OPEN', { participantCount: 3 })], total: 1 });
    vi.mocked(adminCancelPool).mockResolvedValue();
    open();
    await userEvent.click((await rowFor('Product 1')).getByRole('button', { name: /Cancel Product 1/ }));

    const dialog = screen.getByRole('dialog', { name: 'Cancel this deal?' });
    expect(dialog).toHaveTextContent('orders of 3 neighbours will be cancelled');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Yes, cancel deal' }));

    await waitFor(() => expect(adminCancelPool).toHaveBeenCalledWith('1'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('keeps the dialog open with the reason when the server refuses', async () => {
    vi.mocked(adminListPools).mockResolvedValue({ pools: [pool('1', 'OPEN')], total: 1 });
    vi.mocked(adminCancelPool).mockRejectedValue(httpError(409, 'Only open or closed deals can be cancelled.'));
    open();
    await userEvent.click((await rowFor('Product 1')).getByRole('button', { name: /Cancel Product 1/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, cancel deal' }));
    expect(await screen.findByText('Only open or closed deals can be cancelled.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does nothing when the admin backs out', async () => {
    vi.mocked(adminListPools).mockResolvedValue({ pools: [pool('1', 'OPEN')], total: 1 });
    open();
    await userEvent.click((await rowFor('Product 1')).getByRole('button', { name: /Cancel Product 1/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(adminCancelPool).not.toHaveBeenCalled();
  });
});

describe('SocietyAdminPage: changing the closing time', () => {
  it('opens the dialog for that deal and saves the new time', async () => {
    vi.mocked(adminListPools).mockResolvedValue({ pools: [pool('1', 'OPEN')], total: 1 });
    vi.mocked(adminUpdateCutoff).mockResolvedValue(pool('1', 'OPEN'));
    open();
    await userEvent.click((await rowFor('Product 1')).getByRole('button', { name: /Change closing time/ }));

    const dialog = screen.getByRole('dialog', { name: 'Change closing time' });
    expect(dialog).toHaveTextContent('Product 1');
    const local = toDatetimeLocal(new Date(Date.now() + 2 * 86400_000).toISOString());
    fireEvent.change(within(dialog).getByLabelText('New closing time'), { target: { value: local } });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save new time' }));

    await waitFor(() => expect(adminUpdateCutoff).toHaveBeenCalledWith('1', new Date(local).toISOString()));
  });
});

describe('SocietyAdminPage: opening a deal from the product list', () => {
  const fillAndSubmit = async () => {
    await userEvent.type(screen.getByLabelText('Floor minimum (₹)'), '130');
    fireEvent.change(screen.getByLabelText('Closes at'), { target: { value: toDatetimeLocal(new Date(Date.now() + 86400_000).toISOString()) } });
    await userEvent.click(screen.getByRole('button', { name: 'Create pool' }));
  };

  it('offers only active products, prefilling the usual price', async () => {
    open();
    const select = await screen.findByLabelText('Product');
    await waitFor(() => expect(within(select).getAllByRole('option').length).toBe(2));
    expect(within(select).queryByRole('option', { name: /Archived Thing/ })).toBeNull();

    await userEvent.selectOptions(select, 'OIL-1L');
    expect(screen.getByLabelText('Base retail (₹)')).toHaveValue(180);
    expect(screen.getByText(/per L.*SKU/)).toBeInTheDocument();
  });

  it('creates the deal with the chosen SKU and no typed product name', async () => {
    vi.mocked(adminCreatePool).mockResolvedValue(pool('9', 'OPEN'));
    open();
    await screen.findByRole('option', { name: /Sunflower Oil 1L/ });
    await userEvent.selectOptions(screen.getByLabelText('Product'), 'OIL-1L');
    await fillAndSubmit();

    await waitFor(() => expect(adminCreatePool).toHaveBeenCalledTimes(1));
    const payload = vi.mocked(adminCreatePool).mock.calls[0]![0];
    expect(payload).toMatchObject({ societyId: 'soc-1', productSku: 'OIL-1L', basePrice: 180, floorPrice: 130 });
    expect(payload).not.toHaveProperty('productName');
    expect(payload.tiers.map((t) => t.minQuantity)).toEqual([10, 30, 50]);
  });

  it('asks for a product choice before creating', async () => {
    open();
    await screen.findByLabelText('Product');
    await userEvent.type(screen.getByLabelText('Base retail (₹)'), '200');
    await fillAndSubmit();
    expect(await screen.findByText('Choose a product from your product list.')).toBeInTheDocument();
    expect(adminCreatePool).not.toHaveBeenCalled();
  });

  it('says "Loading products" while the list is loading, not "No products yet"', async () => {
    vi.mocked(adminListProducts).mockReturnValue(new Promise(() => {}));
    open();
    expect(await screen.findByRole('option', { name: 'Loading products…' })).toBeInTheDocument();
    expect(screen.queryByText('No products yet')).toBeNull();
    expect(screen.getByRole('button', { name: 'Create pool' })).toBeDisabled();
  });

  it('with no products, explains what to do and disables creating', async () => {
    vi.mocked(adminListProducts).mockResolvedValue([]);
    open();
    expect(await screen.findByText(/Add a product in “My products” above first/)).toBeInTheDocument();
    expect(screen.getByLabelText('Product')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Create pool' })).toBeDisabled();
  });

  it('shows the server reason when creation fails', async () => {
    vi.mocked(adminCreatePool).mockRejectedValue(httpError(400, 'Tier 1: a 50% discount takes the price below your floor price.'));
    open();
    await screen.findByRole('option', { name: /Sunflower Oil 1L/ });
    await userEvent.selectOptions(screen.getByLabelText('Product'), 'OIL-1L');
    await fillAndSubmit();
    expect(await screen.findByText(/below your floor price/)).toBeInTheDocument();
  });
});
