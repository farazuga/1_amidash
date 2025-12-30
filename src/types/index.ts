import type { BookingStatus } from './calendar';

export type UserRole = 'viewer' | 'editor' | 'admin' | 'customer';

export type ContractType =
  | 'None'
  | 'South Carolina Purchasing'
  | 'TIPs Contract'
  | 'State of Georgia Purchasing Agreement';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: string | null;
  is_salesperson: boolean | null;
  is_assignable?: boolean | null;  // Optional until migration runs
  created_at: string | null;
  updated_at: string | null;
}

export interface Status {
  id: string;
  name: string;
  display_order: number;
  require_note: boolean | null;
  is_exception: boolean | null;
  is_active: boolean | null;
  created_at: string | null;
}

export interface ProjectType {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean | null;
  created_at: string | null;
}

export interface ProjectTypeStatus {
  project_type_id: string;
  status_id: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string | null;
  created_at: string | null;
}

export interface Project {
  id: string;
  created_date: string;
  client_name: string;
  sales_order_number: string | null;
  sales_order_url: string | null;
  po_number: string | null;
  sales_amount: number | null;
  contract_type: string | null;
  goal_completion_date: string | null;
  // Calendar scheduling fields
  start_date: string | null;
  end_date: string | null;
  schedule_status: BookingStatus | null;
  current_status_id: string | null;
  project_type_id: string | null;
  salesperson_id: string | null;
  poc_name: string | null;
  poc_email: string | null;
  poc_phone: string | null;
  secondary_poc_email: string | null;
  activecampaign_account_id: string | null;
  activecampaign_contact_id: string | null;
  secondary_activecampaign_contact_id: string | null;
  scope_link: string | null;
  client_token: string | null;
  client_portal_url?: string | null;
  client_portal_views?: number;
  expected_update_date: string | null;
  expected_update_auto: boolean | null;
  email_notifications_enabled: boolean | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  // Joined relations
  current_status?: Status | null;
  project_type?: ProjectType | null;
  tags?: Tag[] | { tag: Tag }[];
  created_by_profile?: Profile | null;
  salesperson?: Profile | null;
}

export interface ProjectTag {
  project_id: string;
  tag_id: string;
}

export interface StatusHistory {
  id: string;
  project_id: string;
  status_id: string;
  note: string | null;
  changed_by: string | null;
  changed_at: string;
  // Joined relations
  status?: Status;
  changed_by_profile?: Profile;
}

export interface AuditLog {
  id: string;
  project_id: string | null;
  user_id: string | null;
  action: 'create' | 'update' | 'delete';
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  // Joined relations
  project?: Project;
  user?: Profile;
}

export interface SavedFilter {
  id: string;
  user_id: string;
  name: string;
  filters: FilterState;
  is_default: boolean;
  created_at: string;
}

