import { displayLabel } from '../../lib/displayLabel';
import { HistoryPager } from '../../components/HistoryPager';
import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminCancelPool, adminClosePool, adminCreatePool, adminListPools, adminListProducts } from '../../api/adminApi';
import { EditCutoffDialog } from '../../components/admin/EditCutoffDialog';
import { ProductManager } from '../../components/admin/ProductManager';
import { TierEditor, type AdminTierInput } from '../../components/admin/TierEditor';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ProductImage } from '../../components/ui/ProductImage';
import { EmptyState, ErrorState, LoadingRegion, Skeleton } from '../../components/ui/States';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { getErrorMessage } from '../../lib/errors';
import { formatDateTime, formatINR } from '../../lib/format';
import { validatePoolForm } from '../../lib/validation';
import type { PoolProgress, Product } from '../../types';

const DEFAULT_TIERS: AdminTierInput[] = [
  { minQuantity: 10, discountPercent: 5 },
  { minQuantity: 30, discountPercent: 15 },
  { minQuantity: 50, discountPercent: 20 },
];

const field = 'w-full px-3.5 py-2.5 text-xs font-semibold text-neutral-900 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white transition-colors';
const lbl = 'block text-xs font-bold text-neutral-800 mb-1';
const linkBtn = 'text-[11px] font-semibold underline';

/** Value for <input type="datetime-local" min>, in the user's local time. */
const localNowValue = (): string => {
  const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};

