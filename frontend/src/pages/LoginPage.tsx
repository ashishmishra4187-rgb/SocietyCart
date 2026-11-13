import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { OtpStep } from '../components/OtpStep';
import { CartIcon } from '../components/ui/Icons';
import { Spinner } from '../components/ui/Spinner';
import { useAuthContext } from '../context/AuthContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useRequestOtp, useSignup, useSignupSocieties, useVerifyOtp } from '../hooks/useAuth';
import { getErrorMessage, getStatus } from '../lib/errors';
import { isValidFlat, isValidName, isValidPhone } from '../lib/validation';
import type { SignupPayload } from '../api/authApi';

type Mode = 'signin' | 'signup';
type AccountType = SignupPayload['role'];

const RESEND_SECONDS = 30;

const field =
  'w-full px-3.5 py-3 text-neutral-900 text-base placeholder-neutral-500 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all';
const label = 'block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-2';
const primaryBtn =
  'w-full py-3.5 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-medium text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-brand-500 focus-visible:ring-2 focus-visible:ring-offset-2 flex items-center justify-center gap-2';

const PhoneInput: React.FC<{ value: string; onChange: (v: string) => void; autoFocus?: boolean; describedBy?: string; invalid?: boolean }> = ({
  value,
  onChange,
  autoFocus,
  describedBy,
  invalid,
}) => (
  <div className="flex rounded-xl border border-neutral-300 focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-brand-500 overflow-hidden transition-all">
    <span className="inline-flex items-center px-3.5 bg-neutral-100 text-neutral-700 font-medium text-sm border-r border-neutral-300">+91</span>
    <input
      id="phone"
      type="tel"
      inputMode="numeric"
      autoComplete="tel-national"
      maxLength={10}
      placeholder="9876543210"
      value={value}
      aria-describedby={describedBy}
      aria-invalid={invalid}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
      className="w-full px-3.5 py-3 text-neutral-900 text-base placeholder-neutral-500 focus:outline-none"
      autoFocus={autoFocus}
    />
  </div>
);

