'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SecondaryContactSelectorProps {
  email: string;
  onEmailChange: (value: string) => void;
  defaultEmail?: string;
}

export function SecondaryContactSelector({
  email,
  onEmailChange,
  defaultEmail,
}: SecondaryContactSelectorProps) {
  return (
    <div className="mt-4 space-y-2">
      <Label htmlFor="secondary_poc_email">Secondary Contact Email</Label>
      <Input
        id="secondary_poc_email"
        name="secondary_poc_email"
        type="email"
        placeholder="secondary@company.com"
        value={email}
        onChange={(e) => onEmailChange(e.target.value)}
        defaultValue={defaultEmail}
      />
      <p className="text-xs text-muted-foreground">
        Optional. If this email matches a customer account, they will also have access to view this project.
      </p>
    </div>
  );
}
