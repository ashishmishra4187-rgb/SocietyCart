import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatINR, round2 } from '../lib/format';
import type { OrderResponse } from '../types';
import { StatusBadge } from './ui/StatusBadge';

interface OrderCardProps {
  order: OrderResponse;
  onCancel?: (poolWindowId: string, orderId: string) => void;
  isCancelling?: boolean;
}

export const OrderCard: React.FC<OrderCardProps> = ({ order, onCancel, isCancelling = false }) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const totalSaved = Math.max(0, round2((order.basePrice - order.unitPriceAtCommit) * order.quantity));
  const isCancellable = order.status === 'COMMITTED' && (order.poolStatus ?? 'OPEN') === 'OPEN';

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-3.5 shadow-sm hover:border-neutral-300 transition-colors">
      <Link to={`/orders/${order.orderId}`} className="flex items-center gap-3.5 rounded-xl">
        <div className="w-16 h-16 rounded-xl bg-neutral-100 overflow-hidden shrink-0 flex items-center justify-center border border-neutral-100">
          {order.imageUrl ? (
            <img src={order.imageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-[10px] text-neutral-500 font-medium">No image</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="text-sm font-bold text-neutral-900 truncate leading-snug">{order.productName}</h3>
            <StatusBadge status={order.status} />
          </div>
          <p className="text-xs text-neutral-700 font-medium">
            {order.quantity} {order.quantity === 1 ? 'unit' : 'units'} · {formatINR(order.unitPriceAtCommit)}/unit
            {order.priceIsFinal === false && <span className="text-neutral-500"> (today)</span>}
          </p>
          <div className="flex items-center justify-between mt-1.5">
            {totalSaved > 0 ? (
  <span className="text-xs font-bold text-savings">
    {order.priceIsFinal === false ? `Saving ${formatINR(totalSaved)} so far` : `You saved ${formatINR(totalSaved)}`}
  </span>
) : (
  <span className="text-[11px] font-medium text-neutral-600">
    {order.priceIsFinal === false ? 'Price drops as neighbours join' : ''}
  </span>
)}
            <span className="text-xs font-extrabold text-neutral-900 tabular-nums">{formatINR(order.totalAmount)}</span>
          </div>
        </div>
      </Link>

      {isCancellable && onCancel && (
        <div className="mt-2.5 pt-2 border-t border-neutral-100 flex items-center justify-between text-xs">
          {!showConfirm ? (
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              className="font-medium text-neutral-600 hover:text-red-700 rounded px-1.5 py-0.5 transition-colors"
            >
              Cancel order
            </button>
          ) : (
            <div role="alertdialog" aria-label="Confirm cancellation" className="flex items-center justify-between w-full bg-red-50 p-2 rounded-xl border border-red-200 animate-fadeIn">
              <span className="text-[11px] font-medium text-red-900">Cancel this deal order?</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={isCancelling}
                  onClick={() => setShowConfirm(false)}
                  className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                >
                  No
                </button>
                <button
                  type="button"
                  disabled={isCancelling}
                  onClick={() => onCancel(order.poolWindowId, order.orderId)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {isCancelling ? 'Cancelling…' : 'Yes, cancel'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default OrderCard;
