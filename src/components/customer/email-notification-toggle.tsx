'use client';

import { useState, useTransition } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Bell, BellOff, Loader2 } from 'lucide-react';

interface EmailNotificationToggleProps {
  email: string;
  initialEnabled: boolean;
}

export function EmailNotificationToggle({ email, initialEnabled }: EmailNotificationToggleProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();

  const handleToggle = (checked: boolean) => {
    startTransition(async () => {
      try {
        const response = await fetch('/api/customer/email-preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notifications_enabled: checked }),
        });

        const data = await response.json();

        if (!response.ok) {
          toast.error(data.error || 'Failed to update preference');
          return;
        }

        setEnabled(checked);
        toast.success(
          checked
            ? 'Email notifications enabled'
            : 'Email notifications disabled'
        );
      } catch (error) {
        console.error('Error updating email preference:', error);
        toast.error('Failed to update preference');
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {enabled ? (
            <Bell className="h-5 w-5 text-[#023A2D]" />
          ) : (
            <BellOff className="h-5 w-5 text-muted-foreground" />
          )}
          Email Notifications
        </CardTitle>
        <CardDescription>
          Control email notifications for {email}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="email-notifications" className="text-base">
              Receive status updates
            </Label>
            <p className="text-sm text-muted-foreground">
              Get notified when your project status changes
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            <Switch
              id="email-notifications"
              checked={enabled}
              onCheckedChange={handleToggle}
              disabled={isPending}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
