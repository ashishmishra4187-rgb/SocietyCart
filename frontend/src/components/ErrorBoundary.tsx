import React from 'react';

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    // Hook point for Sentry/LogRocket etc.
    console.error('Unhandled UI error', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div role="alert" className="min-h-screen flex flex-col items-center justify-center p-6 text-center max-w-[640px] mx-auto">
        <h1 className="text-lg font-bold text-neutral-900 mb-1">Something went wrong</h1>
        <p className="text-xs text-neutral-600 mb-5">An unexpected error occurred. Your orders are safe.</p>
        <button
          type="button"
          onClick={() => window.location.assign('/')}
          className="px-5 py-2.5 rounded-xl bg-brand-500 text-white font-semibold text-xs hover:bg-brand-600"
        >
          Reload SocietyCart
        </button>
      </div>
    );
  }
}
