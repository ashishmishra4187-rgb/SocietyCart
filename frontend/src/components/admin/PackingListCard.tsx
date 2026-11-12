import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminPackingList } from '../../api/adminApi';
import { downloadCsv } from '../../lib/csv';
import { formatINR, formatINRFixed } from '../../lib/format';
import type { PackingList } from '../../types';
import { EmptyState, ErrorState, LoadingRegion, Skeleton } from '../ui/States';
import { StatusBadge } from '../ui/StatusBadge';

/** Flat-by-flat handout list for the admin, with a CSV download and a print button. */
export const PackingListCard: React.FC<{ poolId: string }> = ({ poolId }) => {
  const { data, isLoading, isError, refetch } = useQuery<PackingList>({
    queryKey: ['admin', 'packing-list', poolId],
    queryFn: () => adminPackingList(poolId),
  });

  const download = () => {
    if (!data) return;
    const header = ['Flat', 'Resident', 'Phone', `Quantity (${data.unit})`, 'Unit price (INR)', 'Amount (INR)', 'Status'];
    const rows = data.lines.map((l) => [l.flatNumber, l.residentName, l.phone, l.quantity, l.unitPrice, l.amount, l.status]);
    const total = ['Total', '', '', data.totalUnits, '', data.totalAmount, ''];
    downloadCsv(`packing-list-${data.sku}.csv`, [header, ...rows, total]);
  };

  return (
    <section aria-label="Packing list" className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm space-y-3 print:shadow-none print:border-0">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-700">Packing list</h2>
          <p className="text-[11px] text-neutral-600 mt-0.5">Who gets how many units, flat by flat</p>
        </div>
        {data && data.lines.length > 0 && (
          <div className="flex gap-2 print:hidden">
            <button type="button" onClick={download} className="px-3 py-1.5 rounded-lg border border-neutral-200 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50">
              Download CSV
            </button>
            <button type="button" onClick={() => window.print()} className="px-3 py-1.5 rounded-lg border border-neutral-200 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50">
              Print
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <LoadingRegion label="Loading packing list" className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-9 rounded-lg" />)}
        </LoadingRegion>
      ) : isError ? (
        <ErrorState title="Couldn't load the packing list" onRetry={() => void refetch()} />
      ) : !data || data.lines.length === 0 ? (
        <EmptyState title="No active orders in this deal." />
      ) : (
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">Units to hand out per flat for {data.productName}</caption>
            <thead>
              <tr className="border-b border-neutral-100 text-[11px] font-bold uppercase tracking-wider text-neutral-600">
                <th scope="col" className="py-2">Flat</th>
                <th scope="col" className="py-2">Resident</th>
                <th scope="col" className="py-2 text-right">Qty</th>
                <th scope="col" className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {data.lines.map((l, i) => (
                <tr key={`${l.flatNumber}-${i}`}>
                  <th scope="row" className="py-2.5 pr-2 font-bold text-neutral-900 whitespace-nowrap">{l.flatNumber || '—'}</th>
                  <td className="py-2.5 pr-2">
                    <p className="font-medium text-neutral-900">{l.residentName}</p>
                    <p className="text-[10px] text-neutral-600">{l.phone} · <StatusBadge status={l.status} /></p>
                  </td>
                  <td className="py-2.5 text-right font-bold text-neutral-900 tabular-nums">{l.quantity}</td>
                  <td className="py-2.5 text-right font-semibold text-neutral-900 tabular-nums">{formatINR(l.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-neutral-200">
                <th scope="row" colSpan={2} className="py-2.5 text-neutral-900">Total</th>
                <td className="py-2.5 text-right font-extrabold text-neutral-900 tabular-nums">{data.totalUnits} {data.unit}</td>
                <td className="py-2.5 text-right font-extrabold text-neutral-900 tabular-nums">{formatINRFixed(data.totalAmount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
};
export default PackingListCard;
