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

  const handleProgressChange = (field: 'min' | 'max', value: number) => {
    onFilterChange('progress', {
      ...filters.progress,
      [field]: value
    });
  };

  const handleDateRangeChange = (field: 'start' | 'end', date: Date | null) => {
    onFilterChange('dateRange', {
      ...filters.dateRange,
      [field]: date
    });
  };

  const handleApply = () => {
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <span>{title}</span>
          </DialogTitle>
          <DialogDescription>
            Filter and refine your search results
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Progress Range Filter */}
          {property.type === 'range' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">Min %</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={filters.progress.min}
                    onChange={(e) => handleProgressChange('min', parseInt(e.target.value) || 0)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm">Max %</Label>
                  <Input
                    type="number"
                    placeholder="100"
                    value={filters.progress.max}
                    onChange={(e) => handleProgressChange('max', parseInt(e.target.value) || 100)}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Multi-Select Filter */}
          {property.type === 'multi-select' && property.options && (
            <div className="space-y-3">
              <div className="max-h-64 overflow-y-auto space-y-2">
                {property.options.map((option) => {
                  const currentFilter = filters[property.id as keyof FilterState] as string[];
                  const isSelected = currentFilter?.includes(option);
                  return (
                    <div key={option} className="flex items-center space-x-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onOptionSelect(property.id as keyof FilterState, option)}
                      />
                      <label 
                        className="text-sm cursor-pointer flex-1" 
                        onClick={() => onOptionSelect(property.id as keyof FilterState, option)}
                      >
                        {option}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Date Range Filter */}
          {property.type === 'date-range' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal mt-1">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filters.dateRange.start ? format(filters.dateRange.start, 'MMM dd') : 'Select date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={filters.dateRange.start || undefined}
                        onSelect={(date) => handleDateRangeChange('start', date || null)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label className="text-sm">End Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal mt-1">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filters.dateRange.end ? format(filters.dateRange.end, 'MMM dd') : 'Select date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={filters.dateRange.end || undefined}
                        onSelect={(date) => handleDateRangeChange('end', date || null)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
          )}

          <Button onClick={handleApply} className="w-full hero-primary">
            Apply Filter
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}