import React from 'react';
import { useParams } from 'react-router-dom';
import { JoinDealBar } from '../components/JoinDealBar';
import { LivePoolMeter } from '../components/LivePoolMeter';
import { TieredPricingCard } from '../components/TieredPricingCard';
import { BackLink } from '../components/ui/BackLink';
import { ClockIcon, ImageIcon } from '../components/ui/Icons';
import { ErrorState, LoadingRegion, Skeleton } from '../components/ui/States';
import { useAuthContext } from '../context/AuthContext';
import { useCountdown } from '../hooks/useCountdown';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { usePool } from '../hooks/usePoolList';
import { useStompWebSocket } from '../hooks/useStompWebSocket';
import { closesLabel } from '../lib/time';

export const ProductPoolDetails: React.FC = () => {
  const { poolId } = useParams<{ poolId: string }>();
  const { session } = useAuthContext();
  const { data: pool, isLoading, isError, refetch } = usePool(poolId);
  const { connected } = useStompWebSocket(poolId);
  const time = useCountdown(pool?.cutoffAt);
  useDocumentTitle(pool?.productName ?? 'Deal');

  const back = session?.societyId ? `/s/${session.societyId}` : '/';

  if (isLoading) {
    return (
      <LoadingRegion label="Loading deal" className="space-y-4">
        <Skeleton className="w-10 h-10 rounded-full" />
        <Skeleton className="w-full aspect-[4/3] rounded-2xl" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-44 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </LoadingRegion>
    );
  }

  if (isError || !pool) {
    return (
      <ErrorState
        fullPage
        title="Deal not found"
        message="This pool may have expired or is no longer available."
        onRetry={() => void refetch()}
        backTo={back}
        backLabel="Back to deals"
      />
    );
  }

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-3">
        <BackLink to={back}>Back to deals</BackLink>
      </nav>

      <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden bg-neutral-100 mb-4 border border-neutral-200 shadow-xs flex items-center justify-center">
        {pool.imageUrl ? (
          <img src={pool.imageUrl} alt={pool.productName} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center justify-center text-neutral-500">
            <ImageIcon className="w-12 h-12 text-neutral-400 mb-1" />
            <span className="text-xs font-medium">No image available</span>
          </div>
        )}
        {pool.savingsPercent > 0 && (
          <span className="absolute top-3 right-3 bg-savings text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-sm">
            -{pool.savingsPercent}%
          </span>
        )}
      </div>

      <header className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 leading-tight">{pool.productName}</h1>
        <p className="text-xs font-medium text-neutral-600 mt-1">
          {pool.supplierName ? `Sold by ${pool.supplierName}` : 'Direct wholesale batch'}
        </p>
      </header>

      <section className="mb-4" aria-label="Tiered pricing details">
        <TieredPricingCard pool={pool} />
      </section>

      <section className="mb-4" aria-label="Live pool progress">
        <LivePoolMeter pool={pool} connected={connected} />
      </section>

      <div className="flex items-center justify-center gap-2 py-2 mb-2 text-xs font-semibold text-center">
        <ClockIcon className={`w-4 h-4 ${time.urgent && !time.ended ? 'text-amber-600 motion-safe:animate-bounce' : 'text-neutral-500'}`} />
        <span className={time.urgent && !time.ended ? 'text-amber-700 font-bold' : 'text-neutral-700'}>{closesLabel(time)}</span>
      </div>

      <JoinDealBar pool={{ ...pool, status: time.ended && pool.status === 'OPEN' ? 'LOCKED' : pool.status }} />
    </>
  );
};
export default ProductPoolDetails;
