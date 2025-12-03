'use client';

import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface CopyClientLinkProps {
  token: string;
}

export function CopyClientLink({ token }: CopyClientLinkProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const url = `${window.location.origin}/status/${token}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Client portal link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="outline" onClick={handleCopy}>
      {copied ? (
        <Check className="mr-2 h-4 w-4" />
      ) : (
        <Copy className="mr-2 h-4 w-4" />
      )}
      Copy Client Link
    </Button>
  );
}
