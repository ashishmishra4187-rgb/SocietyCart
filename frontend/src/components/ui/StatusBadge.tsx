import React from 'react';
import { capitalise } from '../../lib/format';

const STYLES: Record<string, string> = {
  COMMITTED: 'bg-brand-500/10 text-brand-600 border-brand-500/20',
  OPEN: 'bg-savings/10 text-savings border-savings/20',
  LOCKED: 'bg-amber-50 text-amber-800 border-amber-200',
  DISPATCHED: 'bg-blue-50 text-blue-700 border-blue-200',
  DELIVERED: 'bg-savings/10 text-savings border-savings/20',
  CANCELLED: 'bg-neutral-100 text-neutral-600 border-neutral-200',
};

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span
    className={`inline-block shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
      STYLES[status] ?? 'bg-neutral-100 text-neutral-600 border-neutral-200'
    }`}
  >
    {capitalise(status)}
  </span>
);
