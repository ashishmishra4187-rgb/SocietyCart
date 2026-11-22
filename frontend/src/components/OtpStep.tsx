import React, { useEffect, useRef, useState } from 'react';
import { Spinner } from './ui/Spinner';

const OTP_LENGTH = 6;
const emptyOtp = () => Array<string>(OTP_LENGTH).fill('');

interface OtpStepProps {
  phone: string;
  /** Shown under the boxes (wrong code, too many attempts...). */
  errorMsg: string | null;
  onClearError: () => void;
  verifying: boolean;
  resending: boolean;
  /** Seconds until "Resend" is allowed. */
  resendIn: number;
  /** Increment to clear the boxes and refocus (e.g. after a wrong code). */
  resetSignal: number;
  onVerify: (code: string) => void;
  onResend: () => void;
  onChangeNumber: () => void;
}

/** Six-box one-time-code entry with paste, autofill (one-time-code) and keyboard navigation. */
export const OtpStep: React.FC<OtpStepProps> = ({
  phone,
  errorMsg,
  onClearError,
  verifying,
  resending,
  resendIn,
  resetSignal,
  onVerify,
  onResend,
  onChangeNumber,
}) => {
  const [otp, setOtp] = useState<string[]>(emptyOtp);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (resetSignal === 0) return;
    setOtp(emptyOtp());
    inputs.current[0]?.focus();
  }, [resetSignal]);

  const changeDigit = (index: number, value: string) => {
    const digits = value.replace(/\D/g, '');
    const prev = otp[index] ?? '';

    if (!digits) {
      const next = [...otp];
      next[index] = '';
      setOtp(next);
      return;
    }
    onClearError();

    // Many digits at once, or several digits arriving in an EMPTY box: the OS/browser autofilled the code
    // (or an IME sent a burst). Spread them across the boxes starting here.
    if (digits.length >= OTP_LENGTH || (digits.length > 1 && prev === '')) {
      const next = [...otp];
      for (let i = 0; i < digits.length && index + i < OTP_LENGTH; i++) next[index + i] = digits[i] ?? '';
      setOtp(next);
      inputs.current[Math.min(index + digits.length, OTP_LENGTH - 1)]?.focus();
      return;
    }

    // One digit typed. If the box already held a digit it now holds two characters; keep only the newly
    // typed one (removing one copy of the old digit leaves exactly the new key press).
    const typed = prev !== '' && digits.length > 1 ? digits.replace(prev, '') : digits;
    const isLastBox = index === OTP_LENGTH - 1;

    // The code is already complete and the cursor sits in the last box: ignore the extra key press instead
    // of letting it overwrite the code. (The controlled input snaps back to the existing digit.)
    if (isLastBox && prev !== '' && digits.length > 1) return;

    const next = [...otp];
    next[index] = typed.slice(-1);
    setOtp(next);
    if (index < OTP_LENGTH - 1) inputs.current[index + 1]?.focus();
  };

  const keyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) inputs.current[index - 1]?.focus();
    if (e.key === 'ArrowLeft' && index > 0) inputs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) inputs.current[index + 1]?.focus();
  };

  const paste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    setOtp(Array.from({ length: OTP_LENGTH }, (_, i) => pasted[i] ?? ''));
    onClearError();
    inputs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  };

  const code = otp.join('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (code.length === OTP_LENGTH) onVerify(code);
      }}
      className="space-y-6"
      noValidate
    >
      <fieldset>
        <legend className="text-sm text-neutral-700 text-center mb-6 w-full">
          Enter the 6-digit code sent to <span className="font-semibold text-neutral-900">+91 {phone}</span>
        </legend>
        <div className="flex justify-between gap-2">
          {otp.map((digit, idx) => (
            <input
              key={idx}
              ref={(el) => {
                inputs.current[idx] = el;
              }}
              type="text"
              inputMode="numeric"
              autoComplete={idx === 0 ? 'one-time-code' : 'off'}
              aria-label={`Digit ${idx + 1} of ${OTP_LENGTH}`}
              value={digit}
              onChange={(e) => changeDigit(idx, e.target.value)}
              onKeyDown={(e) => keyDown(idx, e)}
              onPaste={paste}
              onFocus={(e) => e.currentTarget.select()}
              className="w-11 h-13 sm:w-12 sm:h-14 text-center text-xl font-semibold text-neutral-900 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
            />
          ))}
        </div>
        {errorMsg && (
          <p role="alert" className="mt-3 text-xs font-medium text-center text-red-700">
            {errorMsg}
          </p>
        )}
      </fieldset>

      <button
        type="submit"
        disabled={code.length !== OTP_LENGTH || verifying}
        className="w-full py-3.5 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-medium text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-brand-500 focus-visible:ring-2 focus-visible:ring-offset-2 flex items-center justify-center gap-2"
      >
        {verifying ? (
          <>
            <Spinner />
            <span>Verifying…</span>
          </>
        ) : (
          'Verify'
        )}
      </button>

      <div className="flex items-center justify-between text-xs pt-1 border-t border-neutral-100">
        <button type="button" onClick={onChangeNumber} className="font-medium text-neutral-700 hover:text-neutral-900 underline rounded p-1">
          Change number
        </button>
        {resendIn > 0 ? (
          <span className="text-neutral-600">Resend in {resendIn}s</span>
        ) : (
          <button
            type="button"
            disabled={resending}
            onClick={onResend}
            className="font-medium text-brand-600 hover:text-brand-700 rounded p-1 disabled:opacity-50"
          >
            Resend OTP
          </button>
        )}
      </div>
    </form>
  );
};
export default OtpStep;