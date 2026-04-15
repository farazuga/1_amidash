export interface PerDiemRates {
  id: string;
  in_state_rate: number;
  out_of_state_rate: number;
  updated_by: string | null;
  updated_at: string;
}

export interface PerDiemDeposit {
  id: string;
  user_id: string;
  amount: number;
  note: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined
  user?: { id: string; full_name: string | null; email: string };
}

export type PerDiemLocationType = 'in_state' | 'out_of_state';
export type PerDiemStatus = 'pending' | 'approved';

export interface PerDiemEntry {
  id: string;
  user_id: string;
  project_id: string | null;
  project_other_note: string | null;
  start_date: string;
  end_date: string;
  nights: number;
  nights_overridden: boolean;
  location_type: PerDiemLocationType;
  rate: number;
  total: number;
  status: PerDiemStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined
  user?: { id: string; full_name: string | null; email: string };
  project?: {
    id: string;
    client_name: string;
    sales_order_number: string | null;
    delivery_state: string | null;
  } | null;
}

export interface PerDiemBalance {
  total_deposited: number;
  total_spent: number; // approved entries only
  total_pending: number; // pending entries only
  balance: number; // deposited - spent
}
