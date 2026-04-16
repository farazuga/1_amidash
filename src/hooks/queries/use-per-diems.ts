import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getRates,
  updateRates,
  getDeposits,
  createDeposits,
  updateDeposit,
  getEntries,
  createEntry,
  updateEntry,
  deleteEntry,
  approveEntries,
  getBalance,
  getStaffUsers,
  searchProjects,
} from '@/app/(dashboard)/per-diem/actions';

export const PER_DIEM_KEYS = {
  rates: ['per-diem', 'rates'] as const,
  deposits: (userId?: string) => ['per-diem', 'deposits', userId] as const,
  entries: (filters?: Record<string, unknown>) => ['per-diem', 'entries', filters] as const,
  balance: (userId?: string) => ['per-diem', 'balance', userId] as const,
  staff: ['per-diem', 'staff'] as const,
  projects: (query: string) => ['per-diem', 'projects', query] as const,
};

const THIRTY_SECONDS = 30 * 1000;

// ============================================
// Rate Hooks
// ============================================

export function usePerDiemRates() {
  return useQuery({
    queryKey: PER_DIEM_KEYS.rates,
    queryFn: async () => {
      const result = await getRates();
      if (!result.success) throw new Error(result.error);
      return result.data!;
    },
    staleTime: THIRTY_SECONDS,
  });
}

export function useUpdateRates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { in_state_rate: number; out_of_state_rate: number }) => {
      const result = await updateRates(data);
      if (!result.success) throw new Error(result.error);
      return result.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PER_DIEM_KEYS.rates });
    },
  });
}

// ============================================
// Deposit Hooks
// ============================================

export function useDeposits(userId?: string) {
  return useQuery({
    queryKey: PER_DIEM_KEYS.deposits(userId),
    queryFn: async () => {
      const result = await getDeposits(userId);
      if (!result.success) throw new Error(result.error);
      return result.data || [];
    },
    staleTime: THIRTY_SECONDS,
  });
}

export function useCreateDeposits() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      deposits: { user_id: string; amount: number; note?: string }[];
    }) => {
      const result = await createDeposits(data);
      if (!result.success) throw new Error(result.error);
      return result.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['per-diem', 'deposits'] });
      queryClient.invalidateQueries({ queryKey: ['per-diem', 'balance'] });
    },
  });
}

export function useUpdateDeposit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { id: string; amount?: number; note?: string }) => {
      const result = await updateDeposit(data);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['per-diem', 'deposits'] });
      queryClient.invalidateQueries({ queryKey: ['per-diem', 'balance'] });
    },
  });
}

// ============================================
// Entry Hooks
// ============================================

export function useEntries(filters?: { userId?: string; year?: number; status?: string }) {
  return useQuery({
    queryKey: PER_DIEM_KEYS.entries(filters as Record<string, unknown>),
    queryFn: async () => {
      const result = await getEntries(filters);
      if (!result.success) throw new Error(result.error);
      return result.data || [];
    },
    staleTime: THIRTY_SECONDS,
  });
}

export function useCreateEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      user_id: string;
      project_id: string | null;
      project_other_note?: string | null;
      start_date: string;
      end_date: string;
      nights: number;
      nights_overridden?: boolean;
      location_type: 'in_state' | 'out_of_state';
      rate: number;
      total: number;
    }) => {
      const result = await createEntry(data);
      if (!result.success) throw new Error(result.error);
      return result.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['per-diem', 'entries'] });
      queryClient.invalidateQueries({ queryKey: ['per-diem', 'balance'] });
    },
  });
}

export function useUpdateEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      id: string;
      project_id?: string | null;
      project_other_note?: string | null;
      start_date?: string;
      end_date?: string;
      nights?: number;
      nights_overridden?: boolean;
      location_type?: 'in_state' | 'out_of_state';
      rate?: number;
      total?: number;
    }) => {
      const result = await updateEntry(data);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['per-diem', 'entries'] });
      queryClient.invalidateQueries({ queryKey: ['per-diem', 'balance'] });
    },
  });
}

export function useDeleteEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteEntry(id);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['per-diem', 'entries'] });
      queryClient.invalidateQueries({ queryKey: ['per-diem', 'balance'] });
    },
  });
}

export function useApproveEntries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { entry_ids: string[] }) => {
      const result = await approveEntries(data);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['per-diem', 'entries'] });
      queryClient.invalidateQueries({ queryKey: ['per-diem', 'balance'] });
    },
  });
}

// ============================================
// Balance Hook
// ============================================

export function usePerDiemBalance(userId?: string) {
  return useQuery({
    queryKey: PER_DIEM_KEYS.balance(userId),
    queryFn: async () => {
      const result = await getBalance(userId);
      if (!result.success) throw new Error(result.error);
      return result.data!;
    },
    staleTime: THIRTY_SECONDS,
  });
}

// ============================================
// Utility Hooks
// ============================================

export function useStaffUsers() {
  return useQuery({
    queryKey: PER_DIEM_KEYS.staff,
    queryFn: async () => {
      const result = await getStaffUsers();
      if (!result.success) throw new Error(result.error);
      return result.data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useProjectSearch(query: string) {
  return useQuery({
    queryKey: PER_DIEM_KEYS.projects(query),
    queryFn: async () => {
      const result = await searchProjects(query);
      if (!result.success) throw new Error(result.error);
      return result.data || [];
    },
    enabled: query.length >= 2,
    staleTime: THIRTY_SECONDS,
  });
}
