import React from 'react';
import { Link } from 'react-router-dom';
import { useCountdown } from '../hooks/useCountdown';
import { formatINR, hasDiscount } from '../lib/format';
import { getMaxTarget, getProgressPercent } from '../lib/pool';
import { closesLabel } from '../lib/time';
import type { PoolProgress } from '../types';
import { UsersIcon } from './ui/Icons';
import { ProductImage } from './ui/ProductImage';

export const PoolCard: React.FC<{ pool: PoolProgress }> = ({ pool }) => {
  const time = useCountdown(pool.cutoffAt);
  const maxTarget = getMaxTarget(pool);
  const progress = getProgressPercent(pool);

  return (
    <Link
      to={`/pools/${pool.poolWindowId}`}
      className="group block bg-white rounded-3xl border border-neutral-200/90 p-3.5 sm:p-4 shadow-sm hover:border-brand-500/50 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 transform"
    >
      <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-neutral-100 mb-3 border border-neutral-100 shadow-xs">
        <ProductImage
          src={pool.imageUrl}
          alt={pool.productName}
          name={pool.productName}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {pool.savingsPercent > 0 && (
          <span className="absolute top-2.5 right-2.5 bg-savings text-white text-xs font-black px-2.5 py-1 rounded-full shadow-md backdrop-blur-xs transition-transform duration-300 group-hover:scale-105">
            -{pool.savingsPercent}%
          </span>
        )}
      </div>

      <h3 className="text-sm font-bold text-neutral-900 group-hover:text-brand-600 line-clamp-2 min-h-[2.5rem] leading-snug mb-2 transition-colors">
        {pool.productName}
      </h3>

      <div className="flex items-baseline gap-2 mb-2.5">
        <span className="text-base font-extrabold text-neutral-900 tabular-nums">
          {formatINR(pool.currentUnitPrice)}
        </span>
        {hasDiscount(pool.basePrice, pool.currentUnitPrice) && (
          <span className="text-xs text-neutral-400 line-through tabular-nums">
            {formatINR(pool.basePrice)}
          </span>
        )}
      </div>

      <div className="mb-3">
        <div
          role="progressbar"
          aria-label={`${pool.productName} pool progress`}
          aria-valuemin={0}
          aria-valuemax={maxTarget}
          aria-valuenow={Math.min(pool.aggregateQuantity, maxTarget)}
          className="w-full bg-neutral-100 rounded-full h-2 overflow-hidden"
        >
          <div
            className="bg-gradient-to-r from-teal-500 to-emerald-600 h-2 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between items-center text-[11px] text-neutral-500 mt-1.5 font-medium tabular-nums">
          <span>{pool.aggregateQuantity} / {maxTarget} units</span>
          <span className="font-semibold text-brand-600">{Math.round(progress)}% reached</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2.5 border-t border-neutral-100 text-xs">
        <span className="inline-flex items-center gap-1.5 font-semibold text-neutral-700">
          <UsersIcon className="w-3.5 h-3.5 text-brand-600" />
          {pool.participantCount} {pool.participantCount === 1 ? 'neighbour' : 'neighbours'}
        </span>
        <span className={`font-semibold tabular-nums ${time.urgent && !time.ended ? 'text-amber-700 font-bold' : 'text-neutral-500'}`}>
          {closesLabel(time)}
        </span>
      </div>
    </Link>
  );
};

export default PoolCard;
