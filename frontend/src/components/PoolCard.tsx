import { displayLabel } from '../lib/displayLabel';
import { Link } from 'react-router-dom';
import { useCountdown } from '../hooks/useCountdown';
import { formatINR, hasDiscount } from '../lib/format';
import { getNextTier, projectOrder } from '../lib/pool';
import { closesLabel } from '../lib/time';
import type { PoolProgress } from '../types';
import { ProductImage } from './ui/ProductImage';

export function PoolCard({ pool, featured = false }: { pool: PoolProgress; featured?: boolean }) {
  const name = displayLabel(pool.productName);
  const pack = name.match(/\s+\((\d+(?:\.\d+)?)\s*(kg|g|ml|l)\b\s*([^()]*)\)$/i);
  const title = pack ? name.slice(0, pack.index) : name;
  const unit = pack?.[2]?.toLowerCase();
  const packLabel = pack && [pack[1], unit === 'l' ? 'L' : unit === 'ml' ? 'mL' : unit, pack[3]?.trim()].filter(Boolean).join(' ');
  const next = getNextTier(pool);
  const time = useCountdown(pool.cutoffAt);
  const nextPrice = next ? formatINR(projectOrder(pool, next.unitsNeeded).unitPrice) : null;
  return (
    <article className={featured ? 'market-card market-feature' : 'market-card'}>
      <ProductImage src={pool.imageUrl} name={displayLabel(pool.productName)} captionFallback={featured} alt="" loading={featured ? 'eager' : 'lazy'} containerClassName="market-photo" />
      <div className="market-copy">
        {featured && <span className="market-label">{next ? 'Closest to a price drop' : 'Featured deal'}</span>}
        <div><h3>{title}</h3>{packLabel && <p className="market-pack">{packLabel}</p>}</div>
        <div className="market-price">{formatINR(pool.currentUnitPrice)} {hasDiscount(pool.basePrice, pool.currentUnitPrice) && <del>{formatINR(pool.basePrice)}</del>}</div>
        {featured && next && <div className="market-meter" role="progressbar" aria-label="Progress to next discount" aria-valuemin={0} aria-valuemax={next.tier.minQuantity} aria-valuenow={pool.aggregateQuantity}>
          <span style={{ width: `${100 * pool.aggregateQuantity / next.tier.minQuantity}%` }} />
        </div>}
        {featured && <p>{pool.aggregateQuantity} {pool.aggregateQuantity === 1 ? 'unit' : 'units'} pooled{next ? ` · ${next.unitsNeeded} more to unlock ${nextPrice}` : ''}</p>}
        <p className="market-time">{closesLabel(time)}{pool.participantCount > 0 && <>{' \u00b7 '} {pool.participantCount} {pool.participantCount === 1 ? 'resident' : 'residents'} joined</>}</p>
        <Link className="market-link" to={`/pools/${pool.poolWindowId}`} aria-label={`View deal for ${displayLabel(pool.productName)}`}>View deal <span aria-hidden="true">→</span></Link>
      </div>
    </article>
  );
}

export default PoolCard;
