import React from 'react';
import { useNavigate } from 'react-router-dom';
import { formatINR, savingsPerUnit } from '../lib/format';
import type { PoolProgress, PoolStatus } from '../types';

const LABELS: Record<PoolStatus, string> = {
  OPEN: 'Join this deal',
  LOCKED: 'Deal closed',
  DISPATCHED: 'Dispatched',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

export const JoinDealBar: React.FC<{ pool: PoolProgress }> = ({ pool }) => {
  const navigate = useNavigate();
  const isOpen = pool.status === 'OPEN';
  const saved = savingsPerUnit(pool.basePrice, pool.currentUnitPrice);

  return (
    <aside
      aria-label="Join deal action bar"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-neutral-200 py-3 px-4 pb-safe shadow-[0_-4px_16px_rgba(0,0,0,0.06)]"
    >
      <div className="max-w-[640px] mx-auto flex items-center justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-neutral-900 tracking-tight tabular-nums">
              {formatINR(pool.currentUnitPrice)}
            </span>
            <span className="text-xs font-medium text-neutral-600">per unit</span>
          </div>
          {saved > 0 && (
            <p className="text-[11px] font-semibold text-savings">
              Save {formatINR(saved)} ({pool.savingsPercent}%)
            </p>
          )}
        </div>

        <button
          type="button"
          disabled={!isOpen}
          onClick={() => navigate(`/pools/${pool.poolWindowId}/checkout`)}
          className="px-6 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-brand-500 shadow-sm"
        >
          {LABELS[pool.status] ?? 'Deal closed'}
        </button>
      </div>
    </aside>
  );
};
export default JoinDealBar;
