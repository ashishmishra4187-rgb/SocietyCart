import { DiscountPopup } from '../components/DiscountPopup';
import React, { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createOrder } from '../api/orderApi';
import { PriceSummary } from '../components/PriceSummary';
import { QuantityStepper } from '../components/QuantityStepper';
import { BackLink } from '../components/ui/BackLink';
import { ProductImage } from '../components/ui/ProductImage';
import { Spinner } from '../components/ui/Spinner';
import { ErrorState, LoadingRegion, Skeleton } from '../components/ui/States';
import { TagIcon } from '../components/ui/Icons';
import { useAuthContext } from '../context/AuthContext';
import { useCountdown } from '../hooks/useCountdown';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { usePool } from '../hooks/usePoolList';
import { useStompWebSocket } from '../hooks/useStompWebSocket';
import { getErrorMessage, getStatus } from '../lib/errors';
import { formatINR, formatINRFixed, hasDiscount, lineTotal } from '../lib/format';
import { maxQuantityFor, projectOrder } from '../lib/pool';
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
        <Skeleton className="h-28 rounded-2xl" />
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
  // The server counts your own units towards the discount level, so preview the price you'd actually get.
  const projection = projectOrder(pool, quantity);
  const total = lineTotal(projection.unitPrice, quantity);
  const unitsToAdd = projection.next?.unitsNeeded ?? 0;
  const canAddToUnlock = projection.next !== null && quantity + unitsToAdd <= maxQty;
  const priceChanged = firstSeenPrice.current !== null && pool.currentUnitPrice !== firstSeenPrice.current;
  const societyRoute = session?.societyId ? `/s/${session.societyId}` : '/';

  return (
    <>
      <DiscountPopup
        key={pool.poolWindowId}
        percent={closed ? null : projection.newlyUnlocked?.discountPercent ?? null}
        unitPrice={projection.unitPrice}
        productName={pool.productName}
        imageUrl={pool.imageUrl}
      />
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
        {/* Prominent, attractive item showcase card for items to be ordered */}
        <section
          aria-label="Product"
          className="bg-white rounded-2xl border border-neutral-200 p-4 sm:p-5 shadow-sm flex items-center gap-4 transition-all hover:border-neutral-300"
        >
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-neutral-100 overflow-hidden shrink-0 border border-neutral-100 shadow-xs relative">
            <ProductImage
              src={pool.imageUrl}
              alt={pool.productName}
              name={pool.productName}
              className="w-full h-full object-cover"
            />
            {pool.savingsPercent > 0 && (
              <span className="absolute top-1.5 left-1.5 bg-savings text-white text-[10px] font-black px-1.5 py-0.5 rounded-md shadow-xs">
                -{pool.savingsPercent}%
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-0.5">
              <TagIcon className="w-3 h-3 text-brand-600" />
              <span>{pool.supplierName ? `Sold by ${pool.supplierName}` : 'Wholesale Direct'}</span>
            </div>

            <h2 className="text-sm sm:text-base font-bold text-neutral-900 truncate leading-snug">
              {pool.productName}
            </h2>

            <div className="flex flex-wrap items-baseline gap-2 mt-1.5">
              <span className="text-base sm:text-lg font-extrabold text-brand-600 tabular-nums">
                {formatINRFixed(pool.currentUnitPrice)}
              </span>
              {hasDiscount(pool.basePrice, pool.currentUnitPrice) && (
                <span className="text-xs text-neutral-400 line-through tabular-nums">
                  {formatINRFixed(pool.basePrice)}
                </span>
              )}
              {pool.savingsPercent > 0 && (
                <span className="text-[10px] font-bold text-savings bg-savings/10 px-2 py-0.5 rounded-full">
                  Save {pool.savingsPercent}%
                </span>
              )}
            </div>

            <p className="text-[11px] text-neutral-500 mt-1">
              SKU: <span className="font-mono font-medium text-neutral-700">{pool.productSku}</span>
            </p>
          </div>
        </section>

        {/* Quantity selector */}
        <QuantityStepper quantity={quantity} onChange={setQuantity} min={1} max={maxQty} disabled={closed || busy} />

        {/* Nudge when user's quantity unlocked a new tier */}
        {projection.newlyUnlocked && !closed && (
          <div
            role="status"
            className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/15 to-emerald-500/10 border border-savings/30 text-xs font-bold text-savings shadow-xs animate-fadeIn flex items-center gap-2.5"
          >
            <span className="text-xl">🎉</span>
            <div>
              <p className="text-neutral-900 font-extrabold text-xs">
                Your order unlocks {projection.newlyUnlocked.discountPercent}% off for everyone.
              </p>
              <p className="text-neutral-600 text-[11px] font-normal mt-0.5">
                Your {quantity} {quantity === 1 ? 'unit takes' : 'units take'} the pool to {projection.projectedQuantity} units.
              </p>
            </div>
          </div>
        )}

        {/* Offer nudge to add more units to unlock the next discount tier */}
        {canAddToUnlock && projection.next && !closed && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setQuantity(quantity + unitsToAdd)}
            className="w-full flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-brand-50/60 to-emerald-50/60 border border-dashed border-brand-400 text-left hover:border-brand-600 hover:bg-brand-50 transition-all disabled:opacity-60 group shadow-xs"
          >
            <span className="text-xs font-semibold text-neutral-800">
              Add <strong className="text-brand-600 font-bold">{unitsToAdd}</strong> more {unitsToAdd === 1 ? 'unit' : 'units'} to unlock{' '}
              <strong className="text-savings font-black underline decoration-savings/40">{projection.next.tier.discountPercent}% off</strong>
            </span>
            <span className="text-xs font-extrabold text-brand-600 bg-white px-2.5 py-1 rounded-lg border border-brand-200 group-hover:bg-brand-600 group-hover:text-white transition-colors shrink-0 shadow-xs">
              +{unitsToAdd}
            </span>
          </button>
        )}

        {/* Flat delivery details */}
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

        {/* Price and discount summary */}
        <PriceSummary
          unitPrice={projection.unitPrice}
          currentUnitPrice={pool.currentUnitPrice}
          basePrice={pool.basePrice}
          quantity={quantity}
          timeRemainingText={time.ended ? 'ended' : time.label}
        />

        {submitError && (
          <p role="alert" className="text-xs font-medium text-red-700 p-3 bg-red-50 rounded-xl border border-red-200">
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
