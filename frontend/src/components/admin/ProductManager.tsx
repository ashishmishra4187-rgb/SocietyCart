import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminCreateProduct, adminListProducts, adminUpdateProduct } from '../../api/adminApi';
import { getErrorMessage } from '../../lib/errors';
import { formatINR } from '../../lib/format';
import { validateProductForm } from '../../lib/validation';
import type { Product } from '../../types';
import { EmptyState, ErrorState, LoadingRegion, Skeleton } from '../ui/States';

const field = 'w-full px-3.5 py-2 text-xs font-semibold text-neutral-900 border border-neutral-300 rounded-xl';
const lbl = 'block text-xs font-semibold text-neutral-800 mb-1';

interface FormState {
  sku: string;
  name: string;
  basePrice: string;
  unit: string;
  category: string;
  imageUrl: string;
}

const emptyForm: FormState = { sku: '', name: '', basePrice: '', unit: '', category: '', imageUrl: '' };

const toForm = (p: Product): FormState => ({
  sku: p.sku,
  name: p.name,
  basePrice: String(p.basePrice),
  unit: p.unit,
  category: p.category,
  imageUrl: p.imageUrl ?? '',
});

const Thumb: React.FC<{ product: Product }> = ({ product }) => (
  <div className="w-11 h-11 rounded-lg bg-neutral-100 border border-neutral-200 overflow-hidden shrink-0 flex items-center justify-center">
    {product.imageUrl ? (
      <img src={product.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
    ) : (
      <span className="text-sm font-bold text-neutral-500" aria-hidden="true">{product.name.charAt(0).toUpperCase()}</span>
    )}
  </div>
);

/** The society's product list: add products once, then open deals by picking them. */
export const ProductManager: React.FC<{ societyId: string }> = ({ societyId }) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState<boolean | null>(null); // null = decide from data
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: products, isLoading, isError, refetch } = useQuery<Product[]>({
    queryKey: ['admin', 'products', societyId],
    queryFn: () => adminListProducts(societyId),
    enabled: Boolean(societyId),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'products', societyId] });

  const createMutation = useMutation({
    mutationFn: adminCreateProduct,
    onSuccess: () => {
      void refresh();
      closeForm();
    },
    onError: (err) => setFormError(getErrorMessage(err, 'Could not add the product. Please try again.')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof adminUpdateProduct>[1] }) => adminUpdateProduct(id, patch),
    onSuccess: () => {
      void refresh();
      closeForm();
    },
    onError: (err) => setFormError(getErrorMessage(err, 'Could not update the product. Please try again.')),
  });

  const archiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => adminUpdateProduct(id, { active }),
    onSuccess: () => void refresh(),
  });

  const pending = createMutation.isPending || updateMutation.isPending;
  // Show the list by default, and the "add" form straight away while the catalog is still empty.
  const expanded = open ?? true;

  function closeForm() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
  }

  const startEdit = (p: Product) => {
    setEditing(p);
    setForm(toForm(p));
    setFormError(null);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const error = validateProductForm(form);
    if (error) {
      setFormError(error);
      return;
    }
    if (editing === 'new') {
      createMutation.mutate({
        societyId,
        sku: form.sku.trim(),
        name: form.name.trim(),
        basePrice: Number(form.basePrice),
        ...(form.unit.trim() ? { unit: form.unit.trim() } : {}),
        ...(form.category.trim() ? { category: form.category.trim() } : {}),
        ...(form.imageUrl.trim() ? { imageUrl: form.imageUrl.trim() } : {}),
      });
    } else if (editing) {
      updateMutation.mutate({
        id: editing.id,
        patch: {
          name: form.name.trim(),
          basePrice: Number(form.basePrice),
          unit: form.unit.trim() || editing.unit,
          category: form.category.trim() || editing.category,
          // an empty string clears the photo on the server
          imageUrl: form.imageUrl.trim(),
        },
      });
    }
  };

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setFormError(null);
  };

  return (
    <section aria-label="Product list" className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm space-y-4">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls="product-manager-body"
        onClick={() => setOpen(!expanded)}
        className="w-full flex items-center justify-between text-left rounded-lg"
      >
        <div>
          <h2 className="text-base font-bold text-neutral-900">My products</h2>
          <p className="text-xs text-neutral-600 mt-0.5">Add a product once, then open deals by picking it</p>
        </div>
        <span aria-hidden="true" className="text-neutral-500 font-bold text-base p-1">{expanded ? '−' : '+'}</span>
      </button>

      {expanded && (
        <div id="product-manager-body" className="space-y-4 pt-2 border-t border-neutral-100">
          {isLoading ? (
            <LoadingRegion label="Loading products" className="space-y-2">
              {[1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
            </LoadingRegion>
          ) : isError ? (
            <ErrorState title="Couldn't load products" onRetry={() => void refetch()} />
          ) : !products || products.length === 0 ? (
            <EmptyState title="No products yet." hint="Add your first product below, then open a deal for it." />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {products.map((p) => (
                <li key={p.id} className="py-2.5 flex items-center gap-3">
                  <Thumb product={p} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold truncate ${p.active ? 'text-neutral-900' : 'text-neutral-500'}`}>
                      {p.name}
                      {!p.active && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 align-middle">Archived</span>}
                    </p>
                    <p className="text-[11px] text-neutral-600 truncate">
                      {formatINR(p.basePrice)} / {p.unit} · {p.category}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-[11px] font-semibold">
                    <button type="button" onClick={() => startEdit(p)} aria-label={`Edit ${p.name}`} className="text-brand-600 hover:text-brand-700 underline">
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={archiveMutation.isPending}
                      onClick={() => archiveMutation.mutate({ id: p.id, active: !p.active })}
                      aria-label={`${p.active ? 'Archive' : 'Restore'} ${p.name}`}
                      className="text-neutral-700 hover:text-neutral-900 underline disabled:opacity-50"
                    >
                      {p.active ? 'Archive' : 'Restore'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {archiveMutation.isError && (
            <p role="alert" className="text-xs font-medium text-red-700">{getErrorMessage(archiveMutation.error, 'Could not update the product.')}</p>
          )}

          {editing === null ? (
            <button
              type="button"
              onClick={() => { setEditing('new'); setForm(emptyForm); setFormError(null); }}
              className="w-full py-2.5 rounded-xl border border-dashed border-neutral-300 text-xs font-semibold text-brand-600 hover:bg-neutral-50"
            >
              + Add a product
            </button>
          ) : (
            <form onSubmit={submit} className="space-y-3 rounded-xl bg-neutral-50 border border-neutral-200 p-4" noValidate aria-label={editing === 'new' ? 'Add product' : 'Edit product'}>
              <h3 className="text-sm font-bold text-neutral-900">{editing === 'new' ? 'Add a product' : `Edit ${editing.name}`}</h3>
              <div>
                <label htmlFor="pm-name" className={lbl}>Product name</label>
                <input id="pm-name" type="text" maxLength={255} value={form.name} onChange={set('name')} placeholder="e.g. Whole Wheat Atta 5kg" className={field} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="pm-sku" className={lbl}>SKU</label>
                  <input
                    id="pm-sku"
                    type="text"
                    value={form.sku}
                    onChange={set('sku')}
                    disabled={editing !== 'new'}
                    placeholder="ATTA-5KG"
                    aria-describedby="pm-sku-hint"
                    className={`${field} disabled:bg-neutral-100 disabled:text-neutral-500`}
                  />
                  <p id="pm-sku-hint" className="mt-1 text-[10px] text-neutral-500">{editing === 'new' ? 'Cannot be changed later' : 'SKU cannot be changed'}</p>
                </div>
                <div>
                  <label htmlFor="pm-price" className={lbl}>Usual shop price (₹)</label>
                  <input id="pm-price" type="number" inputMode="decimal" min={0.01} step="0.01" value={form.basePrice} onChange={set('basePrice')} placeholder="450" className={field} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="pm-unit" className={lbl}>Unit</label>
                  <input id="pm-unit" type="text" maxLength={50} value={form.unit} onChange={set('unit')} placeholder="kg, L, pack…" className={field} />
                </div>
                <div>
                  <label htmlFor="pm-category" className={lbl}>Category</label>
                  <input id="pm-category" type="text" maxLength={100} value={form.category} onChange={set('category')} placeholder="Groceries" className={field} />
                </div>
              </div>
              <div>
                <label htmlFor="pm-image" className={lbl}>Photo link (optional)</label>
                <input id="pm-image" type="url" value={form.imageUrl} onChange={set('imageUrl')} placeholder="https://…/photo.jpg" className={field} />
              </div>

              {formError && <p role="alert" className="text-xs font-medium text-red-700">{formError}</p>}

              <div className="flex gap-2.5">
                <button type="button" onClick={closeForm} disabled={pending} className="flex-1 py-2.5 rounded-xl border border-neutral-200 bg-white text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">
                  Cancel
                </button>
                <button type="submit" disabled={pending} className="flex-1 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold disabled:opacity-60">
                  {pending ? 'Saving…' : editing === 'new' ? 'Add product' : 'Save changes'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </section>
  );
};
export default ProductManager;