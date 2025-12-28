'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import type { ACContact } from '@/types/activecampaign';

interface SecondaryContactSelectorProps {
  contacts: ACContact[];
  isLoading: boolean;
  email: string;
  onEmailChange: (value: string) => void;
  onContactSelect: (contact: ACContact | null) => void;
  defaultEmail?: string;
}

export function SecondaryContactSelector({
  contacts,
  isLoading,
  email,
  onEmailChange,
  onContactSelect,
  defaultEmail,
}: SecondaryContactSelectorProps) {
  const [useDropdown, setUseDropdown] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string>('');

  const handleSelectChange = (value: string) => {
    if (value === 'manual') {
      setUseDropdown(false);
      setSelectedContactId('');
      onContactSelect(null);
      return;
    }

    setSelectedContactId(value);
    const contact = contacts.find(c => c.id === value);
    if (contact) {
      onEmailChange(contact.email);
      onContactSelect(contact);
    }
  };

  const handleManualEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onEmailChange(e.target.value);
    onContactSelect(null);
    setSelectedContactId('');
  };

  const hasContacts = contacts.length > 0;

  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="secondary_poc_email">Secondary Contact Email</Label>
        {hasContacts && !isLoading && (
          <button
            type="button"
            className="text-xs text-blue-600 hover:text-blue-800"
            onClick={() => setUseDropdown(!useDropdown)}
          >
            {useDropdown ? 'Enter manually' : 'Select from AC'}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 h-10 px-3 border rounded-md text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading contacts...
        </div>
      ) : useDropdown && hasContacts ? (
        <Select value={selectedContactId} onValueChange={handleSelectChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select a contact" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">Enter manually</SelectItem>
            {contacts.map((contact) => {
              const name = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
              const label = name ? `${name} (${contact.email})` : contact.email;
              return (
                <SelectItem key={contact.id} value={contact.id}>
                  {label}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      ) : (
        <Input
          id="secondary_poc_email"
          name="secondary_poc_email"
          type="email"
          placeholder="secondary@company.com"
          value={email}
          onChange={handleManualEmailChange}
          defaultValue={defaultEmail}
        />
      )}
      <p className="text-xs text-muted-foreground">
        Optional. If this email matches a customer account, they will also have access to view this project.
      </p>
    </div>
  );
}
