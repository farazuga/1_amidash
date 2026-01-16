// Dashboard threshold types and defaults
// Separated from server actions to allow client-side usage

export interface DashboardThresholds {
  wipAgingDays: number;
  salesHealthThreshold: number;
  operationsHealthThreshold: number;
  ontimeGoodThreshold: number;
  ontimeWarningThreshold: number;
  concentrationHighThreshold: number;
  concentrationMediumThreshold: number;
  backlogWarningMonths: number;
  // New thresholds for dashboard improvements
  notScheduledWarningDays: number;
  lowInvoiceWarningPercent: number;
  signageMinProjectValue: number;
  signageUpcomingDays: number;
}

export const DEFAULT_THRESHOLDS: DashboardThresholds = {
  wipAgingDays: 14,
  salesHealthThreshold: 80,
  operationsHealthThreshold: 60,
  ontimeGoodThreshold: 80,
  ontimeWarningThreshold: 60,
  concentrationHighThreshold: 70,
  concentrationMediumThreshold: 50,
  backlogWarningMonths: 6,
  // New thresholds for dashboard improvements
  notScheduledWarningDays: 14,
  lowInvoiceWarningPercent: 80,
  signageMinProjectValue: 10000,
  signageUpcomingDays: 30,
};
