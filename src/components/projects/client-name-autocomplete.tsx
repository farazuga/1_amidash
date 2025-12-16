'use client';

import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Loader2, Building2, ExternalLink, Mail, ArrowRight } from 'lucide-react';
import { useActiveCampaignSearch, useContactSearch } from '@/hooks/use-activecampaign';
import type { ACAccount, ACContact } from '@/types/activecampaign';

// Helper to detect if string looks like an email
function isEmailLike(str: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str.trim());
}

interface ClientNameAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onAccountSelect: (account: ACAccount | null) => void;
  onContactFromEmail?: (contact: ACContact) => void;
  selectedAccount: ACAccount | null;
  defaultValue?: string;
}

export function ClientNameAutocomplete({
  value,
  onChange,
  onAccountSelect,
  onContactFromEmail,
  selectedAccount,
  defaultValue,
}: ClientNameAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || defaultValue || '');
  const inputRef = useRef<HTMLInputElement>(null);
  const { accounts, isLoading, error } = useActiveCampaignSearch(inputValue);

  // Check if input looks like an email and search contacts
  const isEmail = isEmailLike(inputValue);
  const { contacts: emailContacts, isLoading: emailSearchLoading } = useContactSearch(
    isEmail ? inputValue : ''
  );

  // Sync external value changes
  useEffect(() => {
    if (value !== inputValue) {
      setInputValue(value);
    }
  }, [value]);

  // Open popover when there are results (accounts or email contacts)
  useEffect(() => {
    const hasResults = accounts.length > 0 || emailContacts.length > 0;
    if (hasResults && inputValue.length >= 2 && !selectedAccount) {
      setOpen(true);
    }
  }, [accounts, emailContacts, inputValue, selectedAccount]);

  const handleSelect = (account: ACAccount) => {
    setInputValue(account.name);
    onChange(account.name);
    onAccountSelect(account);
    setOpen(false);
  };

  const handleContactSelect = (contact: ACContact) => {
    // Use the contact's org name if available, otherwise keep the email
    const displayName = contact.orgname || inputValue;
    setInputValue(displayName);
    onChange(displayName);
    if (onContactFromEmail) {
      onContactFromEmail(contact);
    }
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);
    // Clear account selection if user modifies the value
    if (selectedAccount && newValue !== selectedAccount.name) {
      onAccountSelect(null);
    }
  };

  const handleInputFocus = () => {
    const hasResults = accounts.length > 0 || emailContacts.length > 0;
    if (hasResults && !selectedAccount) {
      setOpen(true);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor="client_name">Client Name *</Label>
        {selectedAccount && selectedAccount.accountUrl && (
          <a
            href={selectedAccount.accountUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
            title="View in ActiveCampaign"
          >
            <ExternalLink className="h-3 w-3" />
            View in AC
          </a>
        )}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Input
              ref={inputRef}
              id="client_name"
              name="client_name"
              value={inputValue}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              placeholder="Start typing to search Active Campaign..."
              required
              autoComplete="off"
            />
            {(isLoading || emailSearchLoading) && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
            {isEmail && !emailSearchLoading && emailContacts.length > 0 && (
              <ArrowRight className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-500" />
            )}
          </div>
        </PopoverTrigger>

        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command shouldFilter={false}>
            <CommandList>
              {error ? (
                <div className="py-6 text-center text-sm text-red-500">
                  {error}
                </div>
              ) : (
                <>
                  {/* Show email contacts when input looks like an email */}
                  {isEmail && emailContacts.length > 0 && (
                    <CommandGroup heading="Contacts matching email">
                      {emailContacts.map((contact) => (
                        <CommandItem
                          key={contact.id}
                          value={`contact-${contact.id}`}
                          onSelect={() => handleContactSelect(contact)}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Mail className="h-4 w-4 text-blue-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">
                              {contact.firstName} {contact.lastName}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {contact.email}
                              {contact.orgname && ` • ${contact.orgname}`}
                            </div>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}

                  {/* Show accounts */}
                  {accounts.length > 0 && (
                    <CommandGroup heading="Active Campaign Accounts">
                      {accounts.map((account) => (
                        <CommandItem
                          key={account.id}
                          value={account.id}
                          onSelect={() => handleSelect(account)}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{account.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {account.contactCount} contact{account.contactCount !== '1' ? 's' : ''}
                            </div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}

                  {/* Empty state */}
                  {accounts.length === 0 && emailContacts.length === 0 && inputValue.length >= 2 && !isLoading && !emailSearchLoading && (
                    <CommandEmpty>No accounts or contacts found</CommandEmpty>
                  )}
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
