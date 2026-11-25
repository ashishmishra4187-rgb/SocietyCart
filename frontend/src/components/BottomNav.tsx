import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuthContext } from '../context/AuthContext';
import { BagIcon, HomeIcon, UserIcon } from './ui/Icons';

export const BottomNav: React.FC = () => {
  const { session } = useAuthContext();
  const dealsTo = session?.societyId ? `/s/${session.societyId}` : '/';

  const items = [
    { to: dealsTo, label: 'Deals', Icon: HomeIcon, end: true },
    { to: '/orders', label: 'Orders', Icon: BagIcon, end: false },
    { to: '/profile', label: 'Profile', Icon: UserIcon, end: false },
  ];

  return (
    <nav
      aria-label="Bottom navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 py-2 px-6 pb-safe flex justify-around items-center max-w-[640px] mx-auto z-30"
    >
      {items.map(({ to, label, Icon, end }) => (
        <NavLink
          key={label}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex flex-col items-center min-w-[64px] py-1 font-medium text-[11px] ${
              isActive ? 'text-brand-600' : 'text-neutral-600 hover:text-neutral-900'
            }`
          }
        >
          <Icon className="w-5 h-5 mb-0.5" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
};
