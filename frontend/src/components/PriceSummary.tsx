import React from 'react';
import { formatINRFixed, lineTotal, savingsPerUnit } from '../lib/format';
import { InfoCircle } from './ui/Icons';

interface PriceSummaryProps {
  /** Price per unit the resident would get once their own units are counted. */
  unitPrice: number;
  /** The pool's price today (before this order is counted). */
  currentUnitPrice: number;
  /** Shop price, to show the saving. */
  basePrice: number;
  quantity: number;
  timeRemainingText: string;
}

export const PriceSummary: React.FC<PriceSummaryProps> = ({ unitPrice, currentUnitPrice, basePrice, quantity, timeRemainingText }) => {
  const total = lineTotal(unitPrice, quantity);
  const improved = unitPrice < currentUnitPrice;
  const saving = lineTotal(savingsPerUnit(basePrice, unitPrice), quantity);

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm space-y-3.5">
      <div className="flex justify-between items-center text-xs text-neutral-700 font-medium">
        <span>Current unit price</span>
        <span className={`font-semibold tabular-nums ${improved ? 'text-neutral-500 line-through' : 'text-neutral-900'}`}>
          {formatINRFixed(currentUnitPrice)}
        </span>
      </div>
      {improved && (
        <div className="flex justify-between items-center text-xs font-bold text-savings animate-fadeIn">
          <span>Your price with {quantity} {quantity === 1 ? 'unit' : 'units'}</span>
          <span className="tabular-nums">{formatINRFixed(unitPrice)}</span>
        </div>
      )}
      <div className="flex justify-between items-center text-xs text-neutral-700 font-medium">
        <span>× {quantity} unit{quantity > 1 ? 's' : ''}</span>
        <span className="text-neutral-900 font-semibold tabular-nums">{formatINRFixed(total)}</span>
      </div>
      {saving > 0 && (
        <div className="flex justify-between items-center text-xs font-bold text-savings">
          <span>You save vs shop price</span>
          <span className="tabular-nums">{formatINRFixed(saving)}</span>
        </div>
      )}
      <div className="border-t border-neutral-100 pt-3 flex justify-between items-center">
        <span className="text-sm font-bold text-neutral-900">Estimated total</span>
        <span className="text-lg font-extrabold text-neutral-900 tabular-nums">{formatINRFixed(total)}</span>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
        <InfoCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <p className="text-[11px] leading-relaxed text-amber-900 font-medium">
          {timeRemainingText === 'ended'
            ? 'This pool has closed.'
            : `The final price is set when the pool closes in ${timeRemainingText}. If more neighbours join, you pay less, never more.`}
        </p>
      </div>
    </div>
  );
};
export default PriceSummary;