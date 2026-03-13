'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Mail, MailX, AlertTriangle, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface EmailSettingsSectionProps {
  initialEmailsEnabled: boolean;
}

export function EmailSettingsSection({ initialEmailsEnabled }: EmailSettingsSectionProps) {
  const [emailsEnabled, setEmailsEnabled] = useState(initialEmailsEnabled);
  const [isPending, startTransition] = useTransition();
  const [isDisablingEmails, setIsDisablingEmails] = useState(false);
  const supabase = createClient();

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

  const handleDisableAllProjectEmails = async () => {
    if (!confirm('Are you sure you want to disable email notifications for all non-invoiced projects? Individual projects can be re-enabled from their project settings.')) {
      return;
    }

    setIsDisablingEmails(true);
    try {
      // Look up the "Invoiced" status ID
      const { data: invoicedStatus, error: statusError } = await supabase
        .from('statuses')
        .select('id')
        .eq('name', 'Invoiced')
        .single();

      if (statusError) {
        toast.error('Failed to find Invoiced status');
        console.error('Error finding Invoiced status:', statusError);
        return;
      }

      // Disable emails for all non-invoiced projects (with a status that isn't Invoiced)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count: count1, error: error1 } = await (supabase.from('projects') as any)
        .update({ email_notifications_enabled: false })
        .neq('current_status_id', invoicedStatus.id)
        .not('current_status_id', 'is', null)
        .select('id', { count: 'exact', head: true });

      // Also disable for projects with null current_status_id
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count: count2, error: error2 } = await (supabase.from('projects') as any)
        .update({ email_notifications_enabled: false })
        .is('current_status_id', null)
        .select('id', { count: 'exact', head: true });

      if (error1 || error2) {
        toast.error('Failed to disable project emails');
        console.error('Error disabling project emails:', error1 || error2);
        return;
      }

      const totalCount = (count1 || 0) + (count2 || 0);
      toast.success(`Disabled emails for ${totalCount} project${totalCount !== 1 ? 's' : ''}`);
    } catch (error) {
      console.error('Error disabling all project emails:', error);
      toast.error('Failed to disable project emails');
    } finally {
      setIsDisablingEmails(false);
    }
  };

  return (
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

        {/* Disable All Project Emails */}
        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium flex items-center gap-2">
                <MailX className="h-4 w-4" />
                Disable All Project Emails
              </p>
              <p className="text-sm text-muted-foreground">
                Turns off email notifications for all non-invoiced projects. Individual projects can be re-enabled from their project settings.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDisableAllProjectEmails}
              disabled={isDisablingEmails}
            >
              {isDisablingEmails ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Disabling...
                </>
              ) : (
                'Disable All'
              )}
            </Button>
          </div>
        </div>

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
  );
}
