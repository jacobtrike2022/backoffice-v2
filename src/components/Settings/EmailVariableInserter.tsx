import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { Variable } from 'lucide-react';

interface EmailVariable {
  key: string;
  description: string;
}

interface EmailVariableInserterProps {
  variables: EmailVariable[];
  onInsert: (variable: string) => void;
  disabled?: boolean;
  size?: 'sm' | 'default';
}

export function EmailVariableInserter({
  variables,
  onInsert,
  disabled = false,
  size = 'sm',
}: EmailVariableInserterProps) {
  const { t } = useTranslation();

  if (variables.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={size}
          disabled={disabled}
          className="gap-1"
        >
          <Variable className="h-4 w-4" />
          {t('emailSettings.insertVariable')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
        {variables.map((variable) => (
          <DropdownMenuItem
            key={variable.key}
            onClick={() => onInsert(`{{${variable.key}}}`)}
            className="flex flex-col items-start py-2"
          >
            <span className="font-mono text-sm text-primary">
              {`{{${variable.key}}}`}
            </span>
            <span className="text-xs text-muted-foreground">
              {variable.description}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
