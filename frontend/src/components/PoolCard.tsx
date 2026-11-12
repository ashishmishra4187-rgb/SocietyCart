import React from 'react';
import { Link } from 'react-router-dom';
import { useCountdown } from '../hooks/useCountdown';
import { formatINR } from '../lib/format';
import { getMaxTarget, getProgressPercent } from '../lib/pool';
import { closesLabel } from '../lib/time';
import type { PoolProgress } from '../types';
import { UsersIcon } from './ui/Icons';

export const PoolCard: React.FC<{ pool: PoolProgress }> = ({ pool }) => {
  const time = useCountdown(pool.cutoffAt);
  const maxTarget = getMaxTarget(pool);
  const progress = getProgressPercent(pool);

  return (
    <Link
      to={`/pools/${pool.poolWindowId}`}
      className="group block bg-white rounded-2xl border border-neutral-200 p-3.5 shadow-sm hover:border-neutral-300 transition-colors"
    >
      <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-neutral-100 mb-3 flex items-center justify-center">
        {pool.imageUrl ? (
          <img
            src={pool.imageUrl}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <span className="text-xs text-neutral-500 font-medium">No image</span>
        )}
        {pool.savingsPercent > 0 && (
          <span className="absolute top-2 right-2 bg-savings text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">
            -{pool.savingsPercent}%
          </span>
        )}
      </div>

      <h3 className="text-sm font-semibold text-neutral-900 line-clamp-2 min-h-[2.5rem] leading-snug mb-2">
        {pool.productName}
      </h3>

      <div className="flex items-baseline gap-2 mb-2.5">
        <span className="text-base font-bold text-neutral-900 tabular-nums">{formatINR(pool.currentUnitPrice)}</span>
        <span className="text-xs text-neutral-500 line-through tabular-nums">{formatINR(pool.basePrice)}</span>
      </div>

      <div className="mb-3">
        <div
          role="progressbar"
          aria-label={`${pool.productName} pool progress`}
          aria-valuemin={0}
          aria-valuemax={maxTarget}
          aria-valuenow={Math.min(pool.aggregateQuantity, maxTarget)}
          className="w-full bg-neutral-100 rounded-full h-1.5 overflow-hidden"
        >
          <div className="bg-savings h-1.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <div className="text-[11px] text-neutral-600 mt-1 font-medium tabular-nums">
          {pool.aggregateQuantity} / {maxTarget} units
        </div>
      </div>

      <div className="flex items-center justify-between pt-2.5 border-t border-neutral-100 text-xs">
        <span className="inline-flex items-center gap-1 font-medium text-neutral-700">
          <UsersIcon className="w-3.5 h-3.5 text-neutral-500" />
          {pool.participantCount} {pool.participantCount === 1 ? 'neighbour' : 'neighbours'}
        </span>
        <span className={`font-medium tabular-nums ${time.urgent && !time.ended ? 'text-amber-700' : 'text-neutral-600'}`}>
          {closesLabel(time)}
        </span>
      </div>
    </Link>
  );
};
export default PoolCard;
