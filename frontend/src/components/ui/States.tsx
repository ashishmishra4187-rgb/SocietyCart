import React from 'react';
import { Link } from 'react-router-dom';

interface ErrorStateProps {
  title: string;
  message?: string;
  onRetry?: () => void;
  backTo?: string;
  backLabel?: string;
  fullPage?: boolean;
}

const card = 'bg-white rounded-2xl border border-neutral-200 p-8 text-center shadow-sm';

export const ErrorState: React.FC<ErrorStateProps> = ({
  title,
  message = 'Please check your network and try again.',
  onRetry,
  backTo,
  backLabel = 'Go back',
  fullPage = false,
}) => (
  <div className={fullPage ? 'min-h-[70vh] flex items-center justify-center' : 'my-6'}>
    <div role="alert" className={`${card} w-full`}>
      <h1 className="text-base font-bold text-neutral-900 mb-1">{title}</h1>
      <p className="text-xs text-neutral-600 mb-5">{message}</p>
      <div className="flex gap-3 justify-center">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-4 py-2 rounded-xl bg-brand-500 text-white font-semibold text-xs hover:bg-brand-600"
          >
            Retry
          </button>
        )}
        {backTo && (
          <Link
            to={backTo}
            className="px-4 py-2 rounded-xl bg-white border border-neutral-300 text-neutral-700 font-semibold text-xs hover:bg-neutral-50"
          >
            {backLabel}
          </Link>
        )}
      </div>
    </div>
  </div>
);

export const EmptyState: React.FC<{ title: string; hint?: string; children?: React.ReactNode }> = ({
  title,
  hint,
  children,
}) => (
  <div className={`${card} my-6 space-y-2`}>
    <p className="text-sm font-semibold text-neutral-900">{title}</p>
    {hint && <p className="text-xs text-neutral-600">{hint}</p>}
    {children}
  </div>
);

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-neutral-200 rounded animate-pulse ${className}`} aria-hidden="true" />
);

/** Wraps skeletons so assistive tech announces loading once. */
export const LoadingRegion: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({
  label,
  children,
  className = '',
}) => (
  <div role="status" aria-busy="true" aria-label={label} className={className}>
    {children}
  </div>
);
