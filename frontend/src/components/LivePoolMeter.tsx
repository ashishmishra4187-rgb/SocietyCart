import React from 'react';
import { deriveTiers, getMaxTarget, getNextTier, getProgressPercent } from '../lib/pool';
import type { PoolProgress } from '../types';
import { ArrowDownCircle, CheckCircle } from './ui/Icons';

interface LivePoolMeterProps {
  pool: PoolProgress;
  connected: boolean;
}

export const LivePoolMeter: React.FC<LivePoolMeterProps> = ({ pool, connected }) => {
  const tiers = deriveTiers(pool);
  const maxTarget = getMaxTarget(pool);
  const progress = getProgressPercent(pool);
  const next = getNextTier(pool);

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold text-neutral-900 tracking-tight tabular-nums">
              {pool.aggregateQuantity}
            </span>
            <span className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">units pooled</span>
          </div>
          <div className="text-xs text-neutral-600 mt-0.5 font-medium">Goal: {maxTarget} units for maximum discount</div>
        </div>

        <div className="flex items-center gap-2 bg-neutral-50 px-3 py-1.5 rounded-full border border-neutral-100">
          <span
            aria-hidden="true"
            className={`w-2 h-2 rounded-full ${connected ? 'bg-savings animate-pulse' : 'bg-neutral-300'}`}
          />
          <span className="text-xs font-semibold text-neutral-700">
            {pool.participantCount} {pool.participantCount === 1 ? 'neighbour' : 'neighbours'}
          </span>
          <span className="sr-only">{connected ? 'Live updates on' : 'Reconnecting to live updates'}</span>
          {!connected && (
            <span aria-hidden="true" className="text-[10px] text-neutral-500 italic">
              (Reconnecting…)
            </span>
          )}
        </div>
      </div>

      <div className="relative pt-2 pb-1 mx-2">
        <div
          role="progressbar"
          aria-label="Units pooled towards the maximum discount"
          aria-valuemin={0}
          aria-valuemax={maxTarget}
          aria-valuenow={Math.min(pool.aggregateQuantity, maxTarget)}
          aria-valuetext={`${pool.aggregateQuantity} of ${maxTarget} units`}
          className="relative w-full bg-neutral-100 h-3 rounded-full overflow-hidden"
        >
          <div
            className="bg-savings h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="relative w-full h-6 mt-1" aria-hidden="true">
          {tiers.map((tier) => {
            const pos = Math.min(100, Math.round((tier.minQuantity / maxTarget) * 100));
            return (
              <div
                key={tier.minQuantity}
                className="absolute top-0 flex flex-col items-center -translate-x-1/2"
                style={{ left: `${pos}%` }}
              >
                <div className={`w-0.5 h-2 ${tier.achieved ? 'bg-savings' : 'bg-neutral-300'}`} />
                <span
                  className={`text-[10px] mt-0.5 font-medium ${
                    tier.achieved ? 'text-savings font-bold' : 'text-neutral-500'
                  }`}
                >
                  {tier.minQuantity}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-2 text-xs font-bold text-savings bg-savings/10 p-2.5 rounded-xl border border-savings/20"
      >
        {next ? (
          <>
            <ArrowDownCircle className="w-4 h-4 shrink-0" />
            <span>
              Only {next.unitsNeeded} more unit{next.unitsNeeded > 1 ? 's' : ''} to unlock {next.tier.discountPercent}% off!
            </span>
          </>
        ) : (
          <>
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{tiers.length > 0 ? 'Maximum wholesale discount tier unlocked for your community!' : 'Be the first to join this deal.'}</span>
          </>
        )}
      </div>
    </div>
  );
};
export default LivePoolMeter;
