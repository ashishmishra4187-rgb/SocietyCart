import React, { useEffect, useRef, useState } from 'react';
import { formatINR } from '../lib/format';
import { resolveProductImage } from '../lib/images';
import { SparklesIcon, XIcon } from './ui/Icons';

export interface DiscountPopupProps {
  /** Discount unlocked by the current quantity, or null when this order doesn't unlock a new level. */
  percent: number | null;
  /** Price per unit at that discount. */
  unitPrice: number | null;
  /** Optional product name to display in the celebratory modal */
  productName?: string;
  /** Optional product image url to display */
  imageUrl?: string | null;
}

const COLORS = ['#fbbf24', '#34d399', '#f472b6', '#60a5fa', '#ffffff', '#f59e0b', '#a7f3d0'];

// 24 confetti pieces fanned evenly in a circle around the center of the dialog
const PIECES = Array.from({ length: 24 }, (_, i) => {
  const angle = (i / 24) * Math.PI * 2;
  const distance = 100 + (i % 4) * 26;
  return {
    dx: Math.round(Math.cos(angle) * distance),
    dy: Math.round(Math.sin(angle) * distance),
    color: COLORS[i % COLORS.length] as string,
    delay: (i % 6) * 35,
  };
});

/**
 * Centered celebratory modal ("XX% OFF unlocked!") that appears in the CENTER of the screen
 * when the resident's quantity reaches a new discount level, then auto-fades after a few seconds
 * or closes on tap. Respects prefers-reduced-motion.
 */
export const DiscountPopup: React.FC<DiscountPopupProps> = ({
  percent,
  unitPrice,
  productName,
  imageUrl,
}) => {
  const [shown, setShown] = useState<{
    percent: number;
    unitPrice: number | null;
    key: number;
    productName?: string;
    imageUrl?: string | null;
  } | null>(null);

  const lastPercent = useRef(0);
  const counter = useRef(0);

  useEffect(() => {
    if (percent === null) {
      lastPercent.current = 0; // dropped back below the level: celebrate again if crossed later
      setShown(null);
      return;
    }
    if (percent > lastPercent.current) {
      lastPercent.current = percent;
      counter.current += 1;
      setShown({ percent, unitPrice, key: counter.current, productName, imageUrl });
    }
    lastPercent.current = percent;
  }, [percent, unitPrice, productName, imageUrl]);

  useEffect(() => {
    if (!shown) return;
    const timer = window.setTimeout(() => setShown(null), 4500);
    return () => window.clearTimeout(timer);
  }, [shown]);

  // Handle ESC key to dismiss dialog
  useEffect(() => {
    if (!shown) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShown(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shown]);

  if (!shown) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={`${shown.percent}% discount unlocked celebration`}
      className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4 animate-fadeIn"
      onClick={(e) => {
        // Dismiss if clicking backdrop
        if (e.target === e.currentTarget) setShown(null);
      }}
    >
      <div
        key={shown.key}
        className="pointer-events-auto relative max-w-sm w-full bg-gradient-to-br from-brand-600 via-teal-700 to-emerald-800 text-white rounded-3xl shadow-2xl p-6 sm:p-7 text-center border border-white/20 overflow-hidden animate-pop"
      >
        {/* Floating Confetti Particles radiating from center */}
        <span aria-hidden="true" className="pointer-events-none">
          {PIECES.map((p, i) => (
            <span
              key={i}
              className="absolute left-1/2 top-1/2 w-2 h-3 rounded-sm animate-confetti opacity-90 shadow-xs"
              style={{
                '--dx': `${p.dx}px`,
                '--dy': `${p.dy}px`,
                backgroundColor: p.color,
                animationDelay: `${p.delay}ms`,
              } as React.CSSProperties}
            />
          ))}
        </span>

        {/* Close Button */}
        <button
          type="button"
          onClick={() => setShown(null)}
          aria-label="Close discount popup"
          className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white/80 hover:text-white transition-all z-10"
        >
          <XIcon className="w-4 h-4" />
        </button>

        {/* Center Badge / Product Thumbnail */}
        {shown.productName || shown.imageUrl ? (
          <div className="relative mx-auto mb-3 w-16 h-16 rounded-2xl bg-white/20 p-1 border border-white/30 shadow-lg">
            <img
              src={resolveProductImage(shown.imageUrl, shown.productName)}
              alt=""
              className="w-full h-full object-cover rounded-xl"
            />
            <span className="absolute -bottom-1 -right-1 bg-amber-400 text-neutral-900 rounded-full p-1 shadow">
              <SparklesIcon className="w-3.5 h-3.5" />
            </span>
          </div>
        ) : (
          <div className="mx-auto mb-3 w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-lg text-2xl">
            🎉
          </div>
        )}

        <div className="inline-block px-3 py-0.5 rounded-full bg-white/15 text-[11px] font-bold uppercase tracking-wider text-teal-100 mb-1 border border-white/20">
          Wholesale Discount Unlocked!
        </div>

        <p className="text-4xl sm:text-5xl font-black tracking-tight text-white drop-shadow-sm my-1">
          {shown.percent}% OFF
        </p>

        {shown.productName ? (
          <p className="text-xs font-semibold text-white/95 mt-1 truncate max-w-xs mx-auto">
            for {shown.productName}
          </p>
        ) : null}

        <p className="text-xs text-teal-100/90 font-medium mt-1 leading-snug">
          Confirm your order to unlock this price for the pool.
        </p>

        {shown.unitPrice !== null && (
          <div className="mt-3.5 py-2 px-4 rounded-xl bg-white/15 border border-white/25 inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-white shadow-inner">
            <SparklesIcon className="w-4 h-4 text-amber-300 shrink-0" />
            <span>
              Now only <strong className="text-amber-300 font-extrabold">{formatINR(shown.unitPrice)}</strong> per unit
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={() => setShown(null)}
          className="mt-5 w-full py-2.5 px-4 rounded-xl bg-white hover:bg-neutral-100 text-teal-900 font-bold text-xs uppercase tracking-wider transition-all active:scale-95 shadow-md flex items-center justify-center gap-1.5"
        >
          <span>Continue shopping</span>
        </button>
      </div>
    </div>
  );
};

export default DiscountPopup;
