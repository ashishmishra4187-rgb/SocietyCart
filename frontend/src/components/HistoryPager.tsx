export function HistoryPager({ page, total, onPage }: { page: number; total: number; onPage: (page: number) => void }) {
  const pages = Math.ceil(total / 20);
  if (pages <= 1 && page === 0) return null;
  return (
    <nav aria-label="History pages" className="mt-4 flex items-center justify-between text-sm">
      <button className="px-3 py-2 text-brand-600 disabled:text-neutral-400" disabled={page === 0} onClick={() => onPage(page - 1)}>Previous</button>
      <span>Page {page + 1}</span>
      <button className="px-3 py-2 text-brand-600 disabled:text-neutral-400" disabled={page + 1 >= pages} onClick={() => onPage(page + 1)}>Next</button>
    </nav>
  );
}
