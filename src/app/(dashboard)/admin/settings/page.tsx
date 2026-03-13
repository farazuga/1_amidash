'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertTriangle, Settings, FolderSync, ExternalLink, Unlink, FolderPlus, CheckCircle2, Archive } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SharePointConfigDialog } from '@/components/admin/sharepoint-config-dialog';
import { EmailSettingsSection } from '@/components/admin/email-settings-section';
import { DashboardThresholdsSection, DEFAULT_DASHBOARD_SETTINGS } from '@/components/admin/dashboard-thresholds-section';
import type { DashboardSettings } from '@/components/admin/dashboard-thresholds-section';
import { TokenStatusSection } from '@/components/admin/token-status-section';
import { ApprovalUserSection } from '@/components/admin/approval-user-section';
import {
  getSharePointConfig,
  removeSharePointConfig,
  checkAdminMicrosoftConnection,
  createMissingSharePointFolders,
  getProjectsWithoutFoldersCount,
  getInvoicedProjectsWithFoldersCount,
  archiveInvoicedProjects,
} from './sharepoint-actions';
import { getApprovalUserId, getApprovalCandidates } from './approval-actions';
import type { SharePointGlobalConfig, Profile } from '@/types';

interface AppSetting {
  key: string;
  value: boolean | number;
  updated_at: string | null;
}

