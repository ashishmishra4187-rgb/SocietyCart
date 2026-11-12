import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { renderApp } from '../../test/utils';
import { toDatetimeLocal } from '../../lib/time';
import type { PackingList, PoolProgress, Product } from '../../types';

vi.mock('../../api/adminApi', () => ({
  adminListProducts: vi.fn(),
  adminCreateProduct: vi.fn(),
  adminUpdateProduct: vi.fn(),
  adminUpdateCutoff: vi.fn(),
  adminPackingList: vi.fn(),
}));
vi.mock('../../lib/csv', async (orig) => ({ ...(await orig<typeof import('../../lib/csv')>()), downloadCsv: vi.fn() }));

import { adminCreateProduct, adminListProducts, adminPackingList, adminUpdateCutoff, adminUpdateProduct } from '../../api/adminApi';
import { downloadCsv } from '../../lib/csv';
import { EditCutoffDialog } from './EditCutoffDialog';
import { PackingListCard } from './PackingListCard';
import { ProductManager } from './ProductManager';

const httpError = (status: number, message?: string) =>
  new AxiosError('fail', 'ERR', undefined, undefined, {
    status, statusText: '', headers: {}, config: {} as never, data: message ? { message } : {},
  });

const product = (over: Partial<Product> = {}): Product => ({
  id: 'p1', societyId: 'soc-1', sku: 'ATTA-5KG', name: 'Atta 5kg', imageUrl: null, category: 'Staples', unit: 'kg', basePrice: 450, active: true, ...over,
});

beforeEach(() => vi.clearAllMocks());

