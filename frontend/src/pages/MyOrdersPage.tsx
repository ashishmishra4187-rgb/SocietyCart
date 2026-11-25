import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cancelOrder, myOrders } from '../api/orderApi';
import { OrderCard } from '../components/OrderCard';
import { EmptyState, ErrorState, LoadingRegion, Skeleton } from '../components/ui/States';
import { useAuthContext } from '../context/AuthContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { getErrorMessage } from '../lib/errors';
import { formatINR } from '../lib/format';
import { HistoryPager } from '../components/HistoryPager';

type TabType = 'active' | 'past';


const tabClass = (on: boolean) =>
  `flex-1 py-2 text-xs font-bold rounded-lg transition-all ${on ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-600 hover:text-neutral-900'}`;

export const MyOrdersPage: React.FC = () => {
  useDocumentTitle('My orders');
  const location = useLocation();
  const queryClient = useQueryClient();
  const { session } = useAuthContext();

  const [tab, setTab] = useState<TabType>('active');
  const [page, setPage] = useState(0);
  const [showBanner, setShowBanner] = useState(() => Boolean((location.state as { justJoined?: boolean } | null)?.justJoined));
  const [cancelError, setCancelError] = useState<string | null>(null);

  const { data: history, isLoading, isError, refetch } = useQuery({
    queryKey: ['orders', 'me', session?.residentId, tab, page],
    queryFn: () => myOrders(tab === 'past', page),
    staleTime: 10 * 1000,
    // Prices of open orders keep improving as neighbours join: refresh while any order is still open.
    refetchInterval: (query) => (query.state.data?.orders.some((o) => o.priceIsFinal === false) ? 15_000 : false),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ poolId, orderId }: { poolId: string; orderId: string }) => cancelOrder(poolId, orderId),
    onMutate: () => setCancelError(null),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['pools'] });
    },
    onError: (err) => setCancelError(getErrorMessage(err, 'Could not cancel the order. It may already be locked.')),
  });

  const shown = history?.orders ?? [];
  const selectTab = (next: TabType) => { setTab(next); setPage(0); };
  const societyRoute = session?.societyId ? `/s/${session.societyId}` : '/';
  const cancellingId = cancelMutation.isPending ? cancelMutation.variables?.orderId : undefined;

  return (
    <>
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold tracking-tight text-neutral-900 leading-tight">My orders</h1>
        <Link to={societyRoute} className="text-xs font-semibold text-brand-600 hover:text-brand-700 rounded-lg px-2 py-1">
          View deals
        </Link>
      </header>

      {showBanner && (
        <div role="status" className="mb-4 p-3.5 rounded-2xl bg-savings/10 border border-savings/20 flex items-center justify-between gap-3 shadow-xs animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <div aria-hidden="true" className="w-8 h-8 rounded-full bg-savings text-white flex items-center justify-center shrink-0 font-bold text-sm">
              ✓
            </div>
            <div>
              <p className="text-xs font-bold text-neutral-900">You're in!</p>
              <p className="text-[11px] text-neutral-700 font-medium">Your order has been added to the deal pool.</p>
            </div>
          </div>
          <button type="button" onClick={() => setShowBanner(false)} aria-label="Dismiss" className="text-neutral-600 hover:text-neutral-900 p-2 rounded-lg text-xs font-bold">
            ✕
          </button>
        </div>
      )}

      {cancelError && (
        <p role="alert" className="mb-3 p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-800">
          {cancelError}
        </p>
      )}

      <div className="flex bg-neutral-200/60 p-1 rounded-xl mb-4" role="tablist" aria-label="Order status">
        <button type="button" role="tab" aria-selected={tab === 'active'} onClick={() => selectTab('active')} className={tabClass(tab === 'active')}>
          Active ({history?.active ?? 0})
        </button>
        <button type="button" role="tab" aria-selected={tab === 'past'} onClick={() => selectTab('past')} className={tabClass(tab === 'past')}>
          Past ({history?.past ?? 0})
        </button>
      </div>

      <div role="tabpanel" aria-label={tab === 'active' ? 'Active orders' : 'Past orders'}>
        {isLoading ? (
          <LoadingRegion label="Loading orders" className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-neutral-200 p-3.5 shadow-sm flex gap-3.5">
                <Skeleton className="w-16 h-16 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </LoadingRegion>
        ) : isError ? (
          <ErrorState title="Couldn't load orders" onRetry={() => void refetch()} />
        ) : shown.length === 0 ? (
          tab === 'active' ? (
            <EmptyState title="No live orders.">
              <Link to={societyRoute} className="inline-block text-xs font-bold text-brand-600 hover:text-brand-700 underline">
                Browse today's deals
              </Link>
            </EmptyState>
          ) : (
            <EmptyState title="Nothing here yet." />
          )
        ) : (
          <ul className="space-y-3">
            {shown.map((order) => (
              <li key={order.orderId}>
                <OrderCard
                  order={order}
                  isCancelling={cancellingId === order.orderId}
                  onCancel={(poolId, orderId) => cancelMutation.mutate({ poolId, orderId })}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <HistoryPager page={page} total={history?.[tab] ?? 0} onPage={setPage} />
      {tab === 'past' && history && history.saved > 0 && (
        <aside aria-label="Savings summary" className="mt-5 p-4 rounded-2xl bg-savings/10 border border-savings/20 text-center">
          <p className="text-xs font-bold text-neutral-900">
            You've saved <span className="text-savings font-extrabold">{formatINR(history.saved)}</span> on delivered orders.
          </p>
        </aside>
      )}
    </>
  );
};
export default MyOrdersPage;