export default function AdminSettingsPage() {
  const [emailsEnabled, setEmailsEnabled] = useState(true);
  const [dashboardSettings, setDashboardSettings] = useState<DashboardSettings>(DEFAULT_DASHBOARD_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [tableExists, setTableExists] = useState(true);
  const supabase = createClient();

  // SharePoint state
  const [sharepointConfig, setSharepointConfig] = useState<SharePointGlobalConfig | null>(null);
  const [sharepointLoading, setSharepointLoading] = useState(true);
  const [msConnected, setMsConnected] = useState(false);
  const [msEmail, setMsEmail] = useState<string | null>(null);
  const [showSharepointDialog, setShowSharepointDialog] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Folder migration state
  const [projectsWithoutFolders, setProjectsWithoutFolders] = useState<{ count: number; total: number }>({ count: 0, total: 0 });
  const [isCreatingFolders, setIsCreatingFolders] = useState(false);

  // Archive invoiced projects state
  const [invoicedProjectsCount, setInvoicedProjectsCount] = useState<number>(0);
  const [isArchiving, setIsArchiving] = useState(false);

  // Customer approval state
  const [approvalUserId, setApprovalUserIdState] = useState<string | null>(null);
  const [approvalCandidates, setApprovalCandidates] = useState<Profile[]>([]);
  const [approvalLoading, setApprovalLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      // Fetch all settings at once
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from as any)('app_settings')
        .select('*');

      if (error) {
        if (error.code === 'PGRST205' || error.code === '42P01') {
          // Table doesn't exist
          setTableExists(false);
        } else if (error.code !== 'PGRST116') {
          console.error('Error fetching settings:', error);
        }
      } else if (data) {
        // Parse email setting
        const emailSetting = data.find((s: AppSetting) => s.key === 'emails_enabled');
        if (emailSetting) {
          setEmailsEnabled(emailSetting.value === true || emailSetting.value === 'true');
        }

        // Parse dashboard settings
        const newDashboardSettings = { ...DEFAULT_DASHBOARD_SETTINGS };
        const settingKeyMap: Record<string, keyof DashboardSettings> = {
          'dashboard_wip_aging_days': 'wipAgingDays',
          'dashboard_sales_health_threshold': 'salesHealthThreshold',
          'dashboard_operations_health_threshold': 'operationsHealthThreshold',
          'dashboard_ontime_good_threshold': 'ontimeGoodThreshold',
          'dashboard_ontime_warning_threshold': 'ontimeWarningThreshold',
          'dashboard_concentration_high_threshold': 'concentrationHighThreshold',
          'dashboard_concentration_medium_threshold': 'concentrationMediumThreshold',
          'dashboard_backlog_warning_months': 'backlogWarningMonths',
          // New settings
          'dashboard_not_scheduled_warning_days': 'notScheduledWarningDays',
          'dashboard_low_invoice_warning_percent': 'lowInvoiceWarningPercent',
          'dashboard_signage_min_project_value': 'signageMinProjectValue',
          'dashboard_signage_upcoming_days': 'signageUpcomingDays',
        };

        data.forEach((setting: AppSetting) => {
          const key = settingKeyMap[setting.key];
          if (key) {
            newDashboardSettings[key] = typeof setting.value === 'number'
              ? setting.value
              : Number(setting.value) || DEFAULT_DASHBOARD_SETTINGS[key];
          }
        });

        setDashboardSettings(newDashboardSettings);
      }

      setIsLoading(false);
    };

    fetchSettings();
  }, [supabase]);

  // Fetch SharePoint config, Microsoft connection status, and folder counts
  useEffect(() => {
    const fetchSharePointSettings = async () => {
      setSharepointLoading(true);
      try {
        const [configResult, msResult, folderCount, invoicedCount] = await Promise.all([
          getSharePointConfig(),
          checkAdminMicrosoftConnection(),
          getProjectsWithoutFoldersCount(),
          getInvoicedProjectsWithFoldersCount(),
        ]);

        if (configResult.success) {
          setSharepointConfig(configResult.config || null);
        }
        setMsConnected(msResult.connected);
        setMsEmail(msResult.email || null);
        setProjectsWithoutFolders(folderCount);
        setInvoicedProjectsCount(invoicedCount.count);
      } catch (error) {
        console.error('Error fetching SharePoint settings:', error);
      } finally {
        setSharepointLoading(false);
      }
    };

    fetchSharePointSettings();
  }, []);

  // Fetch customer approval settings
  useEffect(() => {
    const fetchApprovalSettings = async () => {
      setApprovalLoading(true);
      try {
        const [userId, candidates] = await Promise.all([
          getApprovalUserId(),
          getApprovalCandidates(),
        ]);
        setApprovalUserIdState(userId);
        setApprovalCandidates(candidates);
      } catch (error) {
        console.error('Error fetching approval settings:', error);
      } finally {
        setApprovalLoading(false);
      }
    };

    fetchApprovalSettings();
  }, []);

  const handleCreateMissingFolders = async () => {
    setIsCreatingFolders(true);
    try {
      const result = await createMissingSharePointFolders();

      if (result.success) {
        if (result.created > 0) {
          toast.success(`Created ${result.created} SharePoint folder${result.created !== 1 ? 's' : ''}`);
        } else {
          toast.info('All projects already have SharePoint folders');
        }

        if (result.errors > 0) {
          toast.warning(`${result.errors} folder${result.errors !== 1 ? 's' : ''} failed to create`);
        }

        // Refresh the count
        const newCount = await getProjectsWithoutFoldersCount();
        setProjectsWithoutFolders(newCount);
      } else {
        toast.error(result.error || 'Failed to create folders');
      }
    } catch (error) {
      toast.error('Failed to create folders');
    } finally {
      setIsCreatingFolders(false);
    }
  };

  const handleDisconnectSharePoint = async () => {
    setIsDisconnecting(true);
    try {
      const result = await removeSharePointConfig();
      if (result.success) {
        setSharepointConfig(null);
        toast.success('SharePoint disconnected');
      } else {
        toast.error(result.error || 'Failed to disconnect SharePoint');
      }
    } catch (error) {
      toast.error('Failed to disconnect SharePoint');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleArchiveInvoicedProjects = async () => {
    setIsArchiving(true);
    try {
      const result = await archiveInvoicedProjects();

      if (result.success) {
        if (result.archived > 0) {
          toast.success(`Archived ${result.archived} project${result.archived !== 1 ? 's' : ''} to _archive folder`);
        } else if (result.errors === 0) {
          toast.info('No projects to archive');
        }

        if (result.errors > 0) {
          const errorMsg = result.errorDetails?.length
            ? `${result.errors} failed: ${result.errorDetails[0]}${result.errorDetails.length > 1 ? ` (+${result.errorDetails.length - 1} more)` : ''}`
            : `${result.errors} project${result.errors !== 1 ? 's' : ''} failed to archive`;
          toast.error(errorMsg, { duration: 10000 });
          console.error('[Archive] Error details:', result.errorDetails);
        }

        // Refresh the count
        const newCount = await getInvoicedProjectsWithFoldersCount();
        setInvoicedProjectsCount(newCount.count);
      } else {
        toast.error(result.error || 'Failed to archive projects');
      }
    } catch (error) {
      console.error('[Archive] Unexpected error:', error);
      toast.error('Failed to archive projects');
    } finally {
      setIsArchiving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!tableExists) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Configure application settings</p>
        </div>

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Database Migration Required</AlertTitle>
          <AlertDescription>
            <p className="mb-4">
              The app_settings table does not exist. Please run the following SQL in your Supabase dashboard:
            </p>
            <pre className="bg-muted p-4 rounded-md text-xs overflow-x-auto whitespace-pre-wrap">
{`-- Create app_settings table
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

-- Insert default email setting
INSERT INTO app_settings (key, value)
VALUES ('emails_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Add email_notifications_enabled to projects
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN DEFAULT TRUE;

-- Enable RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Admin policies
CREATE POLICY "Admins can view app_settings" ON app_settings FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Admins can update app_settings" ON app_settings FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Admins can insert app_settings" ON app_settings FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));`}
            </pre>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Configure application settings</p>
      </div>

      {/* Email Settings */}
      <EmailSettingsSection initialEmailsEnabled={emailsEnabled} />

      {/* SharePoint Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderSync className="h-5 w-5" />
            SharePoint Integration
          </CardTitle>
          <CardDescription>
            Configure the SharePoint location for all project files
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {sharepointLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !msConnected ? (
            /* Microsoft not connected */
            <div className="text-center py-6 border-2 border-dashed rounded-lg">
              <FolderSync className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <h3 className="font-medium mb-1">Microsoft Account Required</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Connect a Microsoft account to configure SharePoint file storage
              </p>
              <Button
                onClick={() => {
                  window.location.href = `/api/auth/microsoft?return_url=${encodeURIComponent('/admin/settings')}`;
                }}
              >
                <FolderSync className="h-4 w-4 mr-2" />
                Connect Microsoft
              </Button>
            </div>
          ) : sharepointConfig ? (
            /* SharePoint configured */
            <>
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <span className="text-sm font-medium text-green-600 flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    Connected
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Site</span>
                  <span className="text-sm font-medium">{sharepointConfig.site_name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Library</span>
                  <span className="text-sm font-medium">{sharepointConfig.drive_name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Base Folder</span>
                  <a
                    href={sharepointConfig.base_folder_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
                  >
                    {sharepointConfig.base_folder_path}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowSharepointDialog(true)}
                >
                  Change Location
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDisconnectSharePoint}
                  disabled={isDisconnecting}
                  className="text-red-600 hover:text-red-700"
                >
                  {isDisconnecting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Unlink className="h-4 w-4 mr-2" />
                  )}
                  Disconnect
                </Button>
              </div>

              <div className="rounded-lg bg-muted p-4">
                <div className="flex items-start gap-3">
                  <Settings className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">How it works</p>
                    <p className="text-sm text-muted-foreground">
                      When a new project is created, a SharePoint folder is automatically
                      created (e.g., /Projects/S12345 ClientName) with category folders for
                      Schematics, SOW, Photos & Videos, and Other.
                    </p>
                  </div>
                </div>
              </div>

              {/* Create folders for existing projects */}
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium flex items-center gap-2">
                      <FolderPlus className="h-4 w-4" />
                      Create Folders for Existing Projects
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {projectsWithoutFolders.count > 0 ? (
                        <>{projectsWithoutFolders.count} of {projectsWithoutFolders.total} projects need folders</>
                      ) : (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          All projects have SharePoint folders
                        </span>
                      )}
                    </p>
                  </div>
                  <Button
                    onClick={handleCreateMissingFolders}
                    disabled={isCreatingFolders || projectsWithoutFolders.count === 0}
                    size="sm"
                  >
                    {isCreatingFolders ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <FolderPlus className="h-4 w-4 mr-2" />
                        Create Folders
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Archive invoiced projects */}
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Archive className="h-4 w-4" />
                      Archive Invoiced Projects
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {invoicedProjectsCount > 0 ? (
                        <>{invoicedProjectsCount} invoiced project{invoicedProjectsCount !== 1 ? 's' : ''} ready to archive</>
                      ) : (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          All invoiced projects are archived
                        </span>
                      )}
                    </p>
                  </div>
                  <Button
                    onClick={handleArchiveInvoicedProjects}
                    disabled={isArchiving || invoicedProjectsCount === 0}
                    size="sm"
                    variant="outline"
                  >
                    {isArchiving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Archiving...
                      </>
                    ) : (
                      <>
                        <Archive className="h-4 w-4 mr-2" />
                        Archive Projects
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Moves project folders to _archive/{'{'}year{'}'} based on invoiced date
                </p>
              </div>
            </>
          ) : (
            /* SharePoint not configured */
            <>
              <div className="text-center py-6 border-2 border-dashed rounded-lg">
                <FolderSync className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <h3 className="font-medium mb-1">SharePoint Not Configured</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Configure a SharePoint folder to store project files
                </p>
                <Button onClick={() => setShowSharepointDialog(true)}>
                  <FolderSync className="h-4 w-4 mr-2" />
                  Configure SharePoint
                </Button>
              </div>

              {msEmail && (
                <p className="text-sm text-muted-foreground text-center">
                  Connected as: {msEmail}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Microsoft Token Status */}
      <TokenStatusSection />

      {/* Dashboard Thresholds */}
      <DashboardThresholdsSection initialSettings={dashboardSettings} />

      {/* Customer Approvals */}
      <ApprovalUserSection
        initialApprovalUserId={approvalUserId}
        approvalCandidates={approvalCandidates}
        isLoading={approvalLoading}
      />

      {/* SharePoint Config Dialog */}
      <SharePointConfigDialog
        open={showSharepointDialog}
        onOpenChange={setShowSharepointDialog}
        onConfigured={(config) => setSharepointConfig(config)}
      />
    </div>
  );
}
