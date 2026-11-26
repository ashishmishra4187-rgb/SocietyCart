import React, { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { PoolCard } from '../components/PoolCard';
import { SocietySelector } from '../components/SocietySelector';
import { UserIcon } from '../components/ui/Icons';
import { EmptyState, ErrorState, LoadingRegion, Skeleton } from '../components/ui/States';
import { useAuthContext } from '../context/AuthContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useNow } from '../hooks/useNow';
import { usePoolList, useSocietyDetails } from '../hooks/usePoolList';
import { useSocietyPoolsLive } from '../hooks/useSocietyPoolsLive';
import { getNextTier, almostThere, closingSoon, CLOSING_SOON_HOURS, withSavings } from '../lib/pool';
import type { PoolProgress } from '../types';

type View = 'all' | 'closing' | 'savings';

/** The chosen view lives in the address (?view=closing) so it survives a reload and the Back button works. */
const parseView = (value: string | null): View => (value === 'closing' || value === 'savings' ? value : 'all');

const grid = 'grid grid-cols-1 sm:grid-cols-2 gap-3.5';

const DealGrid: React.FC<{ pools: PoolProgress[]; label: string }> = ({ pools, label }) => (
  <ul className={`${grid} market-deal-grid`} aria-label={label}>
    {pools.map((pool) => (
      <li key={pool.poolWindowId}>
        <PoolCard pool={pool} />
      </li>
    ))}
  </ul>
);

const ShowAllButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="mt-1 px-4 py-2 rounded-xl bg-brand-500 text-white text-xs font-semibold hover:bg-brand-600"
  >
    Show all deals
  </button>
);

export const SocietyDashboard: React.FC = () => {
  const { societyId } = useParams<{ societyId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const view = parseView(searchParams.get('view'));
  const setView = (next: View) => setSearchParams(next === 'all' ? {} : { view: next });

  const { session } = useAuthContext();
  const { data: society, isLoading: societyLoading } = useSocietyDetails(societyId);
  const { data: pools, isLoading, isError, refetch } = usePoolList(societyId);
  useSocietyPoolsLive(societyId); // new deals appear without a reload
  useDocumentTitle(society?.name ?? 'Deals');

  // Re-evaluate once a minute so a deal drifts into "Closing soon" while the page is open.
  const now = useNow();

  const { open, closing, savings, nearly } = useMemo(() => {
    const list = (pools ?? []).filter((p) => p.status === 'OPEN' && Date.parse(p.cutoffAt) > now);
    return { open: list, closing: closingSoon(list, now), savings: withSavings(list), nearly: almostThere(list) };
  }, [pools, now]);

  const featured = open.reduce<PoolProgress | undefined>((best, candidate) => {
    if (!best) return candidate;
    const distance = (p: PoolProgress) => getNextTier(p)?.unitsNeeded ?? Infinity;
    return distance(candidate) < distance(best) ? candidate : best;
  }, undefined);
  const remaining = open.filter(p => p.poolWindowId !== featured?.poolWindowId);

  const chips: { key: View; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: open.length },
    { key: 'closing', label: 'Closing soon', count: closing.length },
    { key: 'savings', label: 'Biggest savings', count: savings.length },
  ];

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
                Society deals
              </h1>
              {society && <p className="text-xs font-medium text-neutral-600 mt-0.5">{[society.name, society.city].filter(Boolean).join(' \u00b7 ')}</p>}
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

      <div role="group" aria-label="Deal views" className="flex gap-2 overflow-x-auto no-scrollbar pb-3 mb-2">
        {chips.map(({ key, label, count }) => (
          <button
            key={key}
            type="button"
            aria-pressed={view === key}
            onClick={() => setView(key)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
              view === key ? 'bg-brand-500 text-white shadow-sm' : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            {label}
            {!isLoading && !isError && (
              <span
                className={`ml-1.5 inline-block min-w-[1.25rem] px-1 rounded-full text-[10px] font-bold tabular-nums ${
                  view === key ? 'bg-white/25 text-white' : 'bg-neutral-100 text-neutral-600'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingRegion label="Loading deals" className={grid}>
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
      ) : view === 'closing' ? (
        <section aria-label="Closing soon" className="space-y-3">
          <div>
            <h2 className="text-sm font-bold text-neutral-900">Closing soon</h2>
            <p className="text-xs text-neutral-600">Deals that close within the next {CLOSING_SOON_HOURS} hours, soonest first.</p>
          </div>
          {closing.length === 0 ? (
            <EmptyState
              title={`Nothing is closing in the next ${CLOSING_SOON_HOURS} hours.`}
              hint={open.length > 0 ? 'Check back later, or browse every open deal.' : undefined}
            >
              {open.length > 0 && <ShowAllButton onClick={() => setView('all')} />}
            </EmptyState>
          ) : (
            <DealGrid pools={closing} label="Deals closing soon" />
          )}
        </section>
      ) : view === 'savings' ? (
        <section aria-label="Biggest savings" className="space-y-5">
          <div className="space-y-3">
            <div>
              <h2 className="text-sm font-bold text-neutral-900">Biggest savings</h2>
              <p className="text-xs text-neutral-600">Deals with a discount already unlocked, biggest first.</p>
            </div>
            {savings.length === 0 ? (
              <EmptyState title="No discounts unlocked yet." hint="Discounts unlock as more neighbours join a deal.">
                {open.length > 0 && <ShowAllButton onClick={() => setView('all')} />}
              </EmptyState>
            ) : (
              <DealGrid pools={savings} label="Deals with savings" />
            )}
          </div>

          {nearly.length > 0 && (
            <div className="space-y-3">
              <div>
                <h2 className="text-sm font-bold text-neutral-900">Closest to a discount</h2>
                <p className="text-xs text-neutral-600">Join one of these to help the group unlock savings.</p>
              </div>
              <ul className={grid} aria-label="Deals close to a discount">
                {nearly.map(({ pool, unitsNeeded, discountPercent }) => (
                  <li key={pool.poolWindowId}>
                    <PoolCard pool={pool} />
                    <p className="mt-1.5 px-1 text-[11px] font-semibold text-savings">
                      Needs {unitsNeeded} more {unitsNeeded === 1 ? 'unit' : 'units'} to unlock {discountPercent}% off
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ) : open.length === 0 ? (
        <EmptyState title="No open deals right now." hint="New deals will appear here when your society opens them." />
      ) : (
        <>
          {featured && <PoolCard key={featured.poolWindowId} pool={featured} featured />}
          {remaining.length > 0 && <section className="mt-7"><h2 className="market-heading mb-3">More open deals</h2><DealGrid pools={remaining} label="Open deals" /></section>}
        </>
      )}
    </>
  );
};
export default SocietyDashboard;