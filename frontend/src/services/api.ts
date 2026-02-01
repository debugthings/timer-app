import axios from 'axios';
import type {
  Settings,
  Person,
  Timer,
  DailyAllocation,
  Checkout,
  CreatePersonRequest,
  CreateTimerRequest,
  UpdateTimerRequest,
  UpdateAllocationRequest,
  CreateCheckoutRequest,
  VerifyPinRequest,
  SetPinRequest,
} from '../types';

const api = axios.create({
  baseURL: '/api',
});

// Admin PIN header interceptor
let adminPin: string | null = null;

export function setAdminPin(pin: string | null) {
  adminPin = pin;
}

api.interceptors.request.use((config) => {
  if (adminPin) {
    config.headers['x-admin-pin'] = adminPin;
  }
  return config;
});

// Settings & Admin
export const getSettings = () => api.get<Settings>('/admin/settings').then((r) => r.data);

export const verifyPin = (data: VerifyPinRequest) =>
  api.post<{ valid: boolean }>('/admin/verify-pin', data).then((r) => r.data);

export const setPin = (data: SetPinRequest) =>
  api.post<{ success: boolean }>('/admin/set-pin', data).then((r) => r.data);

// People
export const getPeople = () => api.get<Person[]>('/people').then((r) => r.data);

export const getPerson = (id: string) => api.get<Person>(`/people/${id}`).then((r) => r.data);

export const createPerson = (data: CreatePersonRequest) =>
  api.post<Person>('/people', data).then((r) => r.data);

export const updatePerson = (id: string, data: CreatePersonRequest) =>
  api.put<Person>(`/people/${id}`, data).then((r) => r.data);

export const deletePerson = (id: string) =>
  api.delete<{ success: boolean }>(`/people/${id}`).then((r) => r.data);

// Timers
export const getTimers = () => api.get<Timer[]>('/timers').then((r) => r.data);

export const getTimer = (id: string) => api.get<Timer>(`/timers/${id}`).then((r) => r.data);

export const createTimer = (data: CreateTimerRequest) =>
  api.post<Timer>('/timers', data).then((r) => r.data);

export const updateTimer = (id: string, data: UpdateTimerRequest) =>
  api.put<Timer>(`/timers/${id}`, data).then((r) => r.data);

export const updateTimerAlarmSound = (id: string, alarmSound: string) =>
  api.patch<Pick<Timer, 'id' | 'name' | 'alarmSound'>>(`/timers/${id}/alarm-sound`, { alarmSound }).then((r) => r.data);

export const deleteTimer = (id: string) =>
  api.delete<{ success: boolean }>(`/timers/${id}`).then((r) => r.data);

// Allocations
export const getAllocation = (timerId: string, date?: string) => {
  const params = date ? { date } : {};
  return api.get<DailyAllocation>(`/timers/${timerId}/allocation`, { params }).then((r) => r.data);
};

export const updateAllocation = (timerId: string, data: UpdateAllocationRequest) =>
  api.put<DailyAllocation>(`/timers/${timerId}/allocation`, data).then((r) => r.data);

// Checkouts
export const createCheckout = (data: CreateCheckoutRequest) =>
  api.post<Checkout>('/checkouts', data).then((r) => r.data);

export const getCheckout = (id: string) => api.get<Checkout>(`/checkouts/${id}`).then((r) => r.data);

export const startCheckout = (id: string) =>
  api.post<any>(`/checkouts/${id}/start`).then((r) => r.data);

export const pauseCheckout = (id: string) =>
  api.post<Checkout>(`/checkouts/${id}/pause`).then((r) => r.data);

export const stopCheckout = (id: string) =>
  api.post<Checkout>(`/checkouts/${id}/stop`).then((r) => r.data);

export const cancelCheckout = (id: string) =>
  api.post<Checkout>(`/checkouts/${id}/cancel`).then((r) => r.data);
