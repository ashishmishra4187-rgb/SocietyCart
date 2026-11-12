import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminDeliverPool, adminDispatchPool, adminGetPool } from '../../api/adminApi';
import { PackingListCard } from '../../components/admin/PackingListCard';
import { BackLink } from '../../components/ui/BackLink';
import { CheckCircle, InfoCircle } from '../../components/ui/Icons';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ErrorState, LoadingRegion, Skeleton } from '../../components/ui/States';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAuthContext } from '../../context/AuthContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { getErrorMessage } from '../../lib/errors';
import { formatDateTime, formatINR, lineTotal } from '../../lib/format';
import type { AdminPoolDetail } from '../../types';

export const PoolDispatchPage: React.FC = () => {
  useDocumentTitle('Supplier dispatch');
  const { id } = useParams<{ id: string }>();
  const { session } = useAuthContext();
  const queryClient = useQueryClient();
  const [showConfirm, setShowConfirm] = useState(false);

  const adminHome = session?.societyId ? `/admin/s/${session.societyId}` : '/';

  const { data: pool, isLoading, isError, refetch } = useQuery<AdminPoolDetail>({
    queryKey: ['admin', 'pool', id],
    queryFn: () => adminGetPool(id as string),
    enabled: Boolean(id),
  });

  const dispatchMutation = useMutation({
    mutationFn: () => adminDispatchPool(id as string),
    onSuccess: async () => {
      setShowConfirm(false);
      // Take the real dispatch timestamp and status from the server rather than faking them.
      await queryClient.invalidateQueries({ queryKey: ['admin', 'pool', id] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'pools'] });
      void queryClient.invalidateQueries({ queryKey: ['pools'] });
    },
  });

  const deliverMutation = useMutation({
    mutationFn: () => adminDeliverPool(id as string),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'pool', id] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'pools'] });
    },
  });

  if (isLoading) {
    return (
      <LoadingRegion label="Loading purchase order" className="space-y-4">
        <Skeleton className="h-6 w-32 rounded-full" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </LoadingRegion>
    );
  }

  if (isError || !pool) {
    return (
      <ErrorState
        fullPage
        title="Couldn't load pool for dispatch"
        message="Check your connection or make sure the pool ID is valid."
        onRetry={() => void refetch()}
        backTo={adminHome}
        backLabel="Back to admin"
      />
    );
  }

  if (pool.status === 'OPEN') {
    return (
      <ErrorState
        fullPage
        title="This pool hasn't closed yet"
        message="A consolidated supplier PO can't be dispatched while resident ordering is still open."
        backTo={adminHome}
        backLabel="Go to admin and close the pool"
      />
    );
  }

  if (pool.status === 'CANCELLED') {
    return (
      <ErrorState
        fullPage
        title="This deal was cancelled"
        message="No purchase order was sent to the supplier for it."
        backTo={adminHome}
        backLabel="Back to admin"
      />
    );
  }

  const po = pool.supplierPOPayload;
  if (!po) {
    return (
      <ErrorState
        fullPage
        title="Purchase order not ready"
        message="The supplier PO for this pool hasn't been generated yet. Try again in a moment."
        onRetry={() => void refetch()}
        backTo={adminHome}
        backLabel="Back to admin"
      />
    );
  }

  const isLocked = pool.status === 'LOCKED';
  const isDispatched = pool.status === 'DISPATCHED' || pool.status === 'DELIVERED';
  const totalValue = lineTotal(po.agreedUnitPrice, po.totalQuantity);
  const dispatchedAt = po.dispatchedAt ?? pool.dispatchedAt;

  return (
    <div className="space-y-4">
      <nav aria-label="Breadcrumb" className="flex items-center justify-between">
        <BackLink to={adminHome}>Back to admin</BackLink>
        <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 bg-brand-500/10 px-2.5 py-0.5 rounded-md">Supplier dispatch</span>
      </nav>

      <header className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm space-y-2">
        <div className="flex items-center justify-between gap-2">
          <StatusBadge status={pool.status} />
          <span className="text-xs text-neutral-600 font-mono">PO-{pool.poolWindowId.slice(-6).toUpperCase()}</span>
        </div>
        <h1 className="text-xl font-bold tracking-tight text-neutral-900 leading-tight">{pool.productName}</h1>
        {isDispatched && dispatchedAt && (
          <p className="text-xs font-medium text-neutral-600">Dispatched on {formatDateTime(dispatchedAt, true)}</p>
        )}
      </header>

      <section aria-label="Supplier purchase order" className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm space-y-3.5">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-700">Supplier purchase order</h2>
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 font-semibold">Consolidated PO</span>
        </div>

        <div className="space-y-2 text-xs">
          <div>
            <span className="text-neutral-600 font-medium block text-[11px]">Consignee / society</span>
            <p className="font-bold text-neutral-900 mt-0.5">{po.societyName}</p>
          </div>
          <div>
            <span className="text-neutral-600 font-medium block text-[11px]">Delivery drop-off address</span>
            <p className="font-medium text-neutral-800 mt-0.5 leading-relaxed">{po.deliveryAddress}</p>
          </div>

          <dl className="mt-3 p-3.5 bg-neutral-900 text-neutral-100 rounded-xl font-mono text-xs space-y-2 border border-neutral-800">
            <div className="flex justify-between"><dt className="text-neutral-300">SKU code</dt><dd className="font-bold text-white">{po.sku}</dd></div>
            <div className="flex justify-between"><dt className="text-neutral-300">Total pooled units</dt><dd className="font-bold text-green-400">{po.totalQuantity} units</dd></div>
            <div className="flex justify-between"><dt className="text-neutral-300">Agreed unit rate</dt><dd className="font-bold text-white">{formatINR(po.agreedUnitPrice)}</dd></div>
            <div className="flex justify-between pt-1.5 border-t border-neutral-800"><dt className="text-neutral-300">Expected delivery by</dt><dd className="text-amber-300">{formatDateTime(po.requiredBy)}</dd></div>
          </dl>
        </div>
      </section>

      <section aria-label="Participation summary" className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-sm grid grid-cols-3 gap-3 text-center">
        {[
          ['Residents', String(pool.participantCount), 'text-neutral-900'],
          ['Units', String(po.totalQuantity), 'text-neutral-900'],
          ['Total value', formatINR(totalValue), 'text-brand-600'],
        ].map(([label, value, color], i) => (
          <div key={label} className={`p-2 ${i === 1 ? 'border-x border-neutral-100' : ''}`}>
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-600 block mb-0.5">{label}</span>
            <p className={`text-lg font-extrabold tabular-nums ${color}`}>{value}</p>
          </div>
        ))}
      </section>

      <PackingListCard poolId={pool.poolWindowId} />

      {dispatchMutation.isError && !showConfirm && (
        <p role="alert" className="flex items-start gap-2 text-xs font-medium text-red-800 bg-red-50 border border-red-200 rounded-xl p-3">
          <InfoCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {getErrorMessage(dispatchMutation.error, 'Dispatch failed. Please try again.')}
        </p>
      )}

      <ConfirmDialog
        open={showConfirm}
        title="Confirm supplier dispatch"
        confirmLabel="Yes, dispatch"
        pendingLabel="Dispatching…"
        pending={dispatchMutation.isPending}
        error={dispatchMutation.isError ? getErrorMessage(dispatchMutation.error, 'Dispatch failed. Please try again.') : null}
        onCancel={() => setShowConfirm(false)}
        onConfirm={() => dispatchMutation.mutate()}
      >
        Send a <strong className="text-neutral-900">{po.totalQuantity}-unit</strong> order at{' '}
        <strong className="text-neutral-900">{formatINR(po.agreedUnitPrice)}/unit</strong> to the supplier? This cannot be undone.
      </ConfirmDialog>

      <aside aria-label="Dispatch actions" className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-neutral-200 py-3 px-4 pb-safe shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
        <div className="max-w-[640px] mx-auto">
          {pool.status === 'DISPATCHED' ? (
            <div className="space-y-2">
              {deliverMutation.isError && (
                <p role="alert" className="text-xs font-medium text-red-700 text-center">
                  {getErrorMessage(deliverMutation.error, 'Could not update delivery status.')}
                </p>
              )}
              <button
                type="button"
                disabled={deliverMutation.isPending}
                onClick={() => deliverMutation.mutate()}
                className="w-full py-3.5 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
              >
                {deliverMutation.isPending ? 'Updating…' : 'Mark as delivered to residents'}
              </button>
            </div>
          ) : isDispatched ? (
            <div className="w-full py-3 px-4 rounded-xl bg-neutral-100 text-neutral-700 font-semibold text-xs text-center border border-neutral-200 flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4 text-savings" />
              <span>{pool.status === 'DELIVERED' ? 'Delivered to residents' : 'Dispatched to supplier'}</span>
            </div>
          ) : (
            <button
              type="button"
              disabled={!isLocked || dispatchMutation.isPending}
              onClick={() => { dispatchMutation.reset(); setShowConfirm(true); }}
              className="w-full py-3.5 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
            >
              Dispatch to supplier ({po.totalQuantity} units)
            </button>
          )}
        </div>
      </aside>
    </div>
  );
};
export default PoolDispatchPage;
