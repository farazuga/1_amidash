'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { handleConfirmationResponse } from '@/app/(dashboard)/calendar/confirmation-actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConfirmationFormProps {
  token: string;
  projectName: string;
}

export function ConfirmationForm({ token, projectName }: ConfirmationFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [action, setAction] = useState<'confirm' | 'decline' | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (selectedAction: 'confirm' | 'decline') => {
    if (selectedAction === 'decline' && !declineReason.trim()) {
      setError('Please provide a reason for declining.');
      return;
    }

    setIsSubmitting(true);
    setAction(selectedAction);
    setError(null);

    try {
      const result = await handleConfirmationResponse({
        token,
        action: selectedAction,
        declineReason: selectedAction === 'decline' ? declineReason : undefined,
      });

      if (!result.success) {
        setError(result.error || 'Failed to submit response. Please try again.');
        return;
      }

      setSuccess(true);
      // Refresh the page to show the "already responded" state
      router.refresh();
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className={action === 'confirm' ? 'text-green-600' : 'text-orange-600'}>
            <div className="flex items-center justify-center gap-2">
              {action === 'confirm' ? (
                <CheckCircle className="h-6 w-6" />
              ) : (
                <XCircle className="h-6 w-6" />
              )}
              {action === 'confirm' ? 'Schedule Confirmed!' : 'Response Submitted'}
            </div>
          </CardTitle>
          <CardDescription>
            {action === 'confirm'
              ? 'Thank you for confirming the schedule. The project manager has been notified.'
              : 'Your response has been submitted. The project manager will be in touch.'}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Response</CardTitle>
        <CardDescription>
          Please confirm or decline the scheduled dates for {projectName}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Button
            variant="outline"
            size="lg"
            className={cn(
              'h-auto py-4 flex flex-col items-center gap-2',
              action === 'confirm' && 'border-green-500 bg-green-50'
            )}
            onClick={() => setAction('confirm')}
            disabled={isSubmitting}
          >
            <CheckCircle className="h-8 w-8 text-green-600" />
            <span className="font-semibold text-green-700">Confirm</span>
            <span className="text-xs text-gray-500">Accept these dates</span>
          </Button>

          <Button
            variant="outline"
            size="lg"
            className={cn(
              'h-auto py-4 flex flex-col items-center gap-2',
              action === 'decline' && 'border-red-500 bg-red-50'
            )}
            onClick={() => setAction('decline')}
            disabled={isSubmitting}
          >
            <XCircle className="h-8 w-8 text-red-600" />
            <span className="font-semibold text-red-700">Decline</span>
            <span className="text-xs text-gray-500">Request changes</span>
          </Button>
        </div>

        {action === 'decline' && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Reason for declining <span className="text-red-500">*</span>
            </label>
            <Textarea
              placeholder="Please let us know why these dates don't work and any preferred alternatives..."
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              rows={4}
              className="resize-none"
              disabled={isSubmitting}
            />
          </div>
        )}

        {action && (
          <Button
            className={cn(
              'w-full',
              action === 'confirm'
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-red-600 hover:bg-red-700'
            )}
            size="lg"
            onClick={() => handleSubmit(action)}
            disabled={isSubmitting || (action === 'decline' && !declineReason.trim())}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                {action === 'confirm' ? 'Confirm Schedule' : 'Submit Decline'}
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
