'use client';

import { useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Phone formatting helper - strips +1 country code and formats as xxx-xxx-xxxx
function formatPhoneNumber(phone: string): string {
  // Remove +1 or 1 prefix if present
  let cleaned = phone.replace(/^\+1\s*/, '').replace(/^1(?=\d{10})/, '');
  const digits = cleaned.replace(/\D/g, '');
  if (digits.length >= 10) {
    // Take last 10 digits (in case there's still a leading 1)
    const last10 = digits.slice(-10);
    const formatted = `${last10.slice(0, 3)}-${last10.slice(3, 6)}-${last10.slice(6, 10)}`;
    return formatted;
  }
  return phone;
}

interface ContactSelectorProps {
  pocName: string;
  pocEmail: string;
  pocPhone: string;
  onPocNameChange: (value: string) => void;
  onPocEmailChange: (value: string) => void;
  onPocPhoneChange: (value: string) => void;
  defaultPocName?: string;
  defaultPocEmail?: string;
  defaultPocPhone?: string;
}

export function ContactSelector({
  pocName,
  pocEmail,
  pocPhone,
  onPocNameChange,
  onPocEmailChange,
  onPocPhoneChange,
  defaultPocName,
  defaultPocEmail,
  defaultPocPhone,
}: ContactSelectorProps) {
  // Initialize with defaults
  useEffect(() => {
    if (defaultPocName && !pocName) onPocNameChange(defaultPocName);
    if (defaultPocEmail && !pocEmail) onPocEmailChange(defaultPocEmail);
    if (defaultPocPhone && !pocPhone) onPocPhoneChange(defaultPocPhone);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePhoneBlur = () => {
    // Auto-format on blur if we have enough digits
    const digits = pocPhone.replace(/\D/g, '');
    if (digits.length >= 10) {
      onPocPhoneChange(formatPhoneNumber(pocPhone));
    }
  };

  return (
    <div className="border-t pt-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium">Point of Contact *</h3>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="poc_name">Name *</Label>
          <Input
            id="poc_name"
            name="poc_name"
            value={pocName}
            onChange={(e) => onPocNameChange(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="poc_email">Email *</Label>
          <Input
            id="poc_email"
            name="poc_email"
            type="email"
            value={pocEmail}
            onChange={(e) => onPocEmailChange(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="poc_phone">Phone *</Label>
          <Input
            id="poc_phone"
            name="poc_phone"
            type="tel"
            placeholder="xxx-xxx-xxxx"
            value={pocPhone}
            onChange={(e) => onPocPhoneChange(e.target.value)}
            onBlur={handlePhoneBlur}
            required
          />
          <p className="text-xs text-muted-foreground">
            Format: xxx-xxx-xxxx (extensions allowed, e.g., xxx-xxx-xxxx ext 123)
          </p>
        </div>
      </div>
    </div>
  );
}
