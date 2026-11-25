import { Link } from 'react-router-dom';
import { useCountdown } from '../hooks/useCountdown';
import { formatINR, hasDiscount } from '../lib/format';
import { getNextTier, projectOrder } from '../lib/pool';
import { closesLabel } from '../lib/time';
import type { PoolProgress } from '../types';
import { ProductImage } from './ui/ProductImage';

export function PoolCard({ pool, featured = false }: { pool: PoolProgress; featured?: boolean }) {
  const next = getNextTier(pool);
  const time = useCountdown(pool.cutoffAt);
  const nextPrice = next ? formatINR(projectOrder(pool, next.unitsNeeded).unitPrice) : null;
  return (
    <article className={featured ? 'market-card market-feature' : 'market-card'}>
      <ProductImage src={pool.imageUrl} name={pool.productName} alt="" loading={featured ? 'eager' : 'lazy'} containerClassName="market-photo" />
      <div className="market-copy">
        {featured && <span className="market-label">{next ? 'Closest to a price drop' : 'Featured deal'}</span>}
        <h3>{pool.productName}</h3>
        <div className="market-price">{formatINR(pool.currentUnitPrice)} {hasDiscount(pool.basePrice, pool.currentUnitPrice) && <del>{formatINR(pool.basePrice)}</del>}</div>
        {featured && next && <div className="market-meter" role="progressbar" aria-label="Progress to next discount" aria-valuemin={0} aria-valuemax={next.tier.minQuantity} aria-valuenow={pool.aggregateQuantity}>
          <span style={{ width: `${100 * pool.aggregateQuantity / next.tier.minQuantity}%` }} />
        </div>}
        {featured && <p>{pool.aggregateQuantity} {pool.aggregateQuantity === 1 ? 'unit' : 'units'} pooled{next ? ` · ${next.unitsNeeded} more to unlock ${nextPrice}` : ''}</p>}
        <p className="market-time">{closesLabel(time)}</p>
        <Link className="market-link" to={`/pools/${pool.poolWindowId}`} aria-label={`View deal for ${pool.productName}`}>View deal <span aria-hidden="true">→</span></Link>
      </div>
    </article>
  );
}

export default PoolCard;
