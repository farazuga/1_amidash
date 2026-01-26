'use client';

import { useEffect, useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, Mail, AlertTriangle, Settings, FolderSync, ExternalLink, Unlink, BarChart3, HelpCircle, FolderPlus, CheckCircle2, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { SharePointConfigDialog } from '@/components/admin/sharepoint-config-dialog';
import {
  getSharePointConfig,
  removeSharePointConfig,
  checkAdminMicrosoftConnection,
  createMissingSharePointFolders,
  getProjectsWithoutFoldersCount,
} from './sharepoint-actions';
import type { SharePointGlobalConfig } from '@/types';

interface AppSetting {
  key: string;
  value: boolean | number;
  updated_at: string | null;
}

interface DashboardSettings {
  wipAgingDays: number;
  salesHealthThreshold: number;
  operationsHealthThreshold: number;
  ontimeGoodThreshold: number;
  ontimeWarningThreshold: number;
  concentrationHighThreshold: number;
  concentrationMediumThreshold: number;
  backlogWarningMonths: number;
  // New settings for dashboard improvements
  notScheduledWarningDays: number;
  lowInvoiceWarningPercent: number;
  signageMinProjectValue: number;
  signageUpcomingDays: number;
}

const DEFAULT_DASHBOARD_SETTINGS: DashboardSettings = {
  wipAgingDays: 14,
  salesHealthThreshold: 80,
  operationsHealthThreshold: 60,
  ontimeGoodThreshold: 80,
  ontimeWarningThreshold: 60,
  concentrationHighThreshold: 70,
  concentrationMediumThreshold: 50,
  backlogWarningMonths: 6,
  // New settings for dashboard improvements
  notScheduledWarningDays: 14,
  lowInvoiceWarningPercent: 80,
  signageMinProjectValue: 10000,
  signageUpcomingDays: 30,
};

const SETTING_TOOLTIPS: Record<keyof DashboardSettings, { label: string; tooltip: string }> = {
  wipAgingDays: {
    label: 'WIP Aging Threshold (days)',
    tooltip: 'Projects stuck in a status longer than this are flagged. Recommended: 14 days. Lower values catch issues faster but may create noise.',
  },
  salesHealthThreshold: {
    label: 'Sales Health Threshold (%)',
    tooltip: 'POs received vs goal percentage. Below this triggers "Sales Attention Needed". Recommended: 80%. Industry standard is 75-85%.',
  },
  operationsHealthThreshold: {
    label: 'Operations Health Threshold (%)',
    tooltip: 'Invoiced vs POs received ratio. Below this indicates operations bottleneck. Recommended: 60%. Adjust based on your typical project cycle time.',
  },
  ontimeGoodThreshold: {
    label: 'On-Time Good Threshold (%)',
    tooltip: 'On-time completion percentage at or above this shows green. Recommended: 80%. World-class is 90%+.',
  },
  ontimeWarningThreshold: {
    label: 'On-Time Warning Threshold (%)',
    tooltip: 'On-time completion below good but above this shows amber. Below this shows red. Recommended: 60%.',
  },
  concentrationHighThreshold: {
    label: 'Concentration High Risk (%)',
    tooltip: 'Top 3 clients at or above this % of revenue = high risk. Recommended: 70%. High concentration increases business risk.',
  },
  concentrationMediumThreshold: {
    label: 'Concentration Medium Risk (%)',
    tooltip: 'Top 3 clients at or above this % = medium risk. Below this is healthy. Recommended: 50%.',
  },
  backlogWarningMonths: {
    label: 'Backlog Warning (months)',
    tooltip: 'Backlog depth above this shows warning. Recommended: 6 months. Too much backlog may indicate capacity issues.',
  },
  // New settings for dashboard improvements
  notScheduledWarningDays: {
    label: 'Not Scheduled Warning (days)',
    tooltip: 'Projects waiting longer than this without being scheduled trigger an alert. Recommended: 14 days.',
  },
  lowInvoiceWarningPercent: {
    label: 'Low Invoice Warning (%)',
    tooltip: 'If projected invoicing for the month is below this percentage of goal, show a warning. Recommended: 80%.',
  },
  signageMinProjectValue: {
    label: 'Signage Min Project Value ($)',
    tooltip: 'Only show projects with value above this threshold on digital signage. Helps prioritize Solutions over Box Sales.',
  },
  signageUpcomingDays: {
    label: 'Signage Upcoming Days',
    tooltip: 'Number of days to look ahead for "Upcoming Projects" on signage. Recommended: 30 days.',
  },
};

export default function AdminSettingsPage() {
  const [emailsEnabled, setEmailsEnabled] = useState(true);
  const [dashboardSettings, setDashboardSettings] = useState<DashboardSettings>(DEFAULT_DASHBOARD_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [tableExists, setTableExists] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [isSavingDashboard, setIsSavingDashboard] = useState(false);
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
        const [configResult, msResult, folderCount] = await Promise.all([
          getSharePointConfig(),
          checkAdminMicrosoftConnection(),
          getProjectsWithoutFoldersCount(),
        ]);

        if (configResult.success) {
          setSharepointConfig(configResult.config || null);
        }
        setMsConnected(msResult.connected);
        setMsEmail(msResult.email || null);
        setProjectsWithoutFolders(folderCount);
      } catch (error) {
        console.error('Error fetching SharePoint settings:', error);
      } finally {
        setSharepointLoading(false);
      }
    };

    fetchSharePointSettings();
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

  const handleToggleEmails = async (enabled: boolean) => {
    startTransition(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from as any)('app_settings')
        .upsert(
          { key: 'emails_enabled', value: enabled, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        );

      if (error) {
        toast.error('Failed to update email settings');
        console.error('Error updating settings:', error);
        return;
      }

      setEmailsEnabled(enabled);
      toast.success(enabled ? 'Client emails enabled' : 'Client emails disabled');
    });
  };

  const handleDashboardSettingChange = (key: keyof DashboardSettings, value: string) => {
    const numValue = parseInt(value) || 0;
    setDashboardSettings(prev => ({ ...prev, [key]: numValue }));
  };

  const handleSaveDashboardSettings = async () => {
    setIsSavingDashboard(true);

    const settingKeyMap: Record<keyof DashboardSettings, string> = {
      wipAgingDays: 'dashboard_wip_aging_days',
      salesHealthThreshold: 'dashboard_sales_health_threshold',
      operationsHealthThreshold: 'dashboard_operations_health_threshold',
      ontimeGoodThreshold: 'dashboard_ontime_good_threshold',
      ontimeWarningThreshold: 'dashboard_ontime_warning_threshold',
      concentrationHighThreshold: 'dashboard_concentration_high_threshold',
      concentrationMediumThreshold: 'dashboard_concentration_medium_threshold',
      backlogWarningMonths: 'dashboard_backlog_warning_months',
      // New settings
      notScheduledWarningDays: 'dashboard_not_scheduled_warning_days',
      lowInvoiceWarningPercent: 'dashboard_low_invoice_warning_percent',
      signageMinProjectValue: 'dashboard_signage_min_project_value',
      signageUpcomingDays: 'dashboard_signage_upcoming_days',
    };

    try {
      const updates = Object.entries(dashboardSettings).map(([key, value]) => ({
        key: settingKeyMap[key as keyof DashboardSettings],
        value: value,
        updated_at: new Date().toISOString(),
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from as any)('app_settings')
        .upsert(updates, { onConflict: 'key' });

      if (error) {
        throw error;
      }

      toast.success('Dashboard settings saved');
    } catch (error) {
      console.error('Error saving dashboard settings:', error);
      toast.error('Failed to save dashboard settings');
    } finally {
      setIsSavingDashboard(false);
    }
  };

  const handleResetDashboardSettings = () => {
    setDashboardSettings(DEFAULT_DASHBOARD_SETTINGS);
    toast.info('Settings reset to defaults. Click Save to apply.');
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

      {/* Email Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Notifications
          </CardTitle>
          <CardDescription>
            Control email notifications sent to clients
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Global Email Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label htmlFor="emails-enabled" className="text-base font-medium">
                  Enable Client Emails
                </Label>
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
              <p className="text-sm text-muted-foreground">
                When disabled, no emails will be sent to clients for status changes or welcome messages.
                This is a global kill switch for all client email notifications.
              </p>
            </div>
            <Switch
              id="emails-enabled"
              checked={emailsEnabled}
              onCheckedChange={handleToggleEmails}
              disabled={isPending}
            />
          </div>

          {/* Warning when disabled */}
          {!emailsEnabled && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Emails Disabled</AlertTitle>
              <AlertDescription>
                Client email notifications are currently disabled. Clients will not receive
                status change notifications or welcome emails until this is re-enabled.
              </AlertDescription>
            </Alert>
          )}

          {/* Info about per-project settings */}
          <div className="rounded-lg bg-muted p-4">
            <div className="flex items-start gap-3">
              <Settings className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Per-Project Settings</p>
                <p className="text-sm text-muted-foreground">
                  You can also disable email notifications for individual projects.
                  Edit a project and toggle the &quot;Email Notifications&quot; setting.
                  Both this global setting AND the project setting must be enabled for
                  emails to be sent.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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

      {/* Microsoft Token Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Microsoft Token Status
          </CardTitle>
          <CardDescription>
            Debug Microsoft authentication tokens for all users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Settings className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium">Token Health Check</p>
                <p className="text-sm text-muted-foreground mb-3">
                  View access token expiration, refresh token health, and identify users who may need to reconnect their Microsoft account.
                </p>
                <a
                  href="/api/admin/token-status"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  View Token Status
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
          <div className="mt-4 text-xs text-muted-foreground">
            <p><strong>Access tokens:</strong> Last ~1 hour, auto-refresh using refresh token</p>
            <p><strong>Refresh tokens:</strong> Last 90 days of inactivity, each use extends the window</p>
          </div>
        </CardContent>
      </Card>

      {/* Dashboard Threshold Settings */}
      <TooltipProvider>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Dashboard Thresholds
            </CardTitle>
            <CardDescription>
              Configure the thresholds used for health diagnostics and alerts on the dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Health Diagnostic Thresholds */}
            <div>
              <h3 className="text-sm font-semibold mb-4">Health Diagnostic</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {(['salesHealthThreshold', 'operationsHealthThreshold'] as const).map(key => (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={key} className="text-sm">
                        {SETTING_TOOLTIPS[key].label}
                      </Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>{SETTING_TOOLTIPS[key].tooltip}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Input
                      id={key}
                      type="number"
                      min={0}
                      max={100}
                      value={dashboardSettings[key]}
                      onChange={(e) => handleDashboardSettingChange(key, e.target.value)}
                      className="w-full"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* WIP Aging Threshold */}
            <div>
              <h3 className="text-sm font-semibold mb-4">WIP Aging Alert</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="wipAgingDays" className="text-sm">
                      {SETTING_TOOLTIPS.wipAgingDays.label}
                    </Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>{SETTING_TOOLTIPS.wipAgingDays.tooltip}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="wipAgingDays"
                    type="number"
                    min={1}
                    max={90}
                    value={dashboardSettings.wipAgingDays}
                    onChange={(e) => handleDashboardSettingChange('wipAgingDays', e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="backlogWarningMonths" className="text-sm">
                      {SETTING_TOOLTIPS.backlogWarningMonths.label}
                    </Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>{SETTING_TOOLTIPS.backlogWarningMonths.tooltip}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="backlogWarningMonths"
                    type="number"
                    min={1}
                    max={24}
                    value={dashboardSettings.backlogWarningMonths}
                    onChange={(e) => handleDashboardSettingChange('backlogWarningMonths', e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            {/* On-Time Completion Thresholds */}
            <div>
              <h3 className="text-sm font-semibold mb-4">On-Time Completion</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {(['ontimeGoodThreshold', 'ontimeWarningThreshold'] as const).map(key => (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={key} className="text-sm">
                        {SETTING_TOOLTIPS[key].label}
                      </Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>{SETTING_TOOLTIPS[key].tooltip}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Input
                      id={key}
                      type="number"
                      min={0}
                      max={100}
                      value={dashboardSettings[key]}
                      onChange={(e) => handleDashboardSettingChange(key, e.target.value)}
                      className="w-full"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Customer Concentration Thresholds */}
            <div>
              <h3 className="text-sm font-semibold mb-4">Customer Concentration Risk</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {(['concentrationHighThreshold', 'concentrationMediumThreshold'] as const).map(key => (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={key} className="text-sm">
                        {SETTING_TOOLTIPS[key].label}
                      </Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>{SETTING_TOOLTIPS[key].tooltip}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Input
                      id={key}
                      type="number"
                      min={0}
                      max={100}
                      value={dashboardSettings[key]}
                      onChange={(e) => handleDashboardSettingChange(key, e.target.value)}
                      className="w-full"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Dashboard Alert Thresholds */}
            <div>
              <h3 className="text-sm font-semibold mb-4">Dashboard Alerts</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {(['notScheduledWarningDays', 'lowInvoiceWarningPercent'] as const).map(key => (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={key} className="text-sm">
                        {SETTING_TOOLTIPS[key].label}
                      </Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>{SETTING_TOOLTIPS[key].tooltip}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Input
                      id={key}
                      type="number"
                      min={key === 'notScheduledWarningDays' ? 1 : 0}
                      max={key === 'notScheduledWarningDays' ? 90 : 100}
                      value={dashboardSettings[key]}
                      onChange={(e) => handleDashboardSettingChange(key, e.target.value)}
                      className="w-full"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Digital Signage Settings */}
            <div>
              <h3 className="text-sm font-semibold mb-4">Digital Signage</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {(['signageMinProjectValue', 'signageUpcomingDays'] as const).map(key => (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={key} className="text-sm">
                        {SETTING_TOOLTIPS[key].label}
                      </Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>{SETTING_TOOLTIPS[key].tooltip}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Input
                      id={key}
                      type="number"
                      min={key === 'signageMinProjectValue' ? 0 : 1}
                      max={key === 'signageMinProjectValue' ? 1000000 : 365}
                      value={dashboardSettings[key]}
                      onChange={(e) => handleDashboardSettingChange(key, e.target.value)}
                      className="w-full"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                variant="outline"
                onClick={handleResetDashboardSettings}
                disabled={isSavingDashboard}
              >
                Reset to Defaults
              </Button>
              <Button
                onClick={handleSaveDashboardSettings}
                disabled={isSavingDashboard}
              >
                {isSavingDashboard && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </TooltipProvider>

      {/* SharePoint Config Dialog */}
      <SharePointConfigDialog
        open={showSharepointDialog}
        onOpenChange={setShowSharepointDialog}
        onConfigured={(config) => setSharepointConfig(config)}
      />
    </div>
  );
}
