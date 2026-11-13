import React from 'react';
import { formatINR, savingsPerUnit } from '../lib/format';
import { deriveTiers } from '../lib/pool';
import type { PoolProgress } from '../types';
import { CheckCircle, LockIcon } from './ui/Icons';

export const TieredPricingCard: React.FC<{ pool: PoolProgress }> = ({ pool }) => {
  const saved = savingsPerUnit(pool.basePrice, pool.currentUnitPrice);
  const tiers = deriveTiers(pool);

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline gap-2.5 mb-3">
        <span className="text-4xl font-extrabold text-brand-600 tracking-tight tabular-nums">
          {formatINR(pool.currentUnitPrice)}
        </span>
       {saved > 0 && (
  <span className="text-base text-neutral-500 line-through font-medium">
    <span className="sr-only">Retail price </span>
    {formatINR(pool.basePrice)}
  </span>
)}
      </div>

      {saved > 0 && (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-savings/10 border border-savings/20 mb-5">
          <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-savings animate-pulse" />
          <span className="text-xs font-bold text-savings">
            You save {formatINR(saved)} per unit ({pool.savingsPercent}%)
          </span>
        </div>
      )}

      {tiers.length > 0 && (
        <div className="space-y-2 border-t border-neutral-100 pt-4">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-2">Group price ladder</h2>
          <ul className="space-y-2">
            {tiers.map((tier) => (
              <li
                key={tier.minQuantity}
                aria-current={tier.current ? 'true' : undefined}
                className={`flex items-center justify-between p-2.5 rounded-xl text-xs transition-colors duration-300 ${
                  tier.current
                    ? 'bg-brand-500/10 border border-brand-500/30 text-brand-600 font-semibold'
                    : tier.achieved
                      ? 'bg-neutral-50 text-neutral-800 font-medium'
                      : 'bg-white border border-neutral-100 text-neutral-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  {tier.achieved ? (
                    <CheckCircle className="w-4 h-4 text-savings shrink-0" />
                  ) : (
                    <LockIcon className="w-4 h-4 text-neutral-400 shrink-0" />
                  )}
                  <span>
                    {tier.minQuantity}+ units
                    {tier.current && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-brand-500 text-white font-bold tracking-tight">
                        Current
                      </span>
                    )}
                    <span className="sr-only">{tier.achieved ? ' (unlocked)' : ' (locked)'}</span>
                  </span>
                </div>
                <span className={tier.achieved ? 'text-savings font-bold' : 'text-neutral-600'}>
                  {tier.discountPercent}% off
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
export default TieredPricingCard;