describe('ProductManager', () => {
  const open = () => renderApp(<ProductManager societyId="soc-1" />);

  it('lists products with price and unit, and marks archived ones', async () => {
    vi.mocked(adminListProducts).mockResolvedValue([product(), product({ id: 'p2', sku: 'OIL-1L', name: 'Oil 1L', unit: 'L', basePrice: 180, active: false })]);
    open();
    expect(await screen.findByText('Atta 5kg')).toBeInTheDocument();
    expect(screen.getByText(/ATTA-5KG · ₹450 \/ kg · Staples/)).toBeInTheDocument();
    expect(screen.getByText('Archived')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore Oil 1L' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Archive Atta 5kg' })).toBeInTheDocument();
  });

  it('shows a helpful empty state', async () => {
    vi.mocked(adminListProducts).mockResolvedValue([]);
    open();
    expect(await screen.findByText('No products yet.')).toBeInTheDocument();
  });

  it('adds a product and sends only the fields that were filled in', async () => {
    vi.mocked(adminListProducts).mockResolvedValue([]);
    vi.mocked(adminCreateProduct).mockResolvedValue(product());
    open();
    await userEvent.click(await screen.findByRole('button', { name: '+ Add a product' }));

    await userEvent.type(screen.getByLabelText('Product name'), '  Whole Wheat Atta 5kg ');
    await userEvent.type(screen.getByLabelText('SKU'), 'ATTA-5KG');
    await userEvent.type(screen.getByLabelText(/Usual shop price/), '450');
    await userEvent.click(screen.getByRole('button', { name: 'Add product' }));

    await waitFor(() => expect(adminCreateProduct).toHaveBeenCalledTimes(1));
    expect(vi.mocked(adminCreateProduct).mock.calls[0]![0]).toEqual({
      societyId: 'soc-1', sku: 'ATTA-5KG', name: 'Whole Wheat Atta 5kg', basePrice: 450,
    });
  });

  it('refuses bad input before calling the server', async () => {
    vi.mocked(adminListProducts).mockResolvedValue([]);
    open();
    await userEvent.click(await screen.findByRole('button', { name: '+ Add a product' }));
    await userEvent.type(screen.getByLabelText('Product name'), 'Atta');
    await userEvent.type(screen.getByLabelText('SKU'), 'a b');
    await userEvent.type(screen.getByLabelText(/Usual shop price/), '450');
    await userEvent.click(screen.getByRole('button', { name: 'Add product' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/SKU must be/);

    await userEvent.clear(screen.getByLabelText('SKU'));
    await userEvent.type(screen.getByLabelText('SKU'), 'ATTA-5KG');
    await userEvent.type(screen.getByLabelText(/Photo link/), 'javascript:alert(1)');
    await userEvent.click(screen.getByRole('button', { name: 'Add product' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/http/);
    expect(adminCreateProduct).not.toHaveBeenCalled();
  });

  it('shows the server reason, e.g. a duplicate SKU', async () => {
    vi.mocked(adminListProducts).mockResolvedValue([]);
    vi.mocked(adminCreateProduct).mockRejectedValue(httpError(409, 'A product with SKU ATTA-5KG already exists.'));
    open();
    await userEvent.click(await screen.findByRole('button', { name: '+ Add a product' }));
    await userEvent.type(screen.getByLabelText('Product name'), 'Atta');
    await userEvent.type(screen.getByLabelText('SKU'), 'ATTA-5KG');
    await userEvent.type(screen.getByLabelText(/Usual shop price/), '450');
    await userEvent.click(screen.getByRole('button', { name: 'Add product' }));
    expect(await screen.findByText('A product with SKU ATTA-5KG already exists.')).toBeInTheDocument();
  });

  it('edits a product: the SKU is locked and a cleared photo link is sent as empty', async () => {
    vi.mocked(adminListProducts).mockResolvedValue([product({ imageUrl: 'https://img.example/a.png' })]);
    vi.mocked(adminUpdateProduct).mockResolvedValue(product());
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Atta 5kg' }));

    expect(screen.getByLabelText('SKU')).toBeDisabled();
    expect(screen.getByLabelText('SKU')).toHaveValue('ATTA-5KG');
    await userEvent.clear(screen.getByLabelText('Product name'));
    await userEvent.type(screen.getByLabelText('Product name'), 'Atta Premium 5kg');
    await userEvent.clear(screen.getByLabelText(/Photo link/));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(adminUpdateProduct).toHaveBeenCalledTimes(1));
    expect(adminUpdateProduct).toHaveBeenCalledWith('p1', { name: 'Atta Premium 5kg', basePrice: 450, unit: 'kg', category: 'Staples', imageUrl: '' });
  });

  it('archives and restores products', async () => {
    vi.mocked(adminListProducts).mockResolvedValue([product(), product({ id: 'p2', sku: 'OIL-1L', name: 'Oil 1L', active: false })]);
    vi.mocked(adminUpdateProduct).mockResolvedValue(product());
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Archive Atta 5kg' }));
    await waitFor(() => expect(adminUpdateProduct).toHaveBeenCalledWith('p1', { active: false }));
    await userEvent.click(screen.getByRole('button', { name: 'Restore Oil 1L' }));
    await waitFor(() => expect(adminUpdateProduct).toHaveBeenCalledWith('p2', { active: true }));
  });
});

describe('EditCutoffDialog', () => {
  const pool = (): PoolProgress => ({
    poolWindowId: 'pool-1', productSku: 'OIL-1L', productName: 'Sunflower Oil 1L', basePrice: 180, currentUnitPrice: 169.2, savingsPercent: 6,
    aggregateQuantity: 11, participantCount: 2, tiers: [], status: 'OPEN', cutoffAt: new Date(Date.now() + 3 * 3600_000).toISOString(),
  });
  const setTime = (value: string) => fireEvent.change(screen.getByLabelText('New closing time'), { target: { value } });
  const futureLocal = (days: number) => toDatetimeLocal(new Date(Date.now() + days * 86400_000).toISOString());

  it('stays closed without a deal', () => {
    renderApp(<EditCutoffDialog pool={null} onClose={() => {}} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('starts from the deal\u2019s current closing time', () => {
    const p = pool();
    renderApp(<EditCutoffDialog pool={p} onClose={() => {}} />);
    expect(screen.getByRole('dialog', { name: 'Change closing time' })).toBeInTheDocument();
    expect(screen.getByLabelText('New closing time')).toHaveValue(toDatetimeLocal(p.cutoffAt));
    expect(screen.getByText('Sunflower Oil 1L')).toBeInTheDocument();
  });

  it('refuses a time that is too soon, without calling the server', async () => {
    renderApp(<EditCutoffDialog pool={pool()} onClose={() => {}} />);
    setTime(toDatetimeLocal(new Date(Date.now() + 60_000).toISOString()));
    await userEvent.click(screen.getByRole('button', { name: 'Save new time' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 5 minutes/);
    expect(adminUpdateCutoff).not.toHaveBeenCalled();
  });

  it('refuses a time more than 30 days away', async () => {
    renderApp(<EditCutoffDialog pool={pool()} onClose={() => {}} />);
    setTime(futureLocal(45));
    await userEvent.click(screen.getByRole('button', { name: 'Save new time' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/within 30 days/);
  });

  it('saves a valid time as an ISO instant and closes', async () => {
    const onClose = vi.fn();
    vi.mocked(adminUpdateCutoff).mockResolvedValue(pool());
    renderApp(<EditCutoffDialog pool={pool()} onClose={onClose} />);
    const local = futureLocal(2);
    setTime(local);
    await userEvent.click(screen.getByRole('button', { name: 'Save new time' }));

    await waitFor(() => expect(adminUpdateCutoff).toHaveBeenCalledTimes(1));
    expect(adminUpdateCutoff).toHaveBeenCalledWith('pool-1', new Date(local).toISOString());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('shows the server reason and stays open when saving fails', async () => {
    const onClose = vi.fn();
    vi.mocked(adminUpdateCutoff).mockRejectedValue(httpError(409, 'Only open deals can change their closing time.'));
    renderApp(<EditCutoffDialog pool={pool()} onClose={onClose} />);
    setTime(futureLocal(2));
    await userEvent.click(screen.getByRole('button', { name: 'Save new time' }));
    expect(await screen.findByText('Only open deals can change their closing time.')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('PackingListCard', () => {
  const list = (): PackingList => ({
    poolWindowId: 'pool-1', productName: 'Sunflower Oil 1L', sku: 'OIL-1L', unit: 'L', totalUnits: 6, totalAmount: 1140,
    lines: [
      { flatNumber: 'A-1', residentName: 'One', phone: '9876500001', quantity: 3, unitPrice: 190, amount: 570, status: 'LOCKED' },
      { flatNumber: 'B-2', residentName: '=Evil()', phone: '9876500002', quantity: 1, unitPrice: 190, amount: 190, status: 'LOCKED' },
      { flatNumber: 'B-10', residentName: 'Ten', phone: '9876500003', quantity: 2, unitPrice: 190, amount: 380, status: 'LOCKED' },
    ],
  });

  it('shows each flat in the order given, with totals', async () => {
    vi.mocked(adminPackingList).mockResolvedValue(list());
    renderApp(<PackingListCard poolId="pool-1" />);
    await screen.findByText('One');
    const rows = screen.getAllByRole('row').slice(1, 4);
    expect(rows.map((r) => r.querySelector('th')?.textContent)).toEqual(['A-1', 'B-2', 'B-10']);
    expect(screen.getByText('6 L')).toBeInTheDocument();
    expect(screen.getByText('₹1,140.00')).toBeInTheDocument();
  });

  it('downloads a CSV with a header and a total row', async () => {
    vi.mocked(adminPackingList).mockResolvedValue(list());
    renderApp(<PackingListCard poolId="pool-1" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Download CSV' }));

    expect(downloadCsv).toHaveBeenCalledTimes(1);
    const [filename, rows] = vi.mocked(downloadCsv).mock.calls[0]!;
    expect(filename).toBe('packing-list-OIL-1L.csv');
    expect(rows[0]).toEqual(['Flat', 'Resident', 'Phone', 'Quantity (L)', 'Unit price (INR)', 'Amount (INR)', 'Status']);
    expect(rows[1]).toEqual(['A-1', 'One', '9876500001', 3, 190, 570, 'LOCKED']);
    expect(rows[rows.length - 1]).toEqual(['Total', '', '', 6, '', 1140, '']);
  });

  it('shows an empty state with no download buttons', async () => {
    vi.mocked(adminPackingList).mockResolvedValue({ ...list(), lines: [], totalUnits: 0, totalAmount: 0 });
    renderApp(<PackingListCard poolId="pool-1" />);
    expect(await screen.findByText('No active orders in this deal.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Download CSV' })).toBeNull();
  });

  it('offers a retry when loading fails', async () => {
    vi.mocked(adminPackingList).mockRejectedValueOnce(httpError(500)).mockResolvedValue(list());
    renderApp(<PackingListCard poolId="pool-1" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('One')).toBeInTheDocument();
  });
});
