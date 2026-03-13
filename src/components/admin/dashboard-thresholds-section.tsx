'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, BarChart3, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export interface DashboardSettings {
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

export const DEFAULT_DASHBOARD_SETTINGS: DashboardSettings = {
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

interface DashboardThresholdsSectionProps {
  initialSettings: DashboardSettings;
}

export function DashboardThresholdsSection({ initialSettings }: DashboardThresholdsSectionProps) {
  const [dashboardSettings, setDashboardSettings] = useState<DashboardSettings>(initialSettings);
  const [isSavingDashboard, setIsSavingDashboard] = useState(false);
  const supabase = createClient();

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

  return (
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
  );
}
