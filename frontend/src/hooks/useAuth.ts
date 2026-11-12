import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { setMemoryToken } from '../api/axiosClient';
import {
  getProfile,
  getSignupSocieties,
  logoutRequest,
  requestOtp,
  signup,
  updateProfile,
  verifyOtp,
  type SignupPayload,
  type UpdateProfilePayload,
  type VerifyResponse,
} from '../api/authApi';
import { useAuthContext } from '../context/AuthContext';
import type { ResidentProfile } from '../types';

export type { ResidentProfile } from '../types';
export type { UpdateProfilePayload } from '../api/authApi';

interface LocationState {
  from?: string;
}

export const useRequestOtp = () => useMutation({ mutationFn: (phone: string) => requestOtp(phone) });

export const useSignup = () => useMutation({ mutationFn: (payload: SignupPayload) => signup(payload) });

export const useSignupSocieties = (enabled: boolean) =>
  useQuery({ queryKey: ['auth', 'societies'], queryFn: getSignupSocieties, enabled, staleTime: 5 * 60 * 1000 });

export const useVerifyOtp = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setSession } = useAuthContext();

  return useMutation({
    mutationFn: ({ phone, otp }: { phone: string; otp: string }) => verifyOtp(phone, otp),
    onSuccess: (data: VerifyResponse) => {
      setMemoryToken(data.token ?? null);
      setSession({
        residentId: data.residentId,
        societyId: data.societyId,
        flatNumber: data.flatNumber,
        role: data.role,
      });
      const from = (location.state as LocationState | null)?.from;
      // Only follow same-app absolute paths (never an external URL).
      const safeFrom = from && from.startsWith('/') && !from.startsWith('//') && from !== '/login' ? from : null;
      navigate(safeFrom ?? `/s/${data.societyId}`, { replace: true });
    },
  });
};

export const useResidentProfile = () =>
  useQuery<ResidentProfile>({ queryKey: ['residents', 'me'], queryFn: getProfile, staleTime: 60 * 1000 });

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  const { session, setSession } = useAuthContext();

  return useMutation({
    mutationFn: (payload: UpdateProfilePayload) => updateProfile(payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(['residents', 'me'], updated);
      if (session && updated.flatNumber) setSession({ ...session, flatNumber: updated.flatNumber });
    },
  });
};

export const useLogout = () => {
  const navigate = useNavigate();
  const { logout } = useAuthContext();
  const queryClient = useQueryClient();

  return () => {
    // Best effort: clears the httpOnly cookie server-side. Local logout happens regardless.
    void logoutRequest().catch(() => undefined);
    logout();
    queryClient.clear();
    navigate('/login', { replace: true });
  };
};
