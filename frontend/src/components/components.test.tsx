import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LivePoolMeter } from './LivePoolMeter';
import { QuantityStepper } from './QuantityStepper';
import { TieredPricingCard } from './TieredPricingCard';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { TierEditor } from './admin/TierEditor';
import { OrderCard } from './OrderCard';
import { MemoryRouter } from 'react-router-dom';
import { makePool } from '../test/utils';

describe('LivePoolMeter', () => {
  it('shows the savings nudge derived from live quantity', () => {
    render(<LivePoolMeter pool={makePool({ aggregateQuantity: 24 })} connected />);
    expect(screen.getByText(/Only 6 more units to unlock 35% off/)).toBeInTheDocument();
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '24');
    expect(bar).toHaveAttribute('aria-valuemax', '30');
  });
  it('uses the singular for one unit', () => {
    render(<LivePoolMeter pool={makePool({ aggregateQuantity: 29 })} connected />);
    expect(screen.getByText(/Only 1 more unit to unlock/)).toBeInTheDocument();
  });
  it('celebrates the top tier and flags reconnecting', () => {
    render(<LivePoolMeter pool={makePool({ aggregateQuantity: 40 })} connected={false} />);
    expect(screen.getByText(/Maximum wholesale discount/)).toBeInTheDocument();
    expect(screen.getByText('(Reconnecting…)')).toBeInTheDocument();
  });
});

describe('TieredPricingCard', () => {
  it('marks only the highest reached tier as current', () => {
    render(<TieredPricingCard pool={makePool({ aggregateQuantity: 24 })} />);
    const items = screen.getAllByRole('listitem');
    expect(items.filter((i) => i.getAttribute('aria-current') === 'true')).toHaveLength(1);
    expect(items[1]).toHaveAttribute('aria-current', 'true');
    expect(screen.getByText(/You save ₹56 per unit/)).toBeInTheDocument();
  });
});

describe('QuantityStepper', () => {
  it('respects min and max', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<QuantityStepper quantity={1} onChange={onChange} min={1} max={3} />);
    expect(screen.getByLabelText('Decrease quantity')).toBeDisabled();
    await userEvent.click(screen.getByLabelText('Increase quantity'));
    expect(onChange).toHaveBeenCalledWith(2);
    rerender(<QuantityStepper quantity={3} onChange={onChange} min={1} max={3} />);
    expect(screen.getByLabelText('Increase quantity')).toBeDisabled();
  });
});

describe('ConfirmDialog', () => {
  it('is labelled, focuses Cancel, and closes on Escape', async () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog open title="Dispatch?" confirmLabel="Yes" onConfirm={() => {}} onCancel={onCancel}>
        body
      </ConfirmDialog>,
    );
    expect(screen.getByRole('dialog', { name: 'Dispatch?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalled();
  });
  it('traps Tab inside the dialog', async () => {
    render(
      <ConfirmDialog open title="T" confirmLabel="Yes" onConfirm={() => {}} onCancel={() => {}}>x</ConfirmDialog>,
    );
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Yes' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });
  it('renders nothing when closed', () => {
    render(<ConfirmDialog open={false} title="T" confirmLabel="Y" onConfirm={() => {}} onCancel={() => {}}>x</ConfirmDialog>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('TierEditor', () => {
  it('adds, edits and removes tiers, keeping at least one', async () => {
    const onChange = vi.fn();
    const tiers = [{ minQuantity: 10, discountPercent: 5 }];
    render(<TierEditor tiers={tiers} onChange={onChange} />);
    expect(screen.getByLabelText('Remove tier 1')).toBeDisabled();
    await userEvent.click(screen.getByText('+ Add tier'));
    expect(onChange).toHaveBeenCalledWith([...tiers, { minQuantity: 30, discountPercent: 10 }]);
  });
});

describe('OrderCard live price', () => {
  const base = {
    orderId: 'o1', poolWindowId: 'p1', productName: 'Sunflower Oil 1L', quantity: 2, unitPriceAtCommit: 169.2,
    totalAmount: 338.4, basePrice: 180, status: 'COMMITTED' as const, cutoffAt: '2099-01-01T00:00:00Z',
    createdAt: '2026-11-12T00:00:00Z', poolStatus: 'OPEN' as const,
  };

  it('shows the discount earned so far, and labels the price as today\u2019s, while the pool is open', () => {
    render(<MemoryRouter><OrderCard order={{ ...base, priceIsFinal: false }} /></MemoryRouter>);
    expect(screen.getByText(/Saving ₹21\.60 so far/)).toBeInTheDocument();
    expect(screen.getByText(/\(today\)/)).toBeInTheDocument();
  });

  it('shows plain "You saved" once the price is final', () => {
    render(<MemoryRouter><OrderCard order={{ ...base, priceIsFinal: true, status: 'LOCKED' }} /></MemoryRouter>);
    expect(screen.getByText(/You saved ₹21\.60/)).toBeInTheDocument();
    expect(screen.queryByText(/so far/)).toBeNull();
  });
});
