import axiosClient from './axiosClient';
import type { ResidentProfile, ResidentRole, SocietyOption } from '../types';

export interface VerifyResponse {
  /** Optional: only present for backends that haven't moved to cookie auth. */
  token?: string;
  residentId: string;
  societyId: string;
  flatNumber: string;
  role?: ResidentRole;
  name?: string;
  /** True when this verification just created the account. */
  newAccount?: boolean;
}

export interface SignupPayload {
  phone: string;
  name: string;
  societyId: string;
  flatNumber: string;
  role: 'RESIDENT' | 'SOCIETY_ADMIN';
  /** Required only for SOCIETY_ADMIN. */
  adminCode?: string;
}

export interface UpdateProfilePayload {
  name?: string;
  flatNumber?: string;
}

export const requestOtp = async (phone: string): Promise<void> => {
  await axiosClient.post('/api/auth/otp', { phone });
};

/** Create-account step 1: details are held by the server until the phone is verified. */
export const signup = async (payload: SignupPayload): Promise<void> => {
  await axiosClient.post('/api/auth/signup', payload);
};

export const getSignupSocieties = async (): Promise<SocietyOption[]> => {
  const { data } = await axiosClient.get<SocietyOption[]>('/api/auth/societies');
  return data;
};

export const verifyOtp = async (phone: string, otp: string): Promise<VerifyResponse> => {
  const { data } = await axiosClient.post<VerifyResponse>('/api/auth/verify', { phone, otp });
  return data;
};

export const logoutRequest = async (): Promise<void> => {
  await axiosClient.post('/api/auth/logout');
};

export const getProfile = async (): Promise<ResidentProfile> => {
  const { data } = await axiosClient.get<ResidentProfile>('/api/residents/me');
  return data;
};

export const updateProfile = async (payload: UpdateProfilePayload): Promise<ResidentProfile> => {
  const { data } = await axiosClient.patch<ResidentProfile>('/api/residents/me', payload);
  return data;
};
