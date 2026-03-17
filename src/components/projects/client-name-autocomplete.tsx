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
import { Loader2, Building2, User } from 'lucide-react';
import { useOdooPartnerSearch } from '@/hooks/use-odoo-partners';
import type { OdooPartnerResult } from '@/hooks/use-odoo-partners';

interface ClientNameAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPartnerSelect: (partner: OdooPartnerResult | null) => void;
  selectedPartner: OdooPartnerResult | null;
  defaultValue?: string;
}

export function ClientNameAutocomplete({
  value,
  onChange,
  onPartnerSelect,
  selectedPartner,
  defaultValue,
}: ClientNameAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || defaultValue || '');
  const inputRef = useRef<HTMLInputElement>(null);
  const { partners, isLoading, error } = useOdooPartnerSearch(inputValue);

  // Sync external value changes
  useEffect(() => {
    if (value !== inputValue) {
      setInputValue(value);
    }
  }, [value]);

  // Open popover when there are results
  useEffect(() => {
    if (partners.length > 0 && inputValue.length >= 2 && !selectedPartner) {
      setOpen(true);
    }
  }, [partners, inputValue, selectedPartner]);

  const handleSelect = (partner: OdooPartnerResult) => {
    setInputValue(partner.name);
    onChange(partner.name);
    onPartnerSelect(partner);
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);
    // Clear partner selection if user modifies the value
    if (selectedPartner && newValue !== selectedPartner.name) {
      onPartnerSelect(null);
    }
  };

  const handleInputFocus = () => {
    if (partners.length > 0 && !selectedPartner) {
      setOpen(true);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="client_name">Client Name *</Label>

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
              placeholder="Start typing to search Odoo..."
              required
              autoComplete="off"
            />
            {isLoading && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
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
                  {partners.length > 0 && (
                    <CommandGroup heading="Odoo Contacts">
                      {partners.map((partner) => (
                        <CommandItem
                          key={partner.id}
                          value={String(partner.id)}
                          onSelect={() => handleSelect(partner)}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          {partner.isCompany ? (
                            <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          ) : (
                            <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{partner.name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {[
                                partner.email,
                                partner.address?.city && partner.address?.state
                                  ? `${partner.address.city}, ${partner.address.state}`
                                  : partner.address?.city || partner.address?.state,
                              ].filter(Boolean).join(' · ')}
                            </div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}

                  {partners.length === 0 && inputValue.length >= 2 && !isLoading && (
                    <CommandEmpty>No partners found in Odoo</CommandEmpty>
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
