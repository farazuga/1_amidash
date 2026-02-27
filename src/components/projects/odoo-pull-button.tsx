'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, CloudDownload } from 'lucide-react';
import { toast } from 'sonner';
import type { OdooPullResult } from '@/types/odoo';

interface OdooPullButtonProps {
  salesOrderNumber: string;
  onPullSuccess: (data: OdooPullResult) => void;
  onSummaryGenerated: (summary: string) => void;
  disabled?: boolean;
}

const SALES_ORDER_REGEX = /^S1\d{4}$/i;

export function OdooPullButton({
  salesOrderNumber,
  onPullSuccess,
  onSummaryGenerated,
  disabled = false,
}: OdooPullButtonProps) {
  const [isPulling, setIsPulling] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);

  const isValidSalesOrder = SALES_ORDER_REGEX.test(salesOrderNumber);
  const isLoading = isPulling || isSummarizing;

  const handlePull = async () => {
    if (!isValidSalesOrder) return;

    setIsPulling(true);
    try {
      // Step 1: Pull data from Odoo
      const pullResponse = await fetch('/api/odoo/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salesOrderNumber: salesOrderNumber.toUpperCase() }),
      });

      const pullData = await pullResponse.json();

      if (!pullResponse.ok) {
        if (pullResponse.status === 404) {
          toast.error(`Order ${salesOrderNumber} not found in Odoo`);
        } else {
          toast.error(pullData.error || 'Failed to pull from Odoo');
        }
        return;
      }

      if (pullData.error) {
        toast.error(pullData.error);
        return;
      }

      // Notify parent with pulled data
      onPullSuccess(pullData as OdooPullResult);
      toast.success(`Pulled data from Odoo for ${salesOrderNumber}`);
      setIsPulling(false);

      // Step 2: Generate summary from line items (non-blocking)
      if (pullData.lineItems && pullData.lineItems.length > 0) {
        setIsSummarizing(true);
        try {
          const summarizeResponse = await fetch('/api/odoo/summarize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lineItems: pullData.lineItems.map((item: { productName: string; quantity: number; description: string; subtotal: number }) => ({
                productName: item.productName,
                quantity: item.quantity,
                description: item.description,
                subtotal: item.subtotal,
              })),
              clientName: pullData.client?.name || '',
            }),
          });

          const summarizeData = await summarizeResponse.json();

          if (summarizeResponse.ok && summarizeData.summary) {
            onSummaryGenerated(summarizeData.summary);
            toast.success('Project description generated');
          }
        } catch (err) {
          console.error('Summary generation error:', err);
          // Non-critical - don't show error toast
        } finally {
          setIsSummarizing(false);
        }
      }
    } catch (err) {
      console.error('Odoo pull error:', err);
      toast.error('Failed to connect to Odoo');
    } finally {
      setIsPulling(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handlePull}
      disabled={disabled || !isValidSalesOrder || isLoading}
      className="shrink-0"
    >
      {isLoading ? (
        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
      ) : (
        <CloudDownload className="mr-1.5 h-3.5 w-3.5" />
      )}
      {isPulling ? 'Pulling...' : isSummarizing ? 'Summarizing...' : 'Pull from Odoo'}
    </Button>
  );
}
