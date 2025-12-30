'use client';

import { useEffect, useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, Mail, AlertTriangle, Settings, BarChart3, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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
};

export default function AdminSettingsPage() {
  const [emailsEnabled, setEmailsEnabled] = useState(true);
  const [dashboardSettings, setDashboardSettings] = useState<DashboardSettings>(DEFAULT_DASHBOARD_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [tableExists, setTableExists] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [isSavingDashboard, setIsSavingDashboard] = useState(false);
  const supabase = createClient();

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
    </div>
  );
}
