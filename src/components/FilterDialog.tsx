import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { CalendarIcon } from 'lucide-react';

// Mock date formatting function since date-fns is not available
const format = (date: Date, formatStr: string) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (formatStr === 'MMM dd') {
    return `${months[date.getMonth()]} ${date.getDate().toString().padStart(2, '0')}`;
  }
  return date.toLocaleDateString();
};

interface FilterProperty {
  id: string;
  label: string;
  icon: any;
  type: string;
  description: string;
  options?: string[];
}

interface FilterState {
  progress: { min: number; max: number };
  albums: string[];
  location: string[];
  districts: string[];
  roles: string[];
  playlists: string[];
  tracks: string[];
  dateRange: { start: Date | null; end: Date | null };
  employees: string[];
  certifications: string[];
  completionStatus: string[];
}

interface FilterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  property: FilterProperty | null;
  filters: FilterState;
  onFilterChange: (filterType: keyof FilterState, value: any) => void;
  onOptionSelect: (filterType: keyof FilterState, option: string) => void;
}

export function FilterDialog({ 
  isOpen, 
  onClose, 
  property, 
  filters, 
  onFilterChange, 
  onOptionSelect 
}: FilterDialogProps) {
  if (!property) return null;

  const Icon = property.icon;
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <span>{property.label}</span>
          </DialogTitle>
          <DialogDescription>
            {property.description}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {property.type === 'range' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min">Min</Label>
                <Input
                  id="min"
                  type="number"
                  value={filters.progress.min}
                  onChange={(e) => onFilterChange('progress', { min: parseFloat(e.target.value), max: filters.progress.max })}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max">Max</Label>
                <Input
                  id="max"
                  type="number"
                  value={filters.progress.max}
                  onChange={(e) => onFilterChange('progress', { min: filters.progress.min, max: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </div>
            </div>
          )}
          {property.type === 'date' && (
            <div className="relative">
              <Popover>
                <PopoverTrigger className="w-full">
                  <Button
                    variant="outline"
                    className="w-full pl-3 text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.dateRange.start ? (
                      format(filters.dateRange.start, 'MMM dd')
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.dateRange.start}
                    onSelect={(date) => onFilterChange('dateRange', { start: date, end: filters.dateRange.end })}
                    className="w-full"
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
          {property.type === 'checkbox' && (
            <div className="space-y-2">
              <Label htmlFor="checkbox">Select {property.label}</Label>
              <div className="grid grid-cols-2 gap-4">
                {property.options?.map((option) => (
                  <Checkbox
                    key={option}
                    id={option}
                    checked={filters[property.id as keyof FilterState].includes(option)}
                    onCheckedChange={(checked) => onOptionSelect(property.id as keyof FilterState, option)}
                  >
                    {option}
                  </Checkbox>
                ))}
              </div>
            </div>
          )}
        </div>
        <Button
          type="submit"
          className="w-full"
          onClick={onClose}
        >
          Apply
        </Button>
      </DialogContent>
    </Dialog>
  );
}