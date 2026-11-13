import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getOrder } from '../api/orderApi';
import { BackLink } from '../components/ui/BackLink';
import { CheckCircle, HomeIcon } from '../components/ui/Icons';
import { ErrorState, LoadingRegion, Skeleton } from '../components/ui/States';
import { StatusBadge } from '../components/ui/StatusBadge';
import { useAuthContext } from '../context/AuthContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { formatINR, lineTotal, round2 } from '../lib/format';
import { deriveTiers } from '../lib/pool';
import type { OrderDetailResponse } from '../types';

const Step: React.FC<{ done: boolean; n: number; label: string }> = ({ done, n, label }) => (
  <li className="flex flex-col items-center gap-1.5 z-10" aria-label={`${label}: ${done ? 'done' : 'pending'}`}>
    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${done ? 'bg-brand-500 text-white' : 'bg-neutral-200 text-neutral-700'}`}>
      {done ? '✓' : n}
    </div>
    <span className="text-[10px] font-medium text-neutral-700">{label}</span>
  </li>
);

export const OrderDetailPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const { session } = useAuthContext();
  const { data: order, isLoading, isError, refetch } = useQuery<OrderDetailResponse>({
    queryKey: ['order', orderId],
    queryFn: () => getOrder(orderId as string),
    enabled: Boolean(orderId),
    // While the pool is open the price can still drop as neighbours join, so keep it fresh.
    refetchInterval: (query) => (query.state.data?.priceIsFinal === false ? 10_000 : false),
  });
  useDocumentTitle(order ? `Order · ${order.productName}` : 'Order');

  if (isLoading) {
    return (
      <LoadingRegion label="Loading order" className="space-y-4">
        <Skeleton className="h-8 w-24 rounded-full" />
        <div className="max-w-sm mx-auto bg-white rounded-2xl border border-neutral-200 p-6 space-y-5">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-28" />
          <Skeleton className="h-16" />
        </div>
      </LoadingRegion>
    );
  }

  if (isError || !order) {
    return <ErrorState fullPage title="Couldn't load order details" onRetry={() => void refetch()} backTo="/orders" backLabel="Back to orders" />;
  }

  const isFinal = order.priceIsFinal !== false;
  const retailTotal = lineTotal(order.basePrice, order.quantity);
  const saved = Math.max(0, round2(retailTotal - order.totalAmount));
  const achieved = order.pool ? deriveTiers(order.pool).filter((t) => t.achieved).pop() : undefined;

  const closed = order.status !== 'COMMITTED';
  const outForDelivery = order.status === 'DISPATCHED' || order.status === 'DELIVERED';
  const progressWidth = outForDelivery ? 'calc(100% - 32px)' : closed ? 'calc(50% - 16px)' : '0%';
  const flat = order.flatNumber ?? session?.flatNumber;

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-4">
        <BackLink to="/orders">Back to orders</BackLink>
      </nav>

      <article className="max-w-sm mx-auto bg-white rounded-2xl border border-neutral-200 shadow-sm p-5 sm:p-6 space-y-5">
        <header className="space-y-2">
          <div className="flex items-center justify-between">
            <StatusBadge status={order.status} />
            <span className="text-[11px] font-medium text-neutral-600 font-mono">#{order.orderId.slice(-6).toUpperCase()}</span>
          </div>
          <h1 className="text-base font-bold text-neutral-900 leading-snug">{order.productName}</h1>
        </header>

        <dl className="space-y-2.5 pt-2 border-t border-neutral-100 text-xs">
          {[
            ['Units', String(order.quantity)],
            [isFinal ? 'Your unit price' : 'Your unit price today', formatINR(order.unitPriceAtCommit)],
            ['Subtotal', formatINR(order.totalAmount)],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between items-center text-neutral-700">
              <dt>{k}</dt>
              <dd className="font-semibold text-neutral-900 tabular-nums">{v}</dd>
            </div>
          ))}

          {/* CHANGED: show the retail price and "saved" rows only when there is a real saving */}
          {saved > 0 ? (
            <>
              <div className="flex justify-between items-center text-neutral-700">
                <dt>Retail price</dt>
                <dd className="line-through text-neutral-500 tabular-nums">{formatINR(retailTotal)}</dd>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-neutral-100 text-savings font-bold">
                <dt>{isFinal ? 'You saved' : 'You are saving so far'}</dt>
                <dd className="text-sm font-extrabold tabular-nums">{formatINR(saved)}</dd>
              </div>
            </>
          ) : (
            !isFinal && (
              <div className="pt-2 border-t border-neutral-100 text-xs font-medium text-neutral-600">
                No discount yet. Your price drops as more neighbours join.
              </div>
            )
          )}
        </dl>

        {!isFinal && (
          <p role="status" className="p-3 bg-brand-50 border border-brand-200 rounded-xl text-[11px] leading-relaxed font-medium text-brand-900">
            The final price is set when the pool closes. If more neighbours join, your price drops further. It will never go
            above what you were quoted.
          </p>
        )}

        {achieved && (
          <div className="p-3 bg-savings/10 border border-savings/20 rounded-xl text-xs font-semibold text-neutral-900 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-savings shrink-0" />
            <span>
              Tier unlocked: <strong className="text-savings">{achieved.discountPercent}% off</strong> at {achieved.minQuantity} units
            </span>
          </div>
        )}

        <section aria-label="Order timeline" className="pt-2 border-t border-neutral-100">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-neutral-600 mb-3">Timeline</h2>
          <ol className="relative flex items-center justify-between">
            <div className="absolute top-2.5 left-4 right-4 h-0.5 bg-neutral-200" aria-hidden="true" />
            <div className="absolute top-2.5 left-4 h-0.5 bg-brand-500 transition-all duration-300" style={{ width: progressWidth }} aria-hidden="true" />
            <Step done n={1} label="Joined" />
            <Step done={closed} n={2} label="Pool closed" />
            <Step done={outForDelivery} n={3} label="Out for delivery" />
          </ol>
        </section>

        <section aria-label="Delivery location" className="border-t border-neutral-100 bg-neutral-50 -mx-5 -mb-5 sm:-mx-6 sm:-mb-6 p-4 rounded-b-2xl">
          <div className="flex items-start gap-2.5">
            <HomeIcon className="w-4 h-4 text-neutral-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-bold text-neutral-900">{flat ? `Delivery to flat ${flat}` : 'Delivery to your door'}</p>
              <p className="text-neutral-600 mt-0.5 text-[11px]">Drop-off at your door upon bulk dispatch.</p>
            </div>
          </div>
        </section>
      </article>
    </>
  );
};
export default OrderDetailPage;