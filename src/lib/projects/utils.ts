/**
 * Project utility functions
 */

/**
 * Calculate goal completion date based on project type
 * - Box Sale: 30 days out, then select 15th or last day of month (whichever comes first after 30 days)
 * - Solution: 8 weeks out, then select 15th or last day of month (whichever comes first after 8 weeks)
 *
 * @param projectTypeName - The name of the project type (e.g., "Box Sale", "Solution")
 * @param fromDate - Optional starting date (defaults to today)
 * @returns ISO date string (YYYY-MM-DD)
 */
export function calculateGoalDate(projectTypeName: string, fromDate?: Date): string {
  const today = fromDate || new Date();
  let targetDate: Date;

  if (projectTypeName.toLowerCase().includes('box')) {
    // Box Sale: 30 days out
    targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + 30);
  } else if (projectTypeName.toLowerCase().includes('solution')) {
    // Solution: 8 weeks (56 days) out
    targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + 56);
  } else {
    // Default: 30 days out
    targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + 30);
  }

  // Get the year and month of the target date
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth();
  const dayOfMonth = targetDate.getDate();

  // Get last day of the month
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();

  // Determine if we should use 15th or last day
  // If target date is on or before 15th, use 15th
  // If target date is after 15th, use last day of month
  let goalDay: number;
  if (dayOfMonth <= 15) {
    goalDay = 15;
  } else {
    goalDay = lastDayOfMonth;
  }

  const goalDate = new Date(year, month, goalDay);
  return goalDate.toISOString().split('T')[0];
}

/**
 * Validate that a date string is within the allowed range (2024-2030)
 * Uses explicit date parsing to avoid timezone issues
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns true if valid or empty, false otherwise
 */
export function validateDateInRange(dateStr: string): boolean {
  if (!dateStr) return true; // Empty is valid
  // Parse YYYY-MM-DD format explicitly to avoid timezone issues
  const parts = dateStr.split('-');
  if (parts.length !== 3) return false;
  const year = parseInt(parts[0], 10);
  if (isNaN(year)) return false;
  return year >= 2024 && year <= 2030;
}

/**
 * Clean sales amount by removing currency symbols and formatting
 *
 * @param value - Raw input string (e.g., "$1,234.56")
 * @returns Cleaned numeric string
 */
export function cleanSalesAmount(value: string): string {
  // Remove $ and , characters, return cleaned number string
  const cleaned = value.replace(/[$,]/g, '').trim();
  // Validate it matches a number pattern
  if (cleaned && !/^-?\d*\.?\d+$/.test(cleaned)) {
    return '';
  }
  return cleaned;
}

/**
 * Format phone number to standard format (xxx-xxx-xxxx)
 * Handles extensions and international formats
 *
 * @param phone - Raw phone input
 * @returns Formatted phone string
 */
export function formatPhoneNumber(phone: string): string {
  // Extract digits only for the first 10 characters
  const digits = phone.replace(/\D/g, '');

  // If we have at least 10 digits, format the first 10 as xxx-xxx-xxxx
  if (digits.length >= 10) {
    const formatted = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    // Keep any remaining characters (for extensions like "ext 123" or "x123")
    const afterDigits = phone.replace(/^[\d\s\-().]+/, '').trim();
    if (afterDigits) {
      return `${formatted} ${afterDigits}`;
    }
    // If remaining digits exist beyond 10, add them as extension
    if (digits.length > 10) {
      return `${formatted} ext ${digits.slice(10)}`;
    }
    return formatted;
  }

  return phone; // Return as-is if less than 10 digits
}

/**
 * Validate email format
 *
 * @param email - Email string to validate
 * @returns true if valid email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate sales order number format (S1XXXX)
 *
 * @param salesOrderNumber - Sales order number to validate
 * @returns Error message if invalid, null if valid
 */
export function validateSalesOrderNumber(salesOrderNumber: string | null | undefined): string | null {
  if (!salesOrderNumber || !salesOrderNumber.trim()) return null;
  const trimmed = salesOrderNumber.trim();
  if (!trimmed.startsWith('S1') || trimmed.length !== 6) {
    return 'Must start with "S1" and be exactly 6 characters (e.g., S12345)';
  }
  return null;
}

/**
 * Validate phone number has at least 10 digits
 *
 * @param phone - Phone number to validate
 * @returns true if valid
 */
export function validatePhoneNumber(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10;
}

/**
 * Form validation result
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate project form data
 *
 * @param params - Form values to validate
 * @returns Validation result with error message if invalid
 */
export function validateProjectForm(params: {
  selectedSalesperson: string;
  selectedProjectType: string;
  isEditing: boolean;
  salesOrderNumber: string;
  pocName: string;
  pocEmail: string;
  pocPhone: string;
  goalCompletionDate: string;
  createdDate: string;
  startDate: string;
  endDate: string;
  salesAmount: string;
  secondaryPocEmail: string;
}): ValidationResult {
  const {
    selectedSalesperson,
    selectedProjectType,
    isEditing,
    salesOrderNumber,
    pocName,
    pocEmail,
    pocPhone,
    goalCompletionDate,
    createdDate,
    startDate,
    endDate,
    salesAmount,
    secondaryPocEmail,
  } = params;

  // Validate salesperson
  if (!selectedSalesperson) {
    return { valid: false, error: 'Please select a salesperson' };
  }

  // Validate project type for new projects
  if (!isEditing && !selectedProjectType) {
    return { valid: false, error: 'Please select a project type' };
  }

  // Validate sales order number
  const salesOrderError = validateSalesOrderNumber(salesOrderNumber);
  if (salesOrderError) {
    return { valid: false, error: `Sales Order # ${salesOrderError}` };
  }

  // Validate POC fields
  if (!pocName?.trim() || !pocEmail?.trim() || !pocPhone?.trim()) {
    return { valid: false, error: 'All Point of Contact fields are required' };
  }

  // Validate email format
  if (!validateEmail(pocEmail)) {
    return { valid: false, error: 'Please enter a valid email address' };
  }

  // Validate phone
  if (!validatePhoneNumber(pocPhone)) {
    return { valid: false, error: 'Phone number must have at least 10 digits' };
  }

  // Validate dates
  if (goalCompletionDate && !validateDateInRange(goalCompletionDate)) {
    return { valid: false, error: 'Goal completion date must be between 2024 and 2030' };
  }

  if (createdDate && !validateDateInRange(createdDate)) {
    return { valid: false, error: 'Created date must be between 2024 and 2030' };
  }

  if (startDate && !validateDateInRange(startDate)) {
    return { valid: false, error: 'Start date must be between 2024 and 2030' };
  }

  if (endDate && !validateDateInRange(endDate)) {
    return { valid: false, error: 'End date must be between 2024 and 2030' };
  }

  if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
    return { valid: false, error: 'End date must be after start date' };
  }

  // Validate sales amount
  if (salesAmount) {
    const cleaned = cleanSalesAmount(salesAmount);
    if (cleaned) {
      const parsed = parseFloat(cleaned);
      if (isNaN(parsed) || parsed < 0) {
        return { valid: false, error: 'Please enter a valid sales amount' };
      }
    }
  }

  // Validate secondary email if provided
  if (secondaryPocEmail && secondaryPocEmail.trim() && !validateEmail(secondaryPocEmail.trim())) {
    return { valid: false, error: 'Please enter a valid secondary email address' };
  }

  return { valid: true };
}
