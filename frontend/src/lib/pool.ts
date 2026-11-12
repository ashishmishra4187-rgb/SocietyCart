import type { PoolProgress, PriceTier } from '../types';

export interface TierView extends PriceTier {
  achieved: boolean;
  /** The highest tier reached so far. */
  current: boolean;
}

/** Sorted ladder with achieved/current flags derived from the live aggregate quantity. */
export const deriveTiers = (pool: Pick<PoolProgress, 'tiers' | 'aggregateQuantity'>): TierView[] => {
  const sorted = [...pool.tiers].sort((a, b) => a.minQuantity - b.minQuantity);
  const achievedCount = sorted.filter((t) => pool.aggregateQuantity >= t.minQuantity).length;
  return sorted.map((t, i) => ({
    ...t,
    achieved: i < achievedCount,
    current: achievedCount > 0 && i === achievedCount - 1,
  }));
};

export const getNextTier = (pool: Pick<PoolProgress, 'tiers' | 'aggregateQuantity'>) => {
  const next = deriveTiers(pool).find((t) => !t.achieved);
  if (!next) return null;
  return { tier: next, unitsNeeded: Math.max(1, next.minQuantity - pool.aggregateQuantity) };
};

/** Target for the progress bar: the top tier, or the current quantity when there are no tiers. */
export const getMaxTarget = (pool: Pick<PoolProgress, 'tiers' | 'aggregateQuantity'>): number => {
  const tiers = deriveTiers(pool);
  const top = tiers[tiers.length - 1];
  return top ? top.minQuantity : Math.max(1, pool.aggregateQuantity);
};

export const getProgressPercent = (pool: Pick<PoolProgress, 'tiers' | 'aggregateQuantity'>): number => {
  const max = getMaxTarget(pool);
  return Math.min(100, Math.max(0, Math.round((pool.aggregateQuantity / max) * 100)));
};

export const DEFAULT_MAX_QTY_PER_ORDER = 20;
export const maxQuantityFor = (pool: Pick<PoolProgress, 'maxQuantityPerOrder'>): number =>
  pool.maxQuantityPerOrder && pool.maxQuantityPerOrder > 0 ? pool.maxQuantityPerOrder : DEFAULT_MAX_QTY_PER_ORDER;
