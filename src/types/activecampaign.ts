// Active Campaign API Types

export interface ACAccount {
  id: string;
  name: string;
  accountUrl: string | null;
  contactCount: string;
  dealCount: string;
  createdTimestamp?: string;
  updatedTimestamp?: string;
}

export interface ACContact {
  id: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  cdate?: string;
  udate?: string;
}

export interface ACAccountSearchResponse {
  accounts: ACAccount[];
  meta?: {
    total: string;
  };
}

export interface ACContactsResponse {
  contacts: ACContact[];
  meta?: {
    total: string;
  };
}

// Helper type for displaying contacts with full name
export interface ACContactDisplay extends ACContact {
  fullName: string;
}

// Convert ACContact to display format
export function toContactDisplay(contact: ACContact): ACContactDisplay {
  return {
    ...contact,
    fullName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email,
  };
}
