import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axiosClient from '../api/axiosClient';
import { getErrorMessage } from '../lib/errors';
import type { PoolProgress } from '../types';

export function ShopkeeperDispatch() {
  const client = useQueryClient();
  const key = ['shopkeeper', 'ready'];
  const queue = useQuery({
    queryKey: key,
    queryFn: async () => (await axiosClient.get<PoolProgress[]>('/api/shopkeeper/pools')).data,
    refetchInterval: 30000,
  });
  const dispatch = useMutation({
    mutationFn: (id: string) => axiosClient.post(`/api/shopkeeper/pools/${id}/dispatch`),
    onSuccess: () => client.invalidateQueries({ queryKey: key }),
  });
  return (
    <section className="space-y-3 rounded-2xl border bg-white p-5">
      <h2 className="font-bold">Ready to dispatch</h2>
      {queue.isPending && <p>Loading orders…</p>}
      {queue.isError && <button onClick={() => queue.refetch()}>Reload dispatch queue</button>}
      {queue.data?.length === 0 && <p>No closed pools are awaiting dispatch.</p>}
      {queue.data?.map(pool => (
        <div key={pool.poolWindowId} className="flex items-center justify-between gap-3">
          <span>{pool.productName} · {pool.aggregateQuantity} units</span>
          <button className="rounded-lg bg-brand-600 px-3 py-2 text-white" disabled={dispatch.isPending}
            onClick={() => {
              if (window.confirm(`Confirm that you have dispatched ${pool.aggregateQuantity} units of ${pool.productName}?`)) {
                dispatch.mutate(pool.poolWindowId);
              }
            }}>Confirm dispatch</button>
        </div>
      ))}
      {dispatch.isError && <p role="alert">{getErrorMessage(dispatch.error, 'Could not confirm dispatch.')}</p>}
    </section>
  );
}