export const LoginPage: React.FC<{ initialMode?: Mode }> = ({ initialMode = 'signin' }) => {
  const { session } = useAuthContext();

  const [mode, setMode] = useState<Mode>(initialMode);
  const [step, setStep] = useState<'form' | 'otp'>('form');
  useDocumentTitle(mode === 'signin' ? 'Sign in' : 'Create account');

  // shared + sign-up fields
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [societyId, setSocietyId] = useState('');
  const [flatNumber, setFlatNumber] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('RESIDENT');
  const [adminCode, setAdminCode] = useState('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  /** Lets the error offer the other path ("create an account" / "sign in instead"). */
  const [errorKind, setErrorKind] = useState<'none' | 'no-account' | 'account-exists'>('none');
  const [resendTimer, setResendTimer] = useState(RESEND_SECONDS);
  const [resetSignal, setResetSignal] = useState(0);

  const requestOtp = useRequestOtp();
  const signup = useSignup();
  const verifyOtp = useVerifyOtp();
  const societies = useSignupSocieties(mode === 'signup');

  useEffect(() => {
    if (step !== 'otp' || resendTimer <= 0) return;
    const id = window.setTimeout(() => setResendTimer((t) => t - 1), 1000);
    return () => window.clearTimeout(id);
  }, [step, resendTimer]);

  // A single society needs no choosing.
  useEffect(() => {
    if (societies.data?.length === 1 && !societyId) setSocietyId(societies.data[0]?.id ?? '');
  }, [societies.data, societyId]);

  if (session) return <Navigate to={`/s/${session.societyId}`} replace />;

  const clearError = () => {
    setErrorMsg(null);
    setErrorKind('none');
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setStep('form');
    clearError();
  };

  const phoneValid = isValidPhone(phone);
  const signupValid =
    phoneValid &&
    isValidName(name) &&
    societyId !== '' &&
    isValidFlat(flatNumber) &&
    (accountType === 'RESIDENT' || adminCode.trim().length > 0);
  const canSubmit = mode === 'signin' ? phoneValid : signupValid;
  const sending = requestOtp.isPending || signup.isPending;

  const signupPayload = (): SignupPayload => ({
    phone,
    name: name.trim(),
    societyId,
    flatNumber: flatNumber.trim(),
    role: accountType,
    ...(accountType === 'SOCIETY_ADMIN' ? { adminCode: adminCode.trim() } : {}),
  });

  const goToOtp = () => {
    setStep('otp');
    setResendTimer(RESEND_SECONDS);
    setResetSignal(0);
  };

  const submitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || sending) return;
    clearError();

    if (mode === 'signin') {
      requestOtp.mutate(phone, {
        onSuccess: goToOtp,
        onError: (err) => {
          setErrorMsg(getErrorMessage(err, 'Could not send the OTP. Please try again.'));
          setErrorKind(getStatus(err) === 404 ? 'no-account' : 'none');
        },
      });
    } else {
      signup.mutate(signupPayload(), {
        onSuccess: goToOtp,
        onError: (err) => {
          setErrorMsg(getErrorMessage(err, 'Could not create your account. Please try again.'));
          setErrorKind(getStatus(err) === 409 ? 'account-exists' : 'none');
        },
      });
    }
  };

  const resend = () => {
    clearError();
    const done = { onSuccess: () => setResendTimer(RESEND_SECONDS), onError: (err: unknown) => setErrorMsg(getErrorMessage(err, 'Could not resend the OTP.')) };
    if (mode === 'signin') requestOtp.mutate(phone, done);
    else signup.mutate(signupPayload(), done);
  };

  const verify = (code: string) => {
    clearError();
    verifyOtp.mutate(
      { phone, otp: code },
      {
        onError: (err) => {
          setErrorMsg(getErrorMessage(err, 'That code is not valid. Please try again.'));
          setResetSignal((n) => n + 1);
        },
      },
    );
  };

  return (
    <div className="min-h-[calc(100vh-2rem)] flex flex-col justify-center py-8">
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 sm:p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-500 mb-3">
            <CartIcon className="w-7 h-7" />
          </div>
          <span className="text-xl font-bold tracking-tight text-neutral-900">SocietyCart</span>
          <h1 className="text-sm font-medium text-neutral-600 mt-1">Buy together. Pay wholesale.</h1>
        </div>

        {step === 'form' && (
          <div role="tablist" aria-label="Sign in or create an account" className="flex bg-neutral-100 p-1 rounded-xl mb-6">
            {(['signin', 'signup'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => switchMode(m)}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                  mode === m ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                {m === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>
        )}

        {step === 'otp' ? (
          <OtpStep
            phone={phone}
            errorMsg={errorMsg}
            onClearError={clearError}
            verifying={verifyOtp.isPending}
            resending={sending}
            resendIn={resendTimer}
            resetSignal={resetSignal}
            onVerify={verify}
            onResend={resend}
            onChangeNumber={() => {
              setStep('form');
              clearError();
            }}
          />
        ) : (
          <form onSubmit={submitForm} className="space-y-4" noValidate>
            {mode === 'signup' && (
              <>
                <fieldset>
                  <legend className={label}>I am a</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { value: 'RESIDENT', title: 'Resident', hint: 'Join deals with neighbours' },
                        { value: 'SOCIETY_ADMIN', title: 'Society admin', hint: 'Run deals for my society' },
                      ] as const
                    ).map((o) => (
                      <label
                        key={o.value}
                        className={`cursor-pointer rounded-xl border p-3 text-left transition-colors ${
                          accountType === o.value ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-neutral-300 hover:bg-neutral-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="accountType"
                          value={o.value}
                          checked={accountType === o.value}
                          onChange={() => setAccountType(o.value)}
                          className="sr-only"
                        />
                        <span className="block text-sm font-semibold text-neutral-900">{o.title}</span>
                        <span className="block text-[11px] text-neutral-600 mt-0.5 leading-snug">{o.hint}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div>
                  <label htmlFor="name" className={label}>Full name</label>
                  <input
                    id="name"
                    type="text"
                    autoComplete="name"
                    maxLength={60}
                    placeholder="e.g. Asha Rao"
                    value={name}
                    aria-invalid={name.length > 0 && !isValidName(name)}
                    onChange={(e) => { setName(e.target.value); clearError(); }}
                    className={field}
                  />
                </div>
              </>
            )}

            <div>
              <label htmlFor="phone" className={label}>Mobile number</label>
              <PhoneInput
                value={phone}
                onChange={(v) => { setPhone(v); clearError(); }}
                autoFocus={mode === 'signin'}
                describedBy="phone-hint phone-error"
                invalid={phone.length === 10 && !phoneValid}
              />
              <p id="phone-hint" className="mt-2 text-xs text-neutral-600">
                {mode === 'signin' ? 'We will send a OTP to this number.' : 'We will verify this number with a OTP.'}
              </p>
              <p id="phone-error" role="alert" className="mt-2 text-xs font-medium text-red-700 empty:hidden">
                {phone.length === 10 && !phoneValid ? 'Enter a valid 10-digit Indian mobile number.' : ''}
              </p>
            </div>

            {mode === 'signup' && (
              <>
                <div>
                  <label htmlFor="society" className={label}>Your society</label>
                  <select
                    id="society"
                    value={societyId}
                    onChange={(e) => { setSocietyId(e.target.value); clearError(); }}
                    disabled={societies.isLoading}
                    className={`${field} bg-white`}
                  >
                    <option value="">{societies.isLoading ? 'Loading societies…' : 'Select your society'}</option>
                    {(societies.data ?? []).map((s) => (
                      <option key={s.id} value={s.id}>{s.name}, {s.city}</option>
                    ))}
                  </select>
                  {societies.isError && (
                    <p role="alert" className="mt-2 text-xs font-medium text-red-700">
                      Could not load societies.{' '}
                      <button type="button" onClick={() => void societies.refetch()} className="underline font-semibold">Retry</button>
                    </p>
                  )}
                  {societies.isSuccess && societies.data.length === 0 && (
                    <p className="mt-2 text-xs text-neutral-600">No societies are registered yet. Ask the platform team to add yours.</p>
                  )}
                </div>

                <div>
                  <label htmlFor="flat" className={label}>Flat / door number</label>
                  <input
                    id="flat"
                    type="text"
                    autoComplete="off"
                    maxLength={20}
                    placeholder="e.g. B-1204"
                    value={flatNumber}
                    aria-invalid={flatNumber.length > 0 && !isValidFlat(flatNumber)}
                    onChange={(e) => { setFlatNumber(e.target.value); clearError(); }}
                    className={field}
                  />
                </div>

                {accountType === 'SOCIETY_ADMIN' && (
                  <div>
                    <label htmlFor="adminCode" className={label}>Admin code</label>
                    <input
                      id="adminCode"
                      type="text"
                      autoComplete="off"
                      maxLength={100}
                      placeholder="Given to society administrators"
                      value={adminCode}
                      onChange={(e) => { setAdminCode(e.target.value); clearError(); }}
                      className={field}
                    />
                    <p className="mt-2 text-xs text-neutral-600">Only authorised society administrators can create an admin account.</p>
                  </div>
                )}
              </>
            )}

            {errorMsg && (
              <div role="alert" className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-medium text-red-800 space-y-2">
                <p>{errorMsg}</p>
                {errorKind === 'no-account' && (
                  <button type="button" onClick={() => switchMode('signup')} className="font-bold underline">
                    Create an account with this number
                  </button>
                )}
                {errorKind === 'account-exists' && (
                  <button type="button" onClick={() => switchMode('signin')} className="font-bold underline">
                    Sign in instead
                  </button>
                )}
              </div>
            )}

            <button type="submit" disabled={!canSubmit || sending} className={primaryBtn}>
              {sending ? (
                <>
                  <Spinner />
                  <span>Sending OTP…</span>
                </>
              ) : (
                'Send OTP'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
export default LoginPage;