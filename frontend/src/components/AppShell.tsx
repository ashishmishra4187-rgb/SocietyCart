import React, { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { BottomNav } from './BottomNav';

interface AppShellProps {
  /** Show the resident tab bar. */
  nav?: boolean;
  /** Reserve space for a sticky action bar at the bottom. */
  actionBar?: boolean;
}

/**
 * Shared page chrome: skip link, centred 640px column, and focus moved to <main> on every
 * route change so keyboard and screen-reader users land at the top of the new page.
 */
export const AppShell: React.FC<AppShellProps> = ({ nav = false, actionBar = false }) => {
  const mainRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="flex justify-center">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:px-3 focus:py-2 focus:rounded-lg focus:shadow-md focus:text-sm focus:font-semibold"
      >
        Skip to content
      </a>
      <main
        id="main"
        ref={mainRef}
        tabIndex={-1}
        className={`w-full max-w-[640px] min-h-screen bg-neutral-50 px-4 pt-4 shadow-md focus:outline-none ${
          nav ? 'pb-24' : actionBar ? 'pb-28' : 'pb-12'
        }`}
      >
        <Outlet />
      </main>
      {nav && <BottomNav />}
    </div>
  );
};
