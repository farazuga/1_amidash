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
  orgname?: string;
  orgid?: string;
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

// Deal types
export interface ACDeal {
  id: string;
  title: string;
  value: string;
  currency: string;
  contact: string;
  account: string;
  stage: string;
  group: string;
  owner: string;
  status: string;
  cdate: string;
  mdate: string;
  nextdate?: string;
}

export interface ACDealStage {
  id: string;
  title: string;
  group: string;
  order: string;
}

export interface ACPipeline {
  id: string;
  title: string;
}

export interface ACDealsResponse {
  deals: ACDeal[];
  meta?: {
    total: string;
  };
}

export interface ACDealStagesResponse {
  dealStages: ACDealStage[];
}

export interface ACPipelinesResponse {
  dealGroups: ACPipeline[];
}

export interface ACDealDisplay extends ACDeal {
  contactName: string;
  accountName: string;
  dealUrl: string;
}
