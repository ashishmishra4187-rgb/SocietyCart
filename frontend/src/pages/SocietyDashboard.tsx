import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PoolCard } from '../components/PoolCard';
import { SocietySelector } from '../components/SocietySelector';
import { UserIcon } from '../components/ui/Icons';
import { EmptyState, ErrorState, LoadingRegion, Skeleton } from '../components/ui/States';
import { useAuthContext } from '../context/AuthContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { usePoolList, useSocietyDetails } from '../hooks/usePoolList';

type FilterType = 'all' | 'closing' | 'savings';
const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'closing', label: 'Closing soon' },
  { key: 'savings', label: 'Biggest savings' },
];

export const SocietyDashboard: React.FC = () => {
  const { societyId } = useParams<{ societyId: string }>();
  const [filter, setFilter] = useState<FilterType>('all');
  const { session } = useAuthContext();
  const { data: society, isLoading: societyLoading } = useSocietyDetails(societyId);
  const { data: pools, isLoading, isError, refetch } = usePoolList(societyId);
  useDocumentTitle(society?.name ?? 'Deals');

  const openPools = useMemo(() => {
    const list = (pools ?? []).filter((p) => p.status === 'OPEN');
    if (filter === 'closing') return [...list].sort((a, b) => new Date(a.cutoffAt).getTime() - new Date(b.cutoffAt).getTime());
    if (filter === 'savings') return [...list].sort((a, b) => b.savingsPercent - a.savingsPercent);
    return list;
  }, [pools, filter]);

  return (
    <>
      <header className="flex items-center justify-between mb-4">
        <div className="min-w-0">
          {societyLoading ? (
            <div className="space-y-2" aria-hidden="true">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold tracking-tight text-neutral-900 leading-tight truncate">
                {society?.name ?? 'Your society'}
              </h1>
              {society?.city && <p className="text-xs font-medium text-neutral-600 mt-0.5">{society.city}</p>}
            </>
          )}
        </div>
        <Link
          to="/profile"
          aria-label="Profile and settings"
          className="w-10 h-10 rounded-full bg-brand-500/10 text-brand-600 font-semibold text-xs flex items-center justify-center border border-brand-500/20 hover:bg-brand-500/20 shrink-0"
        >
          {session?.flatNumber ? session.flatNumber : <UserIcon className="w-5 h-5" />}
        </Link>
      </header>

      <SocietySelector currentId={societyId} />

      <div role="group" aria-label="Deal filters" className="flex gap-2 overflow-x-auto no-scrollbar pb-3 mb-2">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
              filter === key ? 'bg-brand-500 text-white shadow-sm' : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingRegion label="Loading deals" className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-neutral-200 p-3.5 shadow-sm">
              <Skeleton className="aspect-square w-full rounded-xl mb-3" />
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2 mb-3" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </LoadingRegion>
      ) : isError ? (
        <ErrorState title="Couldn't load deals" onRetry={() => void refetch()} />
      ) : openPools.length === 0 ? (
        <EmptyState title="No open deals right now." hint="New pools open every morning at 8 AM." />
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3.5" aria-label="Open deals">
          {openPools.map((pool) => (
            <li key={pool.poolWindowId}>
              <PoolCard pool={pool} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
};
export default SocietyDashboard;
