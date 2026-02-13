import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Star } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface FormBlockData {
  id: string;
  type: string;
  label?: string;
  description?: string;
  placeholder?: string;
  is_required?: boolean;
  options?: string[] | { choices?: string[] };
  validation_rules?: Record<string, unknown>;
}

export interface FormRendererProps {
  blocks: FormBlockData[];
  answers?: Record<string, unknown>;
  readOnly?: boolean;
  onSubmit?: (data: Record<string, unknown>) => void;
}

function getOptions(block: FormBlockData): string[] {
  if (Array.isArray(block.options)) return block.options;
  if (block.options && typeof block.options === 'object' && 'choices' in block.options) {
    return (block.options as { choices?: string[] }).choices || [];
  }
  return [];
}

export function FormRenderer({ blocks, answers = {}, readOnly = false, onSubmit }: FormRendererProps) {
  const [formData, setFormData] = React.useState<Record<string, unknown>>(answers);

  React.useEffect(() => {
    setFormData(answers);
  }, [answers]);

  const handleChange = (blockId: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [blockId]: value }));
  };

  const handleSubmit = () => {
    onSubmit?.(formData);
  };

  const renderBlock = (block: FormBlockData) => {
    const value = formData[block.id];
    const options = getOptions(block);

    if (block.type === 'section' || block.type === 'html') {
      return (
        <div key={block.id} className="space-y-2">
          {block.label && (
            <h3 className="text-base font-semibold">{block.label}</h3>
          )}
          {block.description && (
            <p className="text-sm text-muted-foreground">{block.description}</p>
          )}
          {block.type === 'section' && <Separator className="my-4" />}
        </div>
      );
    }

    if (readOnly) {
      const displayValue = value === undefined || value === null
        ? '—'
        : Array.isArray(value)
          ? (value as unknown[]).join(', ')
          : String(value);
      return (
        <div key={block.id} className="space-y-2">
          <Label className="text-sm font-medium">{block.label}</Label>
          <div className="text-sm text-muted-foreground">{displayValue}</div>
        </div>
      );
    }

    switch (block.type) {
      case 'text':
        return (
          <div key={block.id} className="space-y-2">
            <Label>
              {block.label}
              {block.is_required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            {block.description && (
              <p className="text-xs text-muted-foreground">{block.description}</p>
            )}
            <Input
              value={(value as string) || ''}
              onChange={(e) => handleChange(block.id, e.target.value)}
              placeholder={block.placeholder}
              disabled={readOnly}
            />
          </div>
        );

      case 'textarea':
        return (
          <div key={block.id} className="space-y-2">
            <Label>
              {block.label}
              {block.is_required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            {block.description && (
              <p className="text-xs text-muted-foreground">{block.description}</p>
            )}
            <Textarea
              value={(value as string) || ''}
              onChange={(e) => handleChange(block.id, e.target.value)}
              placeholder={block.placeholder}
              rows={4}
              disabled={readOnly}
            />
          </div>
        );

      case 'number':
        return (
          <div key={block.id} className="space-y-2">
            <Label>
              {block.label}
              {block.is_required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            {block.description && (
              <p className="text-xs text-muted-foreground">{block.description}</p>
            )}
            <Input
              type="number"
              value={(value as number) ?? ''}
              onChange={(e) => handleChange(block.id, e.target.value ? Number(e.target.value) : null)}
              placeholder={block.placeholder}
              min={(block.validation_rules?.min as number) ?? undefined}
              max={(block.validation_rules?.max as number) ?? undefined}
              disabled={readOnly}
            />
          </div>
        );

      case 'date':
        return (
          <div key={block.id} className="space-y-2">
            <Label>
              {block.label}
              {block.is_required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            {block.description && (
              <p className="text-xs text-muted-foreground">{block.description}</p>
            )}
            <Input
              type="date"
              value={(value as string) || ''}
              onChange={(e) => handleChange(block.id, e.target.value)}
              disabled={readOnly}
            />
          </div>
        );

      case 'time':
        return (
          <div key={block.id} className="space-y-2">
            <Label>
              {block.label}
              {block.is_required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            {block.description && (
              <p className="text-xs text-muted-foreground">{block.description}</p>
            )}
            <Input
              type="time"
              value={(value as string) || ''}
              onChange={(e) => handleChange(block.id, e.target.value)}
              disabled={readOnly}
            />
          </div>
        );

      case 'radio':
        return (
          <div key={block.id} className="space-y-2">
            <Label>
              {block.label}
              {block.is_required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            {block.description && (
              <p className="text-xs text-muted-foreground">{block.description}</p>
            )}
            <div className="space-y-2">
              {(options.length ? options : ['Option 1', 'Option 2']).map((opt, i) => (
                <div key={i} className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id={`${block.id}-${i}`}
                    name={block.id}
                    value={opt}
                    checked={value === opt}
                    onChange={() => handleChange(block.id, opt)}
                    disabled={readOnly}
                    className="h-4 w-4"
                  />
                  <Label htmlFor={`${block.id}-${i}`} className="font-normal cursor-pointer">
                    {opt}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        );

      case 'checkbox':
        return (
          <div key={block.id} className="space-y-2">
            <Label>
              {block.label}
              {block.is_required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            {block.description && (
              <p className="text-xs text-muted-foreground">{block.description}</p>
            )}
            <div className="space-y-2">
              {(options.length ? options : ['Yes', 'No']).map((opt, i) => (
                <div key={i} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${block.id}-${i}`}
                    checked={Array.isArray(value) ? value.includes(opt) : value === opt}
                    onCheckedChange={(checked) => {
                      if (options.length <= 2) {
                        handleChange(block.id, checked ? opt : null);
                      } else {
                        const arr = Array.isArray(value) ? [...value] : [];
                        if (checked) {
                          arr.push(opt);
                        } else {
                          arr.splice(arr.indexOf(opt), 1);
                        }
                        handleChange(block.id, arr);
                      }
                    }}
                    disabled={readOnly}
                  />
                  <Label htmlFor={`${block.id}-${i}`} className="font-normal cursor-pointer">
                    {opt}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        );

      case 'select':
        return (
          <div key={block.id} className="space-y-2">
            <Label>
              {block.label}
              {block.is_required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            {block.description && (
              <p className="text-xs text-muted-foreground">{block.description}</p>
            )}
            <Select
              value={(value as string) || 'none'}
              onValueChange={(v) => handleChange(block.id, v === 'none' ? '' : v)}
              disabled={readOnly}
            >
              <SelectTrigger>
                <SelectValue placeholder={block.placeholder || 'Select...'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select...</SelectItem>
                {(options.length ? options : ['Option 1', 'Option 2', 'Option 3']).map((opt, i) => (
                  <SelectItem key={i} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case 'multiselect':
        return (
          <div key={block.id} className="space-y-2">
            <Label>
              {block.label}
              {block.is_required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            {block.description && (
              <p className="text-xs text-muted-foreground">{block.description}</p>
            )}
            <div className="space-y-2">
              {(options.length ? options : ['Option 1', 'Option 2', 'Option 3']).map((opt, i) => (
                <div key={i} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${block.id}-${i}`}
                    checked={Array.isArray(value) ? value.includes(opt) : false}
                    onCheckedChange={(checked) => {
                      const arr = Array.isArray(value) ? [...value] : [];
                      if (checked) {
                        arr.push(opt);
                      } else {
                        arr.splice(arr.indexOf(opt), 1);
                      }
                      handleChange(block.id, arr);
                    }}
                    disabled={readOnly}
                  />
                  <Label htmlFor={`${block.id}-${i}`} className="font-normal cursor-pointer">
                    {opt}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        );

      case 'rating':
        const maxRating = (block.validation_rules?.max as number) || 5;
        return (
          <div key={block.id} className="space-y-2">
            <Label>
              {block.label}
              {block.is_required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            {block.description && (
              <p className="text-xs text-muted-foreground">{block.description}</p>
            )}
            <div className="flex gap-1">
              {Array.from({ length: maxRating }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => !readOnly && handleChange(block.id, i + 1)}
                  disabled={readOnly}
                  className="p-1 rounded hover:bg-muted/50 transition-colors"
                >
                  <Star
                    className={`h-8 w-8 ${
                      (value as number) !== undefined && (value as number) >= i + 1
                        ? 'text-yellow-400 fill-yellow-400'
                        : 'text-muted-foreground'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>
        );

      case 'file':
        return (
          <div key={block.id} className="space-y-2">
            <Label>
              {block.label}
              {block.is_required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            {block.description && (
              <p className="text-xs text-muted-foreground">{block.description}</p>
            )}
            {readOnly && value ? (
              <p className="text-sm text-muted-foreground">
                {typeof value === 'string' && value.startsWith('http') ? (
                  <a href={value} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    View attachment
                  </a>
                ) : (
                  String(value)
                )}
              </p>
            ) : (
              <Input
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleChange(block.id, file.name);
                  }
                }}
                disabled={readOnly}
              />
            )}
          </div>
        );

      default:
        return (
          <div key={block.id} className="space-y-2">
            <Label>{block.label}</Label>
            <Input
              value={(value as string) || ''}
              onChange={(e) => handleChange(block.id, e.target.value)}
              placeholder={block.placeholder}
              disabled={readOnly}
            />
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      {blocks.map((block) => renderBlock(block))}
      {!readOnly && onSubmit && (
        <div className="pt-4">
          <button
            type="button"
            onClick={handleSubmit}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Submit
          </button>
        </div>
      )}
    </div>
  );
}
