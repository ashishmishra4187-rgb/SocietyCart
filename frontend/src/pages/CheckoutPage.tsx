import React, { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createOrder } from '../api/orderApi';
import { PriceSummary } from '../components/PriceSummary';
import { QuantityStepper } from '../components/QuantityStepper';
import { BackLink } from '../components/ui/BackLink';
import { Spinner } from '../components/ui/Spinner';
import { ErrorState, LoadingRegion, Skeleton } from '../components/ui/States';
import { useAuthContext } from '../context/AuthContext';
import { useCountdown } from '../hooks/useCountdown';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { usePool } from '../hooks/usePoolList';
import { useStompWebSocket } from '../hooks/useStompWebSocket';
import { getErrorMessage, getStatus } from '../lib/errors';
import { formatINR, formatINRFixed, lineTotal } from '../lib/format';
import { maxQuantityFor } from '../lib/pool';
import { isValidFlat } from '../lib/validation';
import type { PoolProgress } from '../types';

export const CheckoutPage: React.FC = () => {
  useDocumentTitle('Confirm order');
  const { poolId } = useParams<{ poolId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session } = useAuthContext();

  const [quantity, setQuantity] = useState(1);
  const [flatNumber, setFlatNumber] = useState(() => session?.flatNumber ?? '');
  const [conflict, setConflict] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // One key per checkout screen: a double tap or network retry can never create two orders.
  const idempotencyKey = useRef(crypto.randomUUID());
  // Price the resident first saw, so we can tell them if it moves while they're here.
  const firstSeenPrice = useRef<number | null>(null);

  const { data: pool, isLoading, isError, refetch } = usePool(poolId);
  useStompWebSocket(poolId); // keeps this page's price live too
  const time = useCountdown(pool?.cutoffAt);

  if (pool && firstSeenPrice.current === null) firstSeenPrice.current = pool.currentUnitPrice;

  const orderMutation = useMutation({
    mutationFn: (p: PoolProgress) => {
      if (!session?.residentId) throw new Error('Missing session');
      return createOrder(
        p.poolWindowId,
        { residentId: session.residentId, flatNumber: flatNumber.trim(), items: [{ sku: p.productSku, quantity }] },
        idempotencyKey.current,
      );
    },
    onSuccess: (updatedPool) => {
      queryClient.setQueryData(['pool', poolId], updatedPool);
      void queryClient.invalidateQueries({ queryKey: ['pools'] });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      navigate('/orders', { state: { justJoined: true }, replace: true });
    },
    onError: (err) => {
      if (getStatus(err) === 409) {
        setConflict(true);
        return;
      }
      // Keep the key after a network/5xx failure (the order may have landed, a retry must be safe).
      // Only a definitive 4xx rejection earns a fresh key.
      const status = getStatus(err);
      if (status !== undefined && status >= 400 && status < 500) idempotencyKey.current = crypto.randomUUID();
      setSubmitError(getErrorMessage(err, 'We could not place your order. Please try again.'));
    },
  });

  if (isLoading) {
    return (
      <LoadingRegion label="Loading checkout" className="space-y-4">
        <Skeleton className="h-6 w-36 rounded-full" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-44 rounded-2xl" />
      </LoadingRegion>
    );
  }

  if (isError || !pool) {
    return <ErrorState fullPage title="Couldn't load deal details" onRetry={() => void refetch()} />;
  }

  const closed = pool.status !== 'OPEN' || time.ended;
  const busy = orderMutation.isPending;
  const maxQty = maxQuantityFor(pool);
  const flatValid = isValidFlat(flatNumber);
  const total = lineTotal(pool.currentUnitPrice, quantity);
  const priceChanged = firstSeenPrice.current !== null && pool.currentUnitPrice !== firstSeenPrice.current;
  const societyRoute = session?.societyId ? `/s/${session.societyId}` : '/';

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center justify-between gap-2">
        <BackLink to={`/pools/${pool.poolWindowId}`}>Back to details</BackLink>
        <h1 className="text-base font-bold text-neutral-900">Confirm your order</h1>
      </nav>

      {closed && (
        <div role="alert" className="mb-4 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium space-y-2">
          <p>This deal closed before you could join.</p>
          <Link to={societyRoute} className="inline-block font-bold underline hover:text-amber-800">
            Back to deals
          </Link>
        </div>
      )}

      {conflict && (
        <div role="alert" className="mb-4 p-4 rounded-2xl bg-brand-50 border border-brand-200 text-brand-900 text-xs font-medium flex items-center justify-between">
          <span>You've already joined this deal.</span>
          <Link to="/orders" className="font-bold underline text-brand-600 hover:text-brand-700">
            View orders
          </Link>
        </div>
      )}

      {priceChanged && !closed && (
        <div role="status" className="mb-4 p-3.5 rounded-2xl bg-savings/10 border border-savings/20 text-xs font-semibold text-neutral-900">
          {pool.currentUnitPrice < (firstSeenPrice.current ?? 0)
            ? `Good news: the price just dropped to ${formatINR(pool.currentUnitPrice)} per unit as more neighbours joined.`
            : `The price changed to ${formatINR(pool.currentUnitPrice)} per unit. Check the total before you confirm.`}
        </div>
      )}

      <div className="space-y-4">
        <section aria-label="Product" className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-16 h-16 rounded-xl bg-neutral-100 overflow-hidden shrink-0 flex items-center justify-center border border-neutral-100">
            {pool.imageUrl ? (
              <img src={pool.imageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[10px] text-neutral-500 font-medium">No image</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-neutral-900 truncate leading-snug">{pool.productName}</h2>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-sm font-extrabold text-brand-600 tabular-nums">{formatINRFixed(pool.currentUnitPrice)}</span>
              <span className="text-xs text-neutral-500 line-through tabular-nums">{formatINRFixed(pool.basePrice)}</span>
              {pool.savingsPercent > 0 && (
                <span className="text-[10px] font-bold text-savings bg-savings/10 px-1.5 py-0.5 rounded-md">-{pool.savingsPercent}%</span>
              )}
            </div>
          </div>
        </section>

        <QuantityStepper quantity={quantity} onChange={setQuantity} min={1} max={maxQty} disabled={closed || busy} />

        <section aria-label="Delivery details" className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-sm">
          <label htmlFor="flatNumber" className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2">
            Flat / door number
          </label>
          <input
            id="flatNumber"
            type="text"
            autoComplete="off"
            maxLength={20}
            disabled={closed || busy}
            placeholder="e.g. B-1204"
            value={flatNumber}
            aria-invalid={flatNumber.length > 0 && !flatValid}
            aria-describedby="flat-error"
            onChange={(e) => {
              setFlatNumber(e.target.value);
              setSubmitError(null);
            }}
            className="w-full px-3.5 py-2.5 text-sm font-semibold text-neutral-900 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:bg-neutral-50 disabled:text-neutral-500"
          />
          <p id="flat-error" className="text-xs font-medium text-red-700 mt-1.5 empty:hidden">
            {flatNumber.length > 0 && !flatValid ? 'Use letters, numbers, dash or slash only (max 20).' : ''}
          </p>
        </section>

        <PriceSummary unitPrice={pool.currentUnitPrice} quantity={quantity} timeRemainingText={time.ended ? 'ended' : time.label} />

        {submitError && (
          <p role="alert" className="text-xs font-medium text-red-700">
            {submitError}
          </p>
        )}
      </div>

      <aside
        aria-label="Order confirmation"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-neutral-200 py-3 px-4 pb-safe shadow-[0_-4px_16px_rgba(0,0,0,0.06)]"
      >
        <div className="max-w-[640px] mx-auto">
          <button
            type="button"
            disabled={closed || !flatValid || busy}
            onClick={() => {
              setSubmitError(null);
              orderMutation.mutate(pool);
            }}
            className="w-full py-3.5 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm flex items-center justify-center gap-2"
          >
            {busy ? (
              <>
                <Spinner />
                <span>Confirming…</span>
              </>
            ) : (
              `Confirm order · ${formatINRFixed(total)}`
            )}
          </button>
        </div>
      </aside>
    </>
  );
};
export default CheckoutPage;
