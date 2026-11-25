import type { PoolProgress, PriceTier } from '../types';
import { round2 } from './format';

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

export interface OrderProjection {
  /** Pool total after this order is added. */
  projectedQuantity: number;
  /** What the resident would pay per unit once their own units are counted (never above today's price). */
  unitPrice: number;
  /** Discount off the shop price at that unit price. */
  discountPercent: number;
  /** The best discount level this order newly unlocks (null if it doesn't cross a new threshold). */
  newlyUnlocked: TierView | null;
  /** The next level still to reach after this order. */
  next: { tier: TierView; unitsNeeded: number } | null;
}

/**
 * Previews the price a resident gets by joining with `quantity` units. The server counts the resident's own
 * units towards the tier, so joining with 10 units can itself unlock the 10-unit discount.
 */
export const projectOrder = (
  pool: Pick<PoolProgress, 'tiers' | 'aggregateQuantity' | 'basePrice' | 'currentUnitPrice'>,
  quantity: number,
): OrderProjection => {
  const projectedQuantity = pool.aggregateQuantity + Math.max(0, quantity);
  const today = deriveTiers(pool).filter((t) => t.achieved).pop() ?? null;
  const after = deriveTiers({ tiers: pool.tiers, aggregateQuantity: projectedQuantity }).filter((t) => t.achieved).pop() ?? null;

  const tierPrice = after ? round2((pool.basePrice * (100 - after.discountPercent)) / 100) : pool.basePrice;
  const unitPrice = Math.min(pool.currentUnitPrice, tierPrice);
  const discountPercent = pool.basePrice > 0 ? round2(((pool.basePrice - unitPrice) / pool.basePrice) * 100) : 0;
  const newlyUnlocked = after && (!today || after.minQuantity > today.minQuantity) ? after : null;

  return {
    projectedQuantity,
    unitPrice,
    discountPercent: Math.max(0, discountPercent),
    newlyUnlocked,
    next: getNextTier({ tiers: pool.tiers, aggregateQuantity: projectedQuantity }),
  };
  
};
/** A deal counts as "closing soon" when it closes within this many hours. */
export const CLOSING_SOON_HOURS = 6;
const CLOSING_SOON_MS = CLOSING_SOON_HOURS * 3_600_000;

type DealView = Pick<PoolProgress, 'status' | 'cutoffAt' | 'savingsPercent' | 'aggregateQuantity' | 'tiers'>;

/** Open deals closing within the next {@link CLOSING_SOON_HOURS} hours, soonest first. */
export const closingSoon = <T extends DealView>(pools: T[], now: number): T[] =>
  pools
    .filter((p) => {
      const ms = new Date(p.cutoffAt).getTime() - now;
      return p.status === 'OPEN' && ms > 0 && ms <= CLOSING_SOON_MS;
    })
    .sort((a, b) => new Date(a.cutoffAt).getTime() - new Date(b.cutoffAt).getTime());

/** Deals that already have a discount unlocked, biggest discount first (more units pooled breaks ties). */
export const withSavings = <T extends DealView>(pools: T[]): T[] =>
  pools
    .filter((p) => p.status === 'OPEN' && p.savingsPercent > 0)
    .sort((a, b) => b.savingsPercent - a.savingsPercent || b.aggregateQuantity - a.aggregateQuantity);

export interface AlmostThere<T> {
  pool: T;
  /** Units the group still needs for the next discount level. */
  unitsNeeded: number;
  /** The discount that level unlocks. */
  discountPercent: number;
}

/** Deals with no discount yet, ordered by how close the group is to the first level. */
export const almostThere = <T extends DealView>(pools: T[]): AlmostThere<T>[] =>
  pools
    .filter((p) => p.status === 'OPEN' && p.savingsPercent <= 0)
    .flatMap((pool) => {
      const next = getNextTier(pool);
      return next ? [{ pool, unitsNeeded: next.unitsNeeded, discountPercent: next.tier.discountPercent }] : [];
    })
    .sort((a, b) => a.unitsNeeded - b.unitsNeeded);