'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Mail, Send } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  useEmailTemplate,
  useUpsertEmailTemplate,
} from '@/hooks/queries/use-portal-templates';
import { sendTestEmail } from '@/app/(dashboard)/admin/portal-builder/email-actions';
import { EmailPreview } from './email-preview';

const DEFAULTS = {
  primaryColor: '#023A2D',
  buttonColor: '#023A2D',
  buttonTextColor: '#ffffff',
  logoUrl: 'https://dash.amitrace.com/new_logo.png',
  footerText: '',
};

interface EmailBrandingSectionProps {
  portalTemplateId: string;
}

export function EmailBrandingSection({ portalTemplateId }: EmailBrandingSectionProps) {
  const [open, setOpen] = useState(false);
  const [primaryColor, setPrimaryColor] = useState(DEFAULTS.primaryColor);
  const [buttonColor, setButtonColor] = useState(DEFAULTS.buttonColor);
  const [buttonTextColor, setButtonTextColor] = useState(DEFAULTS.buttonTextColor);
  const [logoUrl, setLogoUrl] = useState(DEFAULTS.logoUrl);
  const [footerText, setFooterText] = useState(DEFAULTS.footerText);
  const [testingSending, setTestingSending] = useState(false);

  const { data: emailTemplate, isLoading } = useEmailTemplate(portalTemplateId);
  const upsertEmail = useUpsertEmailTemplate();

  // Populate form when data loads
  useEffect(() => {
    if (emailTemplate) {
      setPrimaryColor(emailTemplate.primary_color || DEFAULTS.primaryColor);
      setButtonColor(emailTemplate.button_color || DEFAULTS.buttonColor);
      setButtonTextColor(emailTemplate.button_text_color || DEFAULTS.buttonTextColor);
      setLogoUrl(emailTemplate.logo_url || DEFAULTS.logoUrl);
      setFooterText(emailTemplate.footer_text || DEFAULTS.footerText);
    } else if (!isLoading) {
      setPrimaryColor(DEFAULTS.primaryColor);
      setButtonColor(DEFAULTS.buttonColor);
      setButtonTextColor(DEFAULTS.buttonTextColor);
      setLogoUrl(DEFAULTS.logoUrl);
      setFooterText(DEFAULTS.footerText);
    }
  }, [emailTemplate, isLoading]);

  async function handleSave() {
    try {
      await upsertEmail.mutateAsync({
        portalTemplateId,
        updates: {
          primary_color: primaryColor,
          button_color: buttonColor,
          button_text_color: buttonTextColor,
          logo_url: logoUrl,
          footer_text: footerText,
        },
      });
      toast.success('Email branding saved');
    } catch (err) {
      console.error('Save email branding error:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to save email branding: ${message}`);
    }
  }

  async function handleSendTest() {
    setTestingSending(true);
    try {
      const result = await sendTestEmail(portalTemplateId);
      if (result.success) {
        toast.success('Test email sent to your address');
      } else {
        toast.error(`Failed to send test email: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Send test email error:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to send test email: ${message}`);
    } finally {
      setTestingSending(false);
    }
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-[#023A2D]" />
                <CardTitle className="text-base">Email Branding</CardTitle>
              </div>
              <ChevronDown
                className={cn('h-4 w-4 transition-transform', !open && '-rotate-90')}
              />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {isLoading ? (
              <div className="animate-pulse space-y-3">
                <div className="h-8 bg-muted rounded w-48" />
                <div className="h-8 bg-muted rounded w-48" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left column: form fields */}
                <div className="space-y-4">
                  {/* Primary Color */}
                  <div className="space-y-1">
                    <Label className="text-xs">Primary Color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="h-8 w-8 cursor-pointer rounded border"
                      />
                      <Input
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        placeholder="#023A2D"
                        className="w-28 font-mono text-sm"
                      />
                    </div>
                  </div>

                  {/* Button Color */}
                  <div className="space-y-1">
                    <Label className="text-xs">Button Color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={buttonColor}
                        onChange={(e) => setButtonColor(e.target.value)}
                        className="h-8 w-8 cursor-pointer rounded border"
                      />
                      <Input
                        value={buttonColor}
                        onChange={(e) => setButtonColor(e.target.value)}
                        placeholder="#023A2D"
                        className="w-28 font-mono text-sm"
                      />
                    </div>
                  </div>

                  {/* Button Text Color */}
                  <div className="space-y-1">
                    <Label className="text-xs">Button Text Color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={buttonTextColor}
                        onChange={(e) => setButtonTextColor(e.target.value)}
                        className="h-8 w-8 cursor-pointer rounded border"
                      />
                      <Input
                        value={buttonTextColor}
                        onChange={(e) => setButtonTextColor(e.target.value)}
                        placeholder="#ffffff"
                        className="w-28 font-mono text-sm"
                      />
                    </div>
                  </div>

                  {/* Logo URL */}
                  <div className="space-y-1">
                    <Label className="text-xs">Logo URL</Label>
                    <Input
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      placeholder="https://example.com/logo.png"
                      className="text-sm"
                    />
                  </div>

                  {/* Footer Text */}
                  <div className="space-y-1">
                    <Label className="text-xs">Footer Text</Label>
                    <Textarea
                      value={footerText}
                      onChange={(e) => setFooterText(e.target.value)}
                      placeholder="e.g., AmiTrace LLC - 123 Main St..."
                      rows={3}
                      className="text-sm"
                    />
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={upsertEmail.isPending}
                    >
                      {upsertEmail.isPending ? 'Saving...' : 'Save Email Branding'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSendTest}
                      disabled={testingSending}
                    >
                      <Send className="h-3.5 w-3.5 mr-1" />
                      {testingSending ? 'Sending...' : 'Send Test Email'}
                    </Button>
                  </div>
                </div>

                {/* Right column: live preview */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Preview</Label>
                  <EmailPreview
                    styleOverrides={{
                      primaryColor,
                      logoUrl,
                      footerText,
                      buttonColor,
                      buttonTextColor,
                    }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
