import React from 'react';

interface QuantityStepperProps {
  quantity: number;
  onChange: (quantity: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}

const btn =
  'w-12 h-12 rounded-xl border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 active:scale-95 text-neutral-800 font-bold text-xl flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100';

export const QuantityStepper: React.FC<QuantityStepperProps> = ({
  quantity,
  onChange,
  min = 1,
  max = 20,
  disabled = false,
}) => (
  <div role="group" aria-label="Quantity" className="flex items-center justify-between bg-white rounded-2xl border border-neutral-200 p-4 shadow-sm">
    <span className="text-sm font-semibold text-neutral-800">Quantity</span>
    <div className="flex items-center gap-3">
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={disabled || quantity <= min}
        onClick={() => onChange(Math.max(min, quantity - 1))}
        className={btn}
      >
        <span aria-hidden="true">−</span>
      </button>
      <output aria-live="polite" className="w-10 text-center font-extrabold text-xl text-neutral-900 select-none tabular-nums">
        {quantity}
      </output>
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={disabled || quantity >= max}
        onClick={() => onChange(Math.min(max, quantity + 1))}
        className={btn}
      >
        <span aria-hidden="true">+</span>
      </button>
    </div>
  </div>
);
export default QuantityStepper;
