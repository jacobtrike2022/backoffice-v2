import React from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Plus, X } from 'lucide-react';

interface EmailVariable {
  key: string;
  description: string;
}

interface EmailVariablesEditorProps {
  variables: EmailVariable[];
  onChange: (variables: EmailVariable[]) => void;
  disabled?: boolean;
}

export function EmailVariablesEditor({
  variables,
  onChange,
  disabled = false,
}: EmailVariablesEditorProps) {
  const addVariable = () => {
    onChange([...variables, { key: '', description: '' }]);
  };

  const removeVariable = (index: number) => {
    onChange(variables.filter((_, i) => i !== index));
  };

  const updateVariable = (
    index: number,
    field: 'key' | 'description',
    value: string
  ) => {
    const updated = [...variables];
    // For key field, sanitize: lowercase, no spaces, alphanumeric + underscore only
    if (field === 'key') {
      value = value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    }
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Available Variables</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addVariable}
          disabled={disabled}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Variable
        </Button>
      </div>

      {variables.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
          No variables defined. Add variables that can be used in this template.
        </p>
      ) : (
        <div className="space-y-2">
          {variables.map((variable, index) => (
            <div
              key={index}
              className="flex items-start gap-2 p-3 border rounded-lg bg-muted/30"
            >
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground font-mono text-sm">{'{{'}</span>
                  <Input
                    value={variable.key}
                    onChange={(e) => updateVariable(index, 'key', e.target.value)}
                    placeholder="variable_name"
                    className="font-mono h-8"
                    disabled={disabled}
                  />
                  <span className="text-muted-foreground font-mono text-sm">{'}}'}</span>
                </div>
                <Input
                  value={variable.description}
                  onChange={(e) =>
                    updateVariable(index, 'description', e.target.value)
                  }
                  placeholder="Description of what this variable represents"
                  className="h-8 text-sm"
                  disabled={disabled}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeVariable(index)}
                disabled={disabled}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {variables.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Use these variables in your template with double curly braces:{' '}
          <code className="bg-muted px-1 rounded">{`{{variable_name}}`}</code>
        </p>
      )}
    </div>
  );
}
