'use client';

import { useEffect, useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Mail, AlertTriangle, Settings, FolderSync, ExternalLink, Unlink } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SharePointConfigDialog } from '@/components/admin/sharepoint-config-dialog';
import {
  getSharePointConfig,
  removeSharePointConfig,
  checkAdminMicrosoftConnection,
} from './sharepoint-actions';
import type { SharePointGlobalConfig } from '@/types';

interface AppSetting {
  key: string;
  value: boolean;
  updated_at: string | null;
}

export default function AdminSettingsPage() {
  const [emailsEnabled, setEmailsEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [tableExists, setTableExists] = useState(true);
  const [isPending, startTransition] = useTransition();
  const supabase = createClient();

  // SharePoint state
  const [sharepointConfig, setSharepointConfig] = useState<SharePointGlobalConfig | null>(null);
  const [sharepointLoading, setSharepointLoading] = useState(true);
  const [msConnected, setMsConnected] = useState(false);
  const [msEmail, setMsEmail] = useState<string | null>(null);
  const [showSharepointDialog, setShowSharepointDialog] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from as any)('app_settings')
        .select('*')
        .eq('key', 'emails_enabled')
        .single();

      if (error) {
        if (error.code === 'PGRST205' || error.code === '42P01') {
          // Table doesn't exist
          setTableExists(false);
        } else if (error.code !== 'PGRST116') {
          // PGRST116 is "no rows found" - that's ok for first setup
          console.error('Error fetching settings:', error);
        }
      } else if (data) {
        setEmailsEnabled(data.value === true || data.value === 'true');
      }

      setIsLoading(false);
    };

    fetchSettings();
  }, [supabase]);

  // Fetch SharePoint config and Microsoft connection status
  useEffect(() => {
    const fetchSharePointSettings = async () => {
      setSharepointLoading(true);
      try {
        const [configResult, msResult] = await Promise.all([
          getSharePointConfig(),
          checkAdminMicrosoftConnection(),
        ]);

        if (configResult.success) {
          setSharepointConfig(configResult.config || null);
        }
        setMsConnected(msResult.connected);
        setMsEmail(msResult.email || null);
      } catch (error) {
        console.error('Error fetching SharePoint settings:', error);
      } finally {
        setSharepointLoading(false);
      }
    };

    fetchSharePointSettings();
  }, []);

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
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Microsoft Account Required</AlertTitle>
              <AlertDescription>
                <p className="mb-3">
                  Connect your Microsoft account in the Calendar settings to configure SharePoint.
                </p>
                <Button variant="outline" size="sm" asChild>
                  <a href="/calendar">
                    Go to Calendar Settings
                  </a>
                </Button>
              </AlertDescription>
            </Alert>
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
                      When files are uploaded to a project, a subfolder is automatically
                      created (e.g., /Projects/ClientName) with category folders for
                      Schematics, SOW, Photos, Videos, and Other.
                    </p>
                  </div>
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

      {/* SharePoint Config Dialog */}
      <SharePointConfigDialog
        open={showSharepointDialog}
        onOpenChange={setShowSharepointDialog}
        onConfigured={(config) => setSharepointConfig(config)}
      />
    </div>
  );
}