export const SocietyAdminPage: React.FC = () => {
  useDocumentTitle('Pool manager');
  const { societyId } = useParams<{ societyId: string }>();
  const queryClient = useQueryClient();

  const [isFormOpen, setIsFormOpen] = useState(true);
  const [productSku, setProductSku] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [floorPrice, setFloorPrice] = useState('');
  const [cutoffAt, setCutoffAt] = useState('');
  const [tiers, setTiers] = useState<AdminTierInput[]>(DEFAULT_TIERS);
  const [formError, setFormError] = useState<string | null>(null);
  const [closing, setClosing] = useState<PoolProgress | null>(null);
  const [cancelling, setCancelling] = useState<PoolProgress | null>(null);
  const [editingTime, setEditingTime] = useState<PoolProgress | null>(null);

  const [page, setPage] = useState(0);
  const { data: history, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'pools', societyId, page],
    queryFn: () => adminListPools(societyId as string, page),
    enabled: Boolean(societyId),
  });

  const pools = history?.pools;
  const { data: products } = useQuery<Product[]>({
    queryKey: ['admin', 'products', societyId],
    queryFn: () => adminListProducts(societyId as string),
    enabled: Boolean(societyId),
  });
  const activeProducts = useMemo(() => (products ?? []).filter((p) => p.active), [products]);
  const selectedProduct = activeProducts.find((p) => p.sku === productSku);

  const refreshPools = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'pools', societyId] });
    void queryClient.invalidateQueries({ queryKey: ['pools'] });
  };

  const createMutation = useMutation({
    mutationFn: adminCreatePool,
    onSuccess: () => {
      setPage(0);
      refreshPools();
      setProductSku('');
      setBasePrice('');
      setFloorPrice('');
      setCutoffAt('');
      setTiers(DEFAULT_TIERS);
      setFormError(null);
      setIsFormOpen(false);
    },
    onError: (err) => setFormError(getErrorMessage(err, 'Failed to create the pool. Please try again.')),
  });

  const closeMutation = useMutation({
    mutationFn: (id: string) => adminClosePool(id),
    onSuccess: () => {
      refreshPools();
      setClosing(null);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => adminCancelPool(id),
    onSuccess: () => {
      refreshPools();
      setCancelling(null);
    },
  });

  const chooseProduct = (sku: string) => {
    setProductSku(sku);
    setFormError(null);
    const product = activeProducts.find((p) => p.sku === sku);
    // Start from the product's usual price; the admin can still change it for this deal.
    if (product) setBasePrice(String(product.basePrice));
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const error = validatePoolForm({ productSku, basePrice, floorPrice, cutoffAt, tiers });
    if (error) {
      setFormError(error);
      return;
    }
    createMutation.mutate({
      societyId: societyId ?? '',
      productSku: productSku.trim(),
      basePrice: Number(basePrice),
      floorPrice: Number(floorPrice),
      cutoffAt: new Date(cutoffAt).toISOString(),
      tiers: tiers
        .map((t) => ({ minQuantity: Number(t.minQuantity), discountPercent: Number(t.discountPercent) }))
        .sort((a, b) => a.minQuantity - b.minQuantity),
    });
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 bg-brand-500/10 px-2 py-0.5 rounded-md">
            Society admin
          </span>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900 leading-tight mt-1">Pool manager</h1>
        </div>
        <Link
          to={`/s/${societyId ?? ''}`}
          className="text-xs font-semibold text-neutral-700 hover:text-neutral-900 px-3 py-1.5 bg-white border border-neutral-200 rounded-full shadow-xs"
        >
          Resident view
        </Link>
      </header>

      {societyId && <ProductManager societyId={societyId} />}

      <section aria-label="Open a new pool" className="bg-white rounded-3xl border border-neutral-200 p-5 sm:p-6 shadow-sm space-y-4">
        <button
          type="button"
          aria-expanded={isFormOpen}
          aria-controls="new-pool-form"
          onClick={() => setIsFormOpen((v) => !v)}
          className="w-full flex items-center justify-between text-left rounded-lg"
        >
          <div>
            <h2 className="text-base font-bold text-neutral-900">Open a new pool</h2>
            <p className="text-xs text-neutral-600 mt-0.5">Pick a product, set when it closes and the discount ladder</p>
          </div>
          <span aria-hidden="true" className="text-neutral-500 font-bold text-base p-1">{isFormOpen ? '−' : '+'}</span>
        </button>

        {isFormOpen && (
          <form id="new-pool-form" onSubmit={handleCreate} className="space-y-4 pt-2 border-t border-neutral-100" noValidate>
            <div>
              <label htmlFor="productSku" className={lbl}>Product</label>
              <select
                id="productSku"
                value={productSku}
                onChange={(e) => chooseProduct(e.target.value)}
                disabled={!products || activeProducts.length === 0}
                className={`${field} bg-white`}
              >
                <option value="">
                  {!products ? 'Loading products…' : activeProducts.length === 0 ? 'No products yet' : 'Select a product'}
                </option>
                {activeProducts.map((p) => (
                  <option key={p.id} value={p.sku}>
                    {displayLabel(p.name)} ({displayLabel(p.sku)})
                  </option>
                ))}
              </select>
              {products && activeProducts.length === 0 && (
                <p className="mt-2 text-xs text-neutral-600">Add a product in “My products” above first.</p>
              )}
              {selectedProduct && (
                <div className="mt-2.5 flex items-center gap-3 rounded-2xl bg-neutral-50 border border-neutral-200 p-3 shadow-xs">
                  <div className="w-14 h-14 rounded-xl bg-white border border-neutral-200 overflow-hidden shrink-0">
                    <ProductImage
                      src={selectedProduct.imageUrl}
                      alt={displayLabel(selectedProduct.name)}
                      name={displayLabel(selectedProduct.name)}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0 text-xs text-neutral-700">
                    <p className="font-bold text-neutral-900 truncate">{displayLabel(selectedProduct.name)}</p>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      per {selectedProduct.unit} · {selectedProduct.category} · SKU: <span className="font-mono">{displayLabel(selectedProduct.sku)}</span>
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="cutoffAt" className={lbl}>Closes at</label>
              <input
                id="cutoffAt"
                type="datetime-local"
                min={localNowValue()}
                value={cutoffAt}
                onChange={(e) => setCutoffAt(e.target.value)}
                className={field}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="basePrice" className={lbl}>Base retail (₹)</label>
                <input
                  id="basePrice"
                  type="number"
                  inputMode="decimal"
                  min={1}
                  step="0.01"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                  placeholder="200"
                  className={field}
                />
              </div>
              <div>
                <label htmlFor="floorPrice" className={lbl}>Floor minimum (₹)</label>
                <input
                  id="floorPrice"
                  type="number"
                  inputMode="decimal"
                  min={1}
                  step="0.01"
                  value={floorPrice}
                  onChange={(e) => setFloorPrice(e.target.value)}
                  placeholder="140"
                  className={field}
                />
              </div>
            </div>

            <div className="pt-2">
              <TierEditor tiers={tiers} onChange={setTiers} disabled={createMutation.isPending} />
            </div>

            {formError && <p role="alert" className="text-xs font-medium text-red-700 p-2.5 rounded-xl bg-red-50 border border-red-200">{formError}</p>}

            <button
              type="submit"
              disabled={createMutation.isPending || !products || activeProducts.length === 0}
              className="w-full py-3 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs transition-colors disabled:opacity-60 shadow-xs"
            >
              {createMutation.isPending ? 'Creating pool…' : 'Create pool'}
            </button>
          </form>
        )}
      </section>

      <section aria-label="Existing pools" className="bg-white rounded-3xl border border-neutral-200 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-neutral-900">Existing pools</h2>
          {history && <span className="text-xs font-semibold text-neutral-600">{history.total} total</span>}
        </div>

        {isLoading ? (
          <LoadingRegion label="Loading pools" className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
          </LoadingRegion>
        ) : isError ? (
          <ErrorState title="Couldn't load society pools" onRetry={() => void refetch()} />
        ) : !pools || pools.length === 0 ? (
          <EmptyState title="No pools yet." />
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-left text-xs">
              <caption className="sr-only">Pools for this society</caption>
              <thead>
                <tr className="border-b border-neutral-100 text-[11px] font-bold uppercase tracking-wider text-neutral-600">
                  <th scope="col" className="py-2.5">Product</th>
                  <th scope="col" className="py-2.5">Status</th>
                  <th scope="col" className="py-2.5 text-right">Units</th>
                  <th scope="col" className="py-2.5 text-right">Price</th>
                  <th scope="col" className="py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {pools.map((pool) => (
                  <tr key={pool.poolWindowId} className="hover:bg-neutral-50/60 transition-colors">
                    <td className="py-3 pr-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-lg bg-neutral-100 border border-neutral-200 overflow-hidden shrink-0 shadow-xs">
                          <ProductImage
                            src={pool.imageUrl}
                            alt={displayLabel(pool.productName)}
                            name={displayLabel(pool.productName)}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-neutral-900 line-clamp-1">{displayLabel(pool.productName)}</p>
                          <span className="text-[10px] text-neutral-500">Closes {formatDateTime(pool.cutoffAt)}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-1"><StatusBadge status={pool.status} /></td>
                    <td className="py-3 text-right font-semibold text-neutral-900 tabular-nums">{pool.aggregateQuantity}</td>
                    <td className="py-3 text-right font-bold text-neutral-900 tabular-nums">{formatINR(pool.currentUnitPrice)}</td>
                    <td className="py-3 text-right pl-2">
                      <div className="flex flex-wrap justify-end gap-x-3 gap-y-1">
                        {pool.status === 'OPEN' && (
                          <>
                            <button
                              type="button"
                              onClick={() => setEditingTime(pool)}
                              aria-label={`Change closing time of ${displayLabel(pool.productName)}`}
                              className={`${linkBtn} text-brand-600 hover:text-brand-700`}
                            >
                              Edit time
                            </button>
                            <button
                              type="button"
                              onClick={() => { closeMutation.reset(); setClosing(pool); }}
                              aria-label={`Close ${displayLabel(pool.productName)} now`}
                              className={`${linkBtn} text-neutral-700 hover:text-neutral-900`}
                            >
                              Close now
                            </button>
                          </>
                        )}
                        {pool.status === 'LOCKED' && (
                          <Link to={`/admin/pools/${pool.poolWindowId}/dispatch`} className={`${linkBtn} text-brand-600 hover:text-brand-700`}>
                            Dispatch
                          </Link>
                        )}
                        {(pool.status === 'DISPATCHED' || pool.status === 'DELIVERED') && (
                          <Link to={`/admin/pools/${pool.poolWindowId}/dispatch`} className={`${linkBtn} text-neutral-700 hover:text-neutral-900`}>
                            View PO
                          </Link>
                        )}
                        {(pool.status === 'OPEN' || pool.status === 'LOCKED') && (
                          <button
                            type="button"
                            onClick={() => { cancelMutation.reset(); setCancelling(pool); }}
                            aria-label={`Cancel ${displayLabel(pool.productName)}`}
                            className={`${linkBtn} text-red-700 hover:text-red-800`}
                          >
                            Cancel
                          </button>
                        )}
                        {pool.status === 'CANCELLED' && <span className="text-[10px] text-neutral-500">—</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <HistoryPager page={page} total={history?.total ?? 0} onPage={setPage} />
      </section>

      <EditCutoffDialog pool={editingTime} onClose={() => setEditingTime(null)} />

      <ConfirmDialog
        open={closing !== null}
        title="Close this pool now?"
        confirmLabel="Yes, close pool"
        pendingLabel="Closing…"
        destructive
        pending={closeMutation.isPending}
        error={closeMutation.error ? getErrorMessage(closeMutation.error, 'Could not close the pool. Try again.') : null}
        onCancel={() => setClosing(null)}
        onConfirm={() => closing && closeMutation.mutate(closing.poolWindowId)}
      >
        Residents will no longer be able to join <strong className="text-neutral-900">{displayLabel(closing?.productName ?? '')}</strong> and the price will be settled at{' '}
        {closing ? formatINR(closing.currentUnitPrice) : ''} per unit.
      </ConfirmDialog>

      <ConfirmDialog
        open={cancelling !== null}
        title="Cancel this deal?"
        confirmLabel="Yes, cancel deal"
        pendingLabel="Cancelling…"
        destructive
        pending={cancelMutation.isPending}
        error={cancelMutation.error ? getErrorMessage(cancelMutation.error, 'Could not cancel the deal. Try again.') : null}
        onCancel={() => setCancelling(null)}
        onConfirm={() => cancelling && cancelMutation.mutate(cancelling.poolWindowId)}
      >
        <strong className="text-neutral-900">{displayLabel(cancelling?.productName ?? '')}</strong> will be cancelled
        {cancelling && cancelling.participantCount > 0
          ? ` and the orders of ${cancelling.participantCount} ${cancelling.participantCount === 1 ? 'neighbour' : 'neighbours'} will be cancelled with it`
          : ''}
        . This cannot be undone.
      </ConfirmDialog>
    </div>
  );
};

export default SocietyAdminPage;
