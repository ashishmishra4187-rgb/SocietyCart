import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from './Icons';

export const BackLink: React.FC<{ to: string; children: React.ReactNode }> = ({ to, children }) => (
  <Link
    to={to}
    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 shadow-xs"
  >
    <ChevronLeft className="w-4 h-4 text-neutral-500" />
    {children}
  </Link>
);
