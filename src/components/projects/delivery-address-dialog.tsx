'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DeliveryAddress } from '@/types';

const US_STATES = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'DC', label: 'District of Columbia' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
];

interface DeliveryAddressDialogProps {
  address: DeliveryAddress | null;
  onSave: (address: DeliveryAddress) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeliveryAddressDialog({
  address,
  onSave,
  open,
  onOpenChange,
}: DeliveryAddressDialogProps) {
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [country, setCountry] = useState('US');

  // Pre-populate fields when dialog opens
  useEffect(() => {
    if (open) {
      setStreet(address?.street || '');
      setCity(address?.city || '');
      setState(address?.state || '');
      setZip(address?.zip || '');
      setCountry(address?.country || 'US');
    }
  }, [open, address]);

  const handleSave = () => {
    if (!street.trim() || !city.trim() || !state || !zip.trim()) {
      return;
    }
    // Validate ZIP is 5 digits
    if (!/^\d{5}$/.test(zip.trim())) {
      return;
    }
    onSave({
      street: street.trim(),
      city: city.trim(),
      state,
      zip: zip.trim(),
      country: country.trim() || 'US',
    });
  };

  const isValid =
    street.trim() !== '' &&
    city.trim() !== '' &&
    state !== '' &&
    /^\d{5}$/.test(zip.trim()) &&
    country.trim() !== '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delivery Address</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Street */}
          <div className="space-y-2">
            <Label htmlFor="delivery_street">Street *</Label>
            <Input
              id="delivery_street"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              placeholder="123 Main St"
            />
          </div>

          {/* City / State / ZIP on one row */}
          <div className="grid grid-cols-5 gap-2">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="delivery_city">City *</Label>
              <Input
                id="delivery_city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor="delivery_state">State *</Label>
              <Select value={state} onValueChange={setState}>
                <SelectTrigger id="delivery_state">
                  <SelectValue placeholder="State" />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.value} - {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-1 space-y-2">
              <Label htmlFor="delivery_zip">ZIP *</Label>
              <Input
                id="delivery_zip"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                placeholder="12345"
                pattern="\d{5}"
                maxLength={5}
              />
            </div>
          </div>

          {/* Country */}
          <div className="space-y-2">
            <Label htmlFor="delivery_country">Country *</Label>
            <Input
              id="delivery_country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="US"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={!isValid}>
            Save Address
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
