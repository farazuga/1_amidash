'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Loader2, User } from 'lucide-react';
import { useActiveCampaignContacts } from '@/hooks/use-activecampaign';
import type { ACContact } from '@/types/activecampaign';

// Phone formatting helper - strips +1 country code and formats as xxx-xxx-xxxx
function formatPhoneNumber(phone: string): string {
  // Remove +1 or 1 prefix if present
  let cleaned = phone.replace(/^\+1\s*/, '').replace(/^1(?=\d{10})/, '');
  const digits = cleaned.replace(/\D/g, '');
  if (digits.length >= 10) {
    // Take last 10 digits (in case there's still a leading 1)
    const last10 = digits.slice(-10);
    const formatted = `${last10.slice(0, 3)}-${last10.slice(3, 6)}-${last10.slice(6, 10)}`;
    // Check for extension (digits beyond the 10)
    if (digits.length > 10 && digits.slice(0, -10)) {
      return formatted;
    }
    return formatted;
  }
  return phone;
}

interface ContactSelectorProps {
  accountId: string | null;
  accountName?: string;
  pocName: string;
  pocEmail: string;
  pocPhone: string;
  onPocNameChange: (value: string) => void;
  onPocEmailChange: (value: string) => void;
  onPocPhoneChange: (value: string) => void;
  onContactSelect: (contact: ACContact | null) => void;
  defaultPocName?: string;
  defaultPocEmail?: string;
  defaultPocPhone?: string;
}

export function ContactSelector({
  accountId,
  accountName,
  pocName,
  pocEmail,
  pocPhone,
  onPocNameChange,
  onPocEmailChange,
  onPocPhoneChange,
  onContactSelect,
  defaultPocName,
  defaultPocEmail,
  defaultPocPhone,
}: ContactSelectorProps) {
  const { contacts, isLoading, error, isFromGlobalSearch } = useActiveCampaignContacts(accountId, accountName);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasManualEdit, setHasManualEdit] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Initialize with defaults if no account selected
  useEffect(() => {
    if (!initialized && !accountId) {
      if (defaultPocName && !pocName) onPocNameChange(defaultPocName);
      if (defaultPocEmail && !pocEmail) onPocEmailChange(defaultPocEmail);
      if (defaultPocPhone && !pocPhone) onPocPhoneChange(defaultPocPhone);
      setInitialized(true);
    }
  }, [initialized, accountId, defaultPocName, defaultPocEmail, defaultPocPhone, pocName, pocEmail, pocPhone, onPocNameChange, onPocEmailChange, onPocPhoneChange]);

  // Auto-fill first contact when contacts load
  useEffect(() => {
    if (contacts.length > 0 && !hasManualEdit && accountId) {
      fillFromContact(contacts[0], 0);
    }
  }, [contacts, accountId]);

  const fillFromContact = (contact: ACContact, index: number) => {
    const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
    onPocNameChange(fullName || contact.email);
    onPocEmailChange(contact.email || '');
    // Format phone if available
    if (contact.phone) {
      onPocPhoneChange(formatPhoneNumber(contact.phone));
    } else {
      onPocPhoneChange('');
    }
    onContactSelect(contact);
    setCurrentIndex(index);
    setHasManualEdit(false);
  };

  const handlePrev = () => {
    if (contacts.length === 0) return;
    const newIndex = currentIndex === 0 ? contacts.length - 1 : currentIndex - 1;
    fillFromContact(contacts[newIndex], newIndex);
  };

  const handleNext = () => {
    if (contacts.length === 0) return;
    const newIndex = currentIndex === contacts.length - 1 ? 0 : currentIndex + 1;
    fillFromContact(contacts[newIndex], newIndex);
  };

  const handleManualChange = (field: 'name' | 'email' | 'phone', value: string) => {
    setHasManualEdit(true);
    onContactSelect(null); // Clear AC contact association on manual edit
    if (field === 'name') onPocNameChange(value);
    if (field === 'email') onPocEmailChange(value);
    if (field === 'phone') onPocPhoneChange(value);
  };

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

        {/* Contact Navigation */}
        {accountId && contacts.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                `Contact ${currentIndex + 1} of ${contacts.length}`
              )}
            </span>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={handlePrev}
                disabled={isLoading || contacts.length <= 1}
                title="Previous contact"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={handleNext}
                disabled={isLoading || contacts.length <= 1}
                title="Next contact"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {accountId && isLoading && (
          <span className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading contacts...
          </span>
        )}

        {accountId && contacts.length === 0 && !isLoading && (
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <User className="h-4 w-4" />
            No contacts found
          </span>
        )}

        {accountId && contacts.length === 1 && !isLoading && (
          <span className="text-sm text-muted-foreground">
            1 contact {isFromGlobalSearch ? '(global search)' : 'from AC'}
          </span>
        )}

        {accountId && contacts.length > 1 && !isLoading && isFromGlobalSearch && (
          <span className="text-sm text-amber-600">
            Contacts from global search
          </span>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-500 mb-2">{error}</p>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="poc_name">Name *</Label>
          <Input
            id="poc_name"
            name="poc_name"
            value={pocName}
            onChange={(e) => handleManualChange('name', e.target.value)}
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
            onChange={(e) => handleManualChange('email', e.target.value)}
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
            onChange={(e) => handleManualChange('phone', e.target.value)}
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
