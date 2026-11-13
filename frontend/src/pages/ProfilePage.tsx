import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, BagIcon } from '../components/ui/Icons';
import { ErrorState, LoadingRegion, Skeleton } from '../components/ui/States';
import { useAuthContext } from '../context/AuthContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLogout, useResidentProfile, useUpdateProfile } from '../hooks/useAuth';
import { getErrorMessage } from '../lib/errors';
import { initials, maskPhone } from '../lib/format';
import { isValidFlat } from '../lib/validation';
import { isAdminRole } from '../types';

const field =
  'w-full px-3.5 py-2.5 text-sm font-semibold text-neutral-900 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all';

export const ProfilePage: React.FC = () => {
  useDocumentTitle('Profile');
  const { session } = useAuthContext();
  const { data: profile, isLoading, isError, refetch } = useResidentProfile();
  const update = useUpdateProfile();
  const logout = useLogout();

  const [name, setName] = useState('');
  const [flatNumber, setFlatNumber] = useState('');
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setFlatNumber(profile.flatNumber || '');
    }
  }, [profile]);

  useEffect(() => {
    if (!saved) return;
    const t = window.setTimeout(() => setSaved(false), 2500);
    return () => window.clearTimeout(t);
  }, [saved]);

  if (isLoading) {
    return (
      <LoadingRegion label="Loading profile" className="space-y-4">
        <Skeleton className="h-6 w-24 rounded-full" />
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 flex flex-col items-center space-y-3">
          <Skeleton className="w-16 h-16 rounded-full" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-48 rounded-2xl" />
      </LoadingRegion>
    );
  }

  if (isError || !profile) {
    return <ErrorState fullPage title="Couldn't load profile" onRetry={() => void refetch()} />;
  }

  const flatOk = isValidFlat(flatNumber);
  const nameOk = name.trim().length > 0 && name.trim().length <= 60;
  const dirty = name.trim() !== (profile.name || '').trim() || flatNumber.trim() !== (profile.flatNumber || '').trim();
  const canSave = dirty && flatOk && nameOk && !update.isPending;
  const societyRoute = profile.societyId ? `/s/${profile.societyId}` : '/';

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setErrorMsg(null);
    update.mutate(
      { name: name.trim(), flatNumber: flatNumber.trim() },
      {
        onSuccess: () => setSaved(true),
        onError: (err) => setErrorMsg(getErrorMessage(err, 'Failed to update your profile. Please try again.')),
      },
    );
  };

  const rowLink = 'flex items-center justify-between p-4 hover:bg-neutral-50 transition-colors';

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-neutral-900 leading-tight">Profile</h1>
        <Link to={societyRoute} className="text-xs font-semibold text-brand-600 hover:text-brand-700 rounded-lg px-2 py-1">
          Back to deals
        </Link>
      </header>

      <section aria-label="Personal details" className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm flex flex-col items-center text-center">
        <div aria-hidden="true" className="w-16 h-16 rounded-full bg-brand-500/10 border-2 border-brand-500/20 text-brand-600 font-extrabold text-xl flex items-center justify-center mb-3">
          {initials(profile.name)}
        </div>
        <h2 className="text-base font-bold text-neutral-900">{profile.name || 'Resident'}</h2>
        <p className="text-xs font-medium text-neutral-600 mt-0.5 tracking-wider font-mono">{maskPhone(profile.phone)}</p>
      </section>

      <section aria-label="Society" className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-sm flex items-center justify-between gap-3">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-600 block mb-0.5">Community</span>
          <p className="text-sm font-bold text-neutral-900">{profile.societyName}</p>
          {profile.joinCode && <span className="text-xs text-neutral-600 font-mono">Code: {profile.joinCode}</span>}
        </div>
       {session?.role === 'PLATFORM_ADMIN' ? (
  <span className="text-[11px] font-bold text-brand-700 bg-brand-500/10 border border-brand-500/20 px-2.5 py-1 rounded-full text-right leading-tight">Platform admin</span>
) : isAdminRole(session?.role) ? (
  <span className="text-[11px] font-bold text-brand-700 bg-brand-500/10 border border-brand-500/20 px-2.5 py-1 rounded-full text-right leading-tight">You manage this society</span>
) : (
  <span className="text-[11px] text-neutral-600 font-medium italic text-right max-w-[130px] leading-tight">  </span>
)}
      </section>

      <section aria-label="Delivery settings" className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm">
        <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-700 mb-4">Delivery details</h2>
        <form onSubmit={save} className="space-y-4" noValidate>
          <div>
            <label htmlFor="name" className="block text-xs font-semibold text-neutral-800 mb-1.5">Full name</label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              maxLength={60}
              value={name}
              onChange={(e) => { setName(e.target.value); setErrorMsg(null); }}
              placeholder="Your full name"
              className={field}
            />
          </div>
          <div>
            <label htmlFor="flatNumber" className="block text-xs font-semibold text-neutral-800 mb-1.5">Flat / door number</label>
            <input
              id="flatNumber"
              type="text"
              autoComplete="off"
              maxLength={20}
              value={flatNumber}
              aria-invalid={flatNumber.length > 0 && !flatOk}
              aria-describedby="flat-help"
              onChange={(e) => { setFlatNumber(e.target.value); setErrorMsg(null); }}
              placeholder="e.g. A-402"
              className={field}
            />
            <p id="flat-help" className={`text-[11px] mt-1 ${flatNumber.length > 0 && !flatOk ? 'text-red-700 font-medium' : 'text-neutral-600'}`}>
              {flatNumber.length > 0 && !flatOk
                ? 'Use letters, numbers, dash or slash only (max 20).'
                : 'Orders are dropped off at this door upon bulk dispatch.'}
            </p>
          </div>

          {errorMsg && <p role="alert" className="text-xs font-medium text-red-700">{errorMsg}</p>}

          <div className="pt-2 flex items-center justify-between">
            <span role="status" className="text-xs font-bold text-savings">{saved ? 'Saved ✓' : ''}</span>
            <button
              type="submit"
              disabled={!canSave}
              className="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-xs"
            >
              {update.isPending ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </section>

      <section aria-label="Account links" className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm divide-y divide-neutral-100">
        <Link to="/orders" className={rowLink}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-700">
              <BagIcon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-neutral-900">My orders</p>
              <p className="text-[11px] text-neutral-600">Track active deal pools and order history</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-neutral-500" />
        </Link>
        {isAdminRole(session?.role) && (
          <Link to={`/admin/s/${profile.societyId}`} className={rowLink}>
            <div>
              <p className="text-sm font-bold text-neutral-900">Pool manager</p>
              <p className="text-[11px] text-neutral-600">Open, close and dispatch pools for your society</p>
            </div>
            <ChevronRight className="w-4 h-4 text-neutral-500" />
          </Link>
        )}
      </section>

      <div className="pt-2 text-center">
        <button type="button" onClick={logout} className="text-xs font-semibold text-red-700 hover:text-red-800 hover:underline py-2 px-4 rounded-xl transition-colors">
          Log out
        </button>
      </div>
    </div>
  );
};
export default ProfilePage;
