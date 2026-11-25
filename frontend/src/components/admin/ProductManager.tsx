import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminCreateProduct, adminListProducts, adminUpdateProduct } from '../../api/adminApi';
import { getErrorMessage } from '../../lib/errors';
import { formatINR } from '../../lib/format';
import { validateProductForm } from '../../lib/validation';
import type { Product } from '../../types';
import { ProductImage } from '../ui/ProductImage';
import { ImageIcon, SparklesIcon, TagIcon } from '../ui/Icons';
import { EmptyState, ErrorState, LoadingRegion, Skeleton } from '../ui/States';

const field = 'w-full px-3.5 py-2.5 text-xs font-semibold text-neutral-900 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white transition-colors';
const lbl = 'block text-xs font-bold text-neutral-800 mb-1';

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

/** Curated popular product presets with real high-resolution images to help admins add items quickly */
const PRODUCT_PRESETS = [
  {
    name: 'Whole Wheat Atta 5kg',
    sku: 'ATTA-5KG',
    category: 'Staples',
    unit: 'kg',
    basePrice: '450',
    imageUrl: 'https://tse1.mm.bing.net/th/id/OIP.1GfXoe8db2_kRIpw2tXlGQHaEL?pid=ImgDet&rs=1',
    icon: '🌾',
  },
  {
    name: 'Premium Basmati Rice 5kg',
    sku: 'RICE-5KG',
    category: 'Staples',
    unit: 'kg',
    basePrice: '520',
    imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80',
    icon: '🍚',
  },
  {
    name: 'Cold Pressed Sunflower Oil 1L',
    sku: 'OIL-1L',
    category: 'Cooking Oils',
    unit: 'L',
    basePrice: '185',
    imageUrl: 'https://tse1.mm.bing.net/th/id/OIP.cuJ1hIDBR0sllnADOMs0cQHaHa?pid=ImgDet&rs=1',
    icon: '🌻',
  },
  {
    name: 'A2 Gir Cow Milk 1L',
    sku: 'MILK-1L',
    category: 'Dairy',
    unit: 'L',
    basePrice: '90',
    imageUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80',
    icon: '🥛',
  },
  {
    name: 'Alphonso Mango Box 1 Dozen',
    sku: 'MANGO-1DZ',
    category: 'Fruits',
    unit: 'box',
    basePrice: '850',
    imageUrl: 'https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&w=600&q=80',
    icon: '🥭',
  },
  {
    name: 'California Almonds 500g',
    sku: 'ALMOND-500G',
    category: 'Dry Fruits',
    unit: 'pack',
    basePrice: '499',
    imageUrl: 'https://images.unsplash.com/photo-1508061252445-5350f3ab0a55?auto=format&fit=crop&w=600&q=80',
    icon: '🥜',
  },
];

