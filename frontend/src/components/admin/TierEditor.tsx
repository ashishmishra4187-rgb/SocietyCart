import React from 'react';
import { MAX_DISCOUNT, MAX_TIERS, type TierInput } from '../../lib/validation';
import { XIcon } from '../ui/Icons';

export type AdminTierInput = TierInput;

interface TierEditorProps {
  tiers: AdminTierInput[];
  onChange: (tiers: AdminTierInput[]) => void;
  error?: string | null;
  disabled?: boolean;
}

const input =
  'w-full px-3 py-2 text-xs font-semibold text-neutral-900 border border-neutral-300 rounded-xl';

export const TierEditor: React.FC<TierEditorProps> = ({ tiers, onChange, error, disabled = false }) => {
  const update = (index: number, field: keyof AdminTierInput, value: string) =>
    onChange(tiers.map((t, i) => (i === index ? { ...t, [field]: value === '' ? '' : Number(value) } : t)));

  const addRow = () => {
    const last = tiers[tiers.length - 1];
    const nextMin = last && Number(last.minQuantity) ? Number(last.minQuantity) + 20 : 10;
    const nextDisc = last && Number(last.discountPercent) ? Math.min(MAX_DISCOUNT, Number(last.discountPercent) + 5) : 10;
    onChange([...tiers, { minQuantity: nextMin, discountPercent: nextDisc }]);
  };

  const removeRow = (index: number) => {
    if (tiers.length <= 1) return;
    onChange(tiers.filter((_, i) => i !== index));
  };

  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <div className="flex items-center justify-between">
        <legend className="text-xs font-bold uppercase tracking-wider text-neutral-700">Discount ladder (tiers)</legend>
        <button
          type="button"
          onClick={addRow}
          disabled={disabled || tiers.length >= MAX_TIERS}
          className="text-xs font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-40 rounded px-1.5 py-0.5"
        >
          + Add tier
        </button>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-12 gap-2 text-[11px] font-semibold text-neutral-600 uppercase px-1" aria-hidden="true">
          <span className="col-span-5">Min units</span>
          <span className="col-span-5">Discount %</span>
          <span className="col-span-2" />
        </div>

        {tiers.map((tier, idx) => (
          <div key={idx} className="grid grid-cols-12 gap-2 items-center">
            <div className="col-span-5">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                aria-label={`Tier ${idx + 1} minimum units`}
                placeholder="Units"
                value={tier.minQuantity}
                onChange={(e) => update(idx, 'minQuantity', e.target.value)}
                className={input}
              />
            </div>
            <div className="col-span-5 flex items-center gap-1.5">
              <input
                type="number"
                inputMode="decimal"
                min={1}
                max={MAX_DISCOUNT}
                aria-label={`Tier ${idx + 1} discount percent`}
                placeholder="%"
                value={tier.discountPercent}
                onChange={(e) => update(idx, 'discountPercent', e.target.value)}
                className={input}
              />
              <span aria-hidden="true" className="text-xs font-bold text-neutral-500">%</span>
            </div>
            <div className="col-span-2 flex justify-end">
              <button
                type="button"
                onClick={() => removeRow(idx)}
                disabled={disabled || tiers.length <= 1}
                aria-label={`Remove tier ${idx + 1}`}
                className="p-1.5 text-neutral-500 hover:text-red-700 disabled:opacity-30 rounded-lg"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {error && <p role="alert" className="text-xs font-medium text-red-700 mt-1">{error}</p>}
    </fieldset>
  );
};
export default TierEditor;