export interface FilterState {
  search?: string;
  statuses?: string[];
  contract_types?: ContractType[];
  tags?: string[];
  date_from?: string;
  date_to?: string;
  overdue_only?: boolean;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

// Dashboard analytics types
export interface DashboardStats {
  total_projects: number;
  total_revenue: number;
  overdue_count: number;
  projects_by_status: { status: string; count: number; color: string }[];
  revenue_by_month: { month: string; revenue: number }[];
}

// Revenue goals types
export interface RevenueGoal {
  id: string;
  year: number;
  month: number;
  revenue_goal: number;
  projects_goal: number;
  invoiced_revenue_goal: number;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

// Project Files types
export type FileCategory = 'schematics' | 'sow' | 'photos' | 'videos' | 'other';

export type ProjectPhase = 'quoting' | 'engineering' | 'onsite' | 'complete' | 'other';

export type UploadStatus = 'pending' | 'uploading' | 'uploaded' | 'failed';

export interface ProjectSharePointConnection {
  id: string;
  project_id: string;
  site_id: string;
  drive_id: string;
  folder_id: string;
  folder_path: string;
  folder_url: string;
  connected_by: string;
  last_synced_at: string | null;
  sync_error: string | null;
  auto_created: boolean;  // True if auto-created from global config
  created_at: string;
  updated_at: string;
  // Joined relations
  connected_by_profile?: Profile | null;
}

// Global SharePoint configuration (admin-only, stored in app_settings)
export interface SharePointGlobalConfig {
  site_id: string;
  site_name: string;
  drive_id: string;
  drive_name: string;
  base_folder_id: string;
  base_folder_path: string;
  base_folder_url: string;
  configured_by: string;
  configured_at: string;
}

// Pre-sales files: Captured BEFORE project exists (linked to ActiveCampaign deal)
export interface PresalesFile {
  id: string;
  activecampaign_deal_id: string;
  activecampaign_deal_name: string | null;
  project_id: string | null;  // Linked after project creation
  file_name: string;
  sharepoint_item_id: string | null;
  category: FileCategory;
  file_size: number | null;
  mime_type: string | null;
  file_extension: string | null;
  web_url: string | null;
  download_url: string | null;
  thumbnail_url: string | null;
  sharepoint_folder_path: string | null;
  uploaded_by: string | null;
  upload_status: UploadStatus;
  upload_error: string | null;
  captured_on_device: string | null;
  captured_offline: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined relations
  uploaded_by_profile?: Profile | null;
  project?: Project | null;
}

export interface ProjectFile {
  id: string;
  project_id: string;
  connection_id: string | null;
  presales_file_id: string | null;  // Link to original presales file if migrated
  file_name: string;
  sharepoint_item_id: string | null;
  category: FileCategory;
  file_size: number | null;
  mime_type: string | null;
  file_extension: string | null;
  web_url: string | null;
  download_url: string | null;
  thumbnail_url: string | null;
  uploaded_by: string | null;
  sharepoint_modified_by: string | null;
  sharepoint_modified_at: string | null;
  project_phase: ProjectPhase | null;
  notes: string | null;
  upload_status: UploadStatus;
  upload_error: string | null;
  is_synced: boolean;
  sync_error: string | null;
  captured_on_device: string | null;
  captured_offline: boolean;
  offline_id: string | null;  // Client-generated ID for offline tracking
  created_at: string;
  updated_at: string;
  // Joined relations
  uploaded_by_profile?: Profile | null;
  presales_file?: PresalesFile | null;
}

export interface ProjectFileAccessLog {
  id: string;
  file_id: string;
  user_id: string;
  action: 'view' | 'download' | 'share';
  created_at: string;
  // Joined relations
  user?: Profile | null;
  file?: ProjectFile | null;
}

export interface FileCategoryCount {
  category: FileCategory;
  count: number;
}

// File category display configuration
export const FILE_CATEGORY_CONFIG: Record<FileCategory, { label: string; icon: string; description: string }> = {
  schematics: {
    label: 'Schematics',
    icon: 'FileCode',
    description: 'CAD drawings, diagrams, engineering documents',
  },
  sow: {
    label: 'SOW',
    icon: 'FileText',
    description: 'Scope of Work, proposals, contracts',
  },
  photos: {
    label: 'Photos',
    icon: 'Image',
    description: 'Site photos, installation images',
  },
  videos: {
    label: 'Videos',
    icon: 'Video',
    description: 'Site videos, recordings',
  },
  other: {
    label: 'Other',
    icon: 'File',
    description: 'Miscellaneous files',
  },
};

export const PROJECT_PHASE_CONFIG: Record<ProjectPhase, { label: string }> = {
  quoting: { label: 'Quoting' },
  engineering: { label: 'Engineering Review' },
  onsite: { label: 'Onsite' },
  complete: { label: 'Complete' },
  other: { label: 'Other' },
};

// Offline file capture types (stored in IndexedDB until synced)
export interface OfflineFileCapture {
  id: string;  // Client-generated UUID
  // Context: either project or presales deal
  project_id?: string;
  activecampaign_deal_id?: string;
  // File data
  file_name: string;
  file_blob: Blob;  // The actual file data
  file_size: number;
  mime_type: string;
  file_extension: string;
  // Metadata
  category: FileCategory;
  project_phase?: ProjectPhase;
  notes?: string;
  // Capture context
  captured_at: string;  // ISO timestamp
  captured_by_user_id: string;
  captured_on_device: string;
  // Location (if available)
  latitude?: number;
  longitude?: number;
  // Sync status
  sync_status: 'pending' | 'syncing' | 'synced' | 'failed';
  sync_attempts: number;
  last_sync_error?: string;
  last_sync_attempt?: string;
}

// Device detection helper type
export type DeviceType = 'iPhone' | 'iPad' | 'Android' | 'Desktop' | 'Unknown';

// PWA sync event types
export interface FileSyncEvent {
  type: 'sync_started' | 'sync_progress' | 'sync_complete' | 'sync_failed';
  file_id: string;
  progress?: number;  // 0-100 for upload progress
  error?: string;
}

// SharePoint folder structure for auto-creation
export interface SharePointFolderStructure {
  root: string;  // e.g., "/Projects/ClientName" or "/PreSales/DealID"
  subfolders: FileCategory[];  // Categories to create as subfolders
}
