import React from 'react';
import { Label } from './ui/label';
import { Input } from './ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface AddressData {
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
  county: string;
}

interface SimpleAddressFormProps {
  address: AddressData;
  onChange: (field: keyof AddressData, value: string) => void;
}

const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
];

export function SimpleAddressForm({ address, onChange }: SimpleAddressFormProps) {
  return (
    <div className="space-y-4">
      {/* Address Line 1 */}
      <div>
        <Label htmlFor="addressLine1">Address Line 1 (Street)</Label>
        <Input
          id="addressLine1"
          value={address.addressLine1}
          onChange={(e) => onChange('addressLine1', e.target.value)}
          placeholder="123 Main Street"
        />
      </div>

      {/* Address Line 2 */}
      <div>
        <Label htmlFor="addressLine2">Address Line 2 (Suite, Apt, etc.)</Label>
        <Input
          id="addressLine2"
          value={address.addressLine2}
          onChange={(e) => onChange('addressLine2', e.target.value)}
          placeholder="Suite 100 (optional)"
        />
      </div>

      {/* City, State, ZIP */}
      <div className="grid grid-cols-6 gap-4">
        <div className="col-span-3">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            value={address.city}
            onChange={(e) => onChange('city', e.target.value)}
            placeholder="City"
          />
        </div>
        <div className="col-span-2">
          <Label htmlFor="state">State</Label>
          <Select value={address.state} onValueChange={(value) => onChange('state', value)}>
            <SelectTrigger id="state">
              <SelectValue placeholder="Select state" />
            </SelectTrigger>
            <SelectContent>
              {US_STATES.map((state) => (
                <SelectItem key={state.code} value={state.code}>
                  {state.code} - {state.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-1">
          <Label htmlFor="zip">ZIP</Label>
          <Input
            id="zip"
            value={address.zip}
            onChange={(e) => onChange('zip', e.target.value)}
            placeholder="12345"
            maxLength={10}
          />
        </div>
      </div>

      {/* County */}
      <div>
        <Label htmlFor="county">County</Label>
        <Input
          id="county"
          value={address.county}
          onChange={(e) => onChange('county', e.target.value)}
          placeholder="County name (optional)"
        />
      </div>
    </div>
  );
}