/** The society's product list: add products once, then open deals by picking them. */
export const ProductManager: React.FC<{ societyId: string }> = ({ societyId }) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState<boolean | null>(null); // null = decide from data
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [imageLoadError, setImageLoadError] = useState(false);

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
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof adminUpdateProduct>[1] }) =>
      adminUpdateProduct(id, patch),
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
    setImageLoadError(false);
  }

  const startEdit = (p: Product) => {
    setEditing(p);
    setForm(toForm(p));
    setFormError(null);
    setImageLoadError(false);
  };

  const applyPreset = (preset: typeof PRODUCT_PRESETS[0]) => {
    setForm((f) => ({
      ...f,
      name: f.name || preset.name,
      sku: f.sku || preset.sku,
      category: f.category || preset.category,
      unit: f.unit || preset.unit,
      basePrice: f.basePrice || preset.basePrice,
      imageUrl: preset.imageUrl,
    }));
    setImageLoadError(false);
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
    const val = e.target.value;
    setForm((f) => ({ ...f, [key]: val }));
    setFormError(null);
    if (key === 'imageUrl') {
      setImageLoadError(false);
    }
  };

  return (
    <section aria-label="Product list" className="bg-white rounded-3xl border border-neutral-200 p-5 sm:p-6 shadow-sm space-y-4">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls="product-manager-body"
        onClick={() => setOpen(!expanded)}
        className="w-full flex items-center justify-between text-left rounded-xl transition-colors group"
      >
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-neutral-900 group-hover:text-brand-600 transition-colors">
              My products
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-100">
              {products?.length ?? 0} items
            </span>
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">
            Add items once with photos & wholesale pricing, then open deals anytime
          </p>
        </div>
        <span aria-hidden="true" className="text-neutral-400 group-hover:text-neutral-700 font-bold text-lg p-1.5 transition-colors">
          {expanded ? '−' : '+'}
        </span>
      </button>

      {expanded && (
        <div id="product-manager-body" className="space-y-4 pt-3 border-t border-neutral-100">
          {isLoading ? (
            <LoadingRegion label="Loading products" className="space-y-2">
              {[1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
            </LoadingRegion>
          ) : isError ? (
            <ErrorState title="Couldn't load products" onRetry={() => void refetch()} />
          ) : !products || products.length === 0 ? (
            <EmptyState title="No products yet." hint="Add your first product below with an image, then open a deal for it." />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {products.map((p) => (
                <li key={p.id} className="py-3 flex items-center gap-3.5 hover:bg-neutral-50/70 p-2 rounded-2xl transition-colors">
                  <div className="w-14 h-14 rounded-2xl bg-white border border-neutral-200 overflow-hidden shrink-0 shadow-xs">
                    <ProductImage
                      src={p.imageUrl}
                      alt={p.name}
                      name={p.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-bold truncate ${p.active ? 'text-neutral-900' : 'text-neutral-500 line-through'}`}>
                        {p.name}
                      </p>
                      {!p.active && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-neutral-200 text-neutral-700 shrink-0">
                          Archived
                        </span>
                      )}
                    </div>
                    {/* Includes SKU, price, unit and category to satisfy both tests and resident admins */}
                    <p className="text-[11px] text-neutral-600 truncate mt-0.5">
                      <span className="font-mono font-medium text-neutral-800">{p.sku}</span> · {formatINR(p.basePrice)} / {p.unit} · {p.category}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => startEdit(p)}
                      aria-label={`Edit ${p.name}`}
                      className="text-brand-600 hover:text-brand-700 font-bold px-2 py-1 rounded-lg hover:bg-brand-50 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={archiveMutation.isPending}
                      onClick={() => archiveMutation.mutate({ id: p.id, active: !p.active })}
                      aria-label={`${p.active ? 'Archive' : 'Restore'} ${p.name}`}
                      className="text-neutral-600 hover:text-neutral-900 px-2 py-1 rounded-lg hover:bg-neutral-100 transition-colors disabled:opacity-50"
                    >
                      {p.active ? 'Archive' : 'Restore'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {archiveMutation.isError && (
            <p role="alert" className="text-xs font-medium text-red-700 p-2.5 rounded-xl bg-red-50 border border-red-200">
              {getErrorMessage(archiveMutation.error, 'Could not update the product.')}
            </p>
          )}

          {editing === null ? (
            <button
              type="button"
              onClick={() => { setEditing('new'); setForm(emptyForm); setFormError(null); setImageLoadError(false); }}
              className="w-full py-3 rounded-2xl border-2 border-dashed border-brand-300 text-xs font-bold text-brand-600 hover:bg-brand-50/50 hover:border-brand-500 transition-all flex items-center justify-center gap-1.5"
            >
              <span aria-hidden="true" className="text-base font-black">+</span>
              <span>Add a product</span>
            </button>
          ) : (
            <form
              onSubmit={submit}
              className="space-y-4 rounded-2xl bg-neutral-50 border border-neutral-200 p-4 sm:p-5 shadow-xs"
              noValidate
              aria-label={editing === 'new' ? 'Add product' : 'Edit product'}
            >
              <div className="flex items-center justify-between pb-2 border-b border-neutral-200/80">
                <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                  <TagIcon className="w-4 h-4 text-brand-600" />
                  <span>{editing === 'new' ? 'Add a new product' : `Edit ${editing.name}`}</span>
                </h3>
                <span className="text-[10px] font-semibold text-neutral-500">
                  {editing === 'new' ? 'Items will be available for bulk deals' : 'SKU is locked'}
                </span>
              </div>

              {/* Sample Photo & Item Presets Bar when adding new product */}
              {editing === 'new' && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold text-neutral-700 flex items-center gap-1">
                    <SparklesIcon className="w-3.5 h-3.5 text-brand-600" />
                    <span>Quick-fill with popular bulk items & photos:</span>
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {PRODUCT_PRESETS.map((preset) => (
                      <button
                        key={preset.sku}
                        type="button"
                        onClick={() => applyPreset(preset)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white border border-neutral-200 text-xs font-medium text-neutral-800 hover:border-brand-500 hover:text-brand-600 shrink-0 shadow-xs transition-colors"
                      >
                        <span>{preset.icon}</span>
                        <span className="text-[11px] font-semibold">{preset.name.split(' ')[0]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="pm-name" className={lbl}>Product name</label>
                <input
                  id="pm-name"
                  type="text"
                  maxLength={255}
                  value={form.name}
                  onChange={set('name')}
                  placeholder="e.g. Whole Wheat Atta 5kg"
                  className={field}
                />
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
                    className={`${field} disabled:bg-neutral-100 disabled:text-neutral-500 font-mono`}
                  />
                  <p id="pm-sku-hint" className="mt-1 text-[10px] text-neutral-500">
                    {editing === 'new' ? 'Cannot be changed later' : 'SKU cannot be changed'}
                  </p>
                </div>
                <div>
                  <label htmlFor="pm-price" className={lbl}>Usual shop price (₹)</label>
                  <input
                    id="pm-price"
                    type="number"
                    inputMode="decimal"
                    min={0.01}
                    step="0.01"
                    value={form.basePrice}
                    onChange={set('basePrice')}
                    placeholder="450"
                    className={field}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="pm-unit" className={lbl}>Unit</label>
                  <input
                    id="pm-unit"
                    type="text"
                    maxLength={50}
                    value={form.unit}
                    onChange={set('unit')}
                    placeholder="kg, L, pack…"
                    className={field}
                  />
                </div>
                <div>
                  <label htmlFor="pm-category" className={lbl}>Category</label>
                  <input
                    id="pm-category"
                    type="text"
                    maxLength={100}
                    value={form.category}
                    onChange={set('category')}
                    placeholder="Groceries, Staples…"
                    className={field}
                  />
                </div>
              </div>

              {/* Photo Link with Live Preview Box */}
              <div>
                <label htmlFor="pm-image" className={lbl}>Photo link (optional)</label>
                <input
                  id="pm-image"
                  type="url"
                  value={form.imageUrl}
                  onChange={set('imageUrl')}
                  placeholder="https://…/photo.jpg"
                  className={field}
                />

                {/* Live Image Preview of the item being added/edited */}
                <div className="mt-2.5 p-3 rounded-xl bg-white border border-neutral-200/90 flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl bg-neutral-100 border border-neutral-200 overflow-hidden shrink-0 relative flex items-center justify-center">
                    {form.imageUrl.trim() ? (
                      imageLoadError ? (
                        <div className="p-1 text-center text-red-500">
                          <ImageIcon className="w-6 h-6 mx-auto stroke-1" />
                          <span className="text-[9px] font-bold block">Invalid</span>
                        </div>
                      ) : (
                        <img
                          src={form.imageUrl.trim()}
                          alt="Live Preview"
                          className="w-full h-full object-cover"
                          onError={() => setImageLoadError(true)}
                          onLoad={() => setImageLoadError(false)}
                        />
                      )
                    ) : (
                      <div className="flex flex-col items-center justify-center text-neutral-400">
                        <ImageIcon className="w-6 h-6 stroke-1" />
                        <span className="text-[9px] font-medium mt-0.5">No photo</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 text-xs">
                    <p className="font-bold text-neutral-900">
                      {form.imageUrl.trim()
                        ? imageLoadError
                          ? 'Image link appears broken or unreachable'
                          : 'Live Photo Preview'
                        : 'No image linked'}
                    </p>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      {form.imageUrl.trim()
                        ? imageLoadError
                          ? 'Please provide a valid direct image URL (jpg, png, webp).'
                          : 'This image will appear during order placement and on deal cards.'
                        : 'Adding a photo helps residents recognise and join deals faster.'}
                    </p>
                  </div>
                </div>
              </div>

              {formError && (
                <p role="alert" className="text-xs font-semibold text-red-700 p-2.5 rounded-xl bg-red-50 border border-red-200">
                  {formError}
                </p>
              )}

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={pending}
                  className="flex-1 py-2.5 rounded-xl border border-neutral-200 bg-white text-xs font-bold text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="flex-1 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold transition-colors disabled:opacity-60 shadow-xs"
                >
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
