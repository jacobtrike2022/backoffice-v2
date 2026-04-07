import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Plus,
  Sparkles,
  Phone,
  Mail,
  X,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { cn } from './ui/utils';

export type CellStatus = 'valid' | 'warning' | 'error' | 'empty' | 'pending_create';

export interface ColumnDef {
  key: string;
  label: string;
  type: 'text' | 'email' | 'phone' | 'date' | 'lookup';
  required?: boolean;
  width?: string;
  lookupOptions?: Array<{
    id: string;
    name: string;
    code?: string;
    unit_number?: number | null;
    subtitle?: string;
  }>;
  allowCreate?: boolean;
  onCreateRequest?: (newValue: string) => void;
}

export interface RowData {
  id: string;
  values: Record<string, string>;
  resolvedIds?: Record<string, string>;
  cellStatus?: Record<string, CellStatus>;
  cellMessages?: Record<string, string>;
  rowStatus?: 'ready' | 'warning' | 'error' | 'skipped';
  rowMessage?: string;
}

export interface EditableImportTableProps {
  columns: ColumnDef[];
  rows: RowData[];
  onCellChange: (rowId: string, columnKey: string, newValue: string) => void;
  onResolveLookup?: (rowId: string, columnKey: string, resolvedId: string) => void;
  filter?: 'all' | 'issues' | 'ready';
  onFilterChange?: (filter: 'all' | 'issues' | 'ready') => void;
  stats?: { total: number; ready: number; warnings: number; errors: number };
  className?: string;
}

const cellStyleByStatus: Record<CellStatus, string> = {
  valid: '',
  warning: 'bg-amber-50 dark:bg-amber-900/10',
  error: 'bg-red-50 dark:bg-red-900/10',
  empty: '',
  pending_create: 'bg-blue-50 dark:bg-blue-900/10',
};

const rowBorderByStatus: Record<string, string> = {
  ready: 'border-l-2 border-green-500',
  warning: 'border-l-2 border-amber-500',
  error: 'border-l-2 border-red-500',
  skipped: 'border-l-2 border-gray-300 opacity-50 line-through',
};

interface EditingCell {
  rowId: string;
  columnKey: string;
}

export function EditableImportTable({
  columns,
  rows,
  onCellChange,
  onResolveLookup,
  filter = 'all',
  onFilterChange,
  stats,
  className,
}: EditableImportTableProps) {
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [draftValue, setDraftValue] = useState<string>('');
  const [openLookup, setOpenLookup] = useState<{
    rowId: string;
    columnKey: string;
  } | null>(null);

  const filteredRows = useMemo(() => {
    if (filter === 'all') return rows;
    if (filter === 'ready') return rows.filter((r) => r.rowStatus === 'ready');
    if (filter === 'issues')
      return rows.filter((r) => r.rowStatus === 'warning' || r.rowStatus === 'error');
    return rows;
  }, [rows, filter]);

  const startEdit = (row: RowData, col: ColumnDef) => {
    if (col.type === 'lookup') return; // lookup handled by Popover
    setEditingCell({ rowId: row.id, columnKey: col.key });
    setDraftValue(row.values[col.key] ?? '');
  };

  const commitEdit = () => {
    if (!editingCell) return;
    onCellChange(editingCell.rowId, editingCell.columnKey, draftValue);
    setEditingCell(null);
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setDraftValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-background border rounded-lg overflow-hidden',
        className
      )}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30 sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
            {stats?.ready ?? 0} ready
          </Badge>
          {stats && stats.warnings > 0 && (
            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
              {stats.warnings} warnings
            </Badge>
          )}
          {stats && stats.errors > 0 && (
            <Badge variant="destructive">{stats.errors} errors</Badge>
          )}
          <span className="text-xs text-muted-foreground ml-2">
            Showing {filteredRows.length} of {rows.length} rows
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={filter === 'all' ? 'default' : 'ghost'}
            onClick={() => onFilterChange?.('all')}
          >
            All ({stats?.total ?? rows.length})
          </Button>
          <Button
            size="sm"
            variant={filter === 'issues' ? 'default' : 'ghost'}
            onClick={() => onFilterChange?.('issues')}
          >
            Issues
          </Button>
          <Button
            size="sm"
            variant={filter === 'ready' ? 'default' : 'ghost'}
            onClick={() => onFilterChange?.('ready')}
          >
            Ready
          </Button>
        </div>
      </div>

      {/* Scrollable table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-muted/50 border-b">
            <tr>
              <th className="text-left font-medium text-xs text-muted-foreground px-2 py-2 w-10 sticky left-0 z-20 bg-muted/50">
                #
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="text-left font-medium text-xs text-muted-foreground px-3 py-2 whitespace-nowrap"
                  style={{ width: col.width, minWidth: col.width ?? '140px' }}
                >
                  {col.label}
                  {col.required && <span className="text-red-500 ml-0.5">*</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, idx) => {
              const rowBorderClass = row.rowStatus
                ? rowBorderByStatus[row.rowStatus] ?? ''
                : '';
              return (
                <tr
                  key={row.id}
                  className={cn(
                    'border-b hover:bg-muted/20 group',
                    rowBorderClass
                  )}
                  title={row.rowMessage}
                >
                  <td className="px-2 py-1 text-xs text-muted-foreground align-middle sticky left-0 bg-background z-10 border-r">
                    {idx + 1}
                  </td>
                  {columns.map((col) => {
                    const status: CellStatus =
                      row.cellStatus?.[col.key] ?? 'valid';
                    const message = row.cellMessages?.[col.key];
                    const isEditing =
                      editingCell?.rowId === row.id &&
                      editingCell?.columnKey === col.key;
                    const value = row.values[col.key] ?? '';
                    const cellBgClass = cellStyleByStatus[status] ?? '';

                    return (
                      <td
                        key={col.key}
                        className={cn(
                          'px-3 py-1 align-middle cursor-text border-r border-border/40',
                          cellBgClass
                        )}
                        style={{ minWidth: col.width ?? '140px' }}
                        onClick={() => {
                          if (!isEditing) startEdit(row, col);
                        }}
                        title={message}
                      >
                        {renderCellContent({
                          col,
                          row,
                          value,
                          status,
                          message,
                          isEditing,
                          draftValue,
                          setDraftValue,
                          commitEdit,
                          cancelEdit,
                          handleKeyDown,
                          rowIndex: idx,
                          onResolveLookup,
                          onCellChange,
                          openLookup,
                          setOpenLookup,
                        })}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {filteredRows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="text-center text-sm text-muted-foreground py-12"
                >
                  No rows to display.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Cell rendering ---------- */

interface RenderCellArgs {
  col: ColumnDef;
  row: RowData;
  value: string;
  status: CellStatus;
  message?: string;
  isEditing: boolean;
  draftValue: string;
  setDraftValue: (v: string) => void;
  commitEdit: () => void;
  cancelEdit: () => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  rowIndex: number;
  onResolveLookup?: (rowId: string, columnKey: string, resolvedId: string) => void;
  onCellChange: (rowId: string, columnKey: string, newValue: string) => void;
  openLookup: { rowId: string; columnKey: string } | null;
  setOpenLookup: (next: { rowId: string; columnKey: string } | null) => void;
}

function renderCellContent(args: RenderCellArgs) {
  const {
    col,
    row,
    value,
    status,
    message,
    isEditing,
    draftValue,
    setDraftValue,
    commitEdit,
    handleKeyDown,
    rowIndex,
  } = args;

  const ariaLabel = `${col.label} row ${rowIndex + 1}`;

  // Lookup cell handled separately (uses Popover, not inline edit)
  if (col.type === 'lookup') {
    return (
      <LookupCell
        col={col}
        row={row}
        value={value}
        status={status}
        onResolveLookup={args.onResolveLookup}
        onCellChange={args.onCellChange}
        rowIndex={rowIndex}
        openLookup={args.openLookup}
        setOpenLookup={args.setOpenLookup}
      />
    );
  }

  if (isEditing) {
    const inputType =
      col.type === 'email'
        ? 'email'
        : col.type === 'phone'
        ? 'tel'
        : col.type === 'date'
        ? 'date'
        : 'text';
    return (
      <Input
        autoFocus
        type={inputType}
        value={draftValue}
        onChange={(e) => setDraftValue(e.target.value)}
        onBlur={commitEdit}
        onKeyDown={handleKeyDown}
        aria-label={ariaLabel}
        className="h-7 px-2 py-1 text-sm"
      />
    );
  }

  const errorIcon =
    status === 'error' || (col.required && !value) ? (
      <AlertCircle className="h-3 w-3 text-red-500 inline ml-1" />
    ) : status === 'warning' ? (
      <AlertTriangle className="h-3 w-3 text-amber-500 inline ml-1" />
    ) : null;

  const isEmpty = !value || value.trim() === '';

  const displayValue = (() => {
    if (isEmpty) {
      return (
        <span className="text-muted-foreground italic text-xs">empty</span>
      );
    }
    if (col.type === 'email') {
      return (
        <>
          <Mail className="h-3 w-3 text-muted-foreground inline mr-1" />
          <span className="lowercase">{value}</span>
        </>
      );
    }
    if (col.type === 'phone') {
      return (
        <>
          <Phone className="h-3 w-3 text-muted-foreground inline mr-1" />
          <span>{value}</span>
        </>
      );
    }
    return <span>{value}</span>;
  })();

  return (
    <div className="flex items-center min-h-[24px]" aria-label={ariaLabel}>
      <span className="truncate">{displayValue}</span>
      {errorIcon}
      {status === 'warning' && message && col.type === 'phone' && (
        <span className="text-[10px] text-amber-600 ml-1 truncate">
          {message}
        </span>
      )}
    </div>
  );
}

/* ---------- Lookup cell with popover ---------- */

interface LookupCellProps {
  col: ColumnDef;
  row: RowData;
  value: string;
  status: CellStatus;
  rowIndex: number;
  onResolveLookup?: (rowId: string, columnKey: string, resolvedId: string) => void;
  onCellChange: (rowId: string, columnKey: string, newValue: string) => void;
  openLookup: { rowId: string; columnKey: string } | null;
  setOpenLookup: (next: { rowId: string; columnKey: string } | null) => void;
}

function LookupCell({
  col,
  row,
  value,
  status,
  rowIndex,
  onResolveLookup,
  onCellChange,
  openLookup,
  setOpenLookup,
}: LookupCellProps) {
  const isOpen =
    openLookup?.rowId === row.id && openLookup?.columnKey === col.key;
  const [search, setSearch] = useState('');

  const resolvedId = row.resolvedIds?.[col.key];
  const options = col.lookupOptions ?? [];

  // When the popover opens, prefill the search with the unresolved CSV value
  // so the user immediately sees fuzzy matches or the create-new option
  // without having to retype anything. We watch isOpen rather than driving
  // the prefill from a click handler so that opening via any means (including
  // being implicitly closed when another lookup steals the shared open slot)
  // stays in sync.
  useEffect(() => {
    if (isOpen) {
      const isResolved = !!resolvedId;
      setSearch(!isResolved && value ? value.trim() : '');
    } else {
      setSearch('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setOpenLookup({ rowId: row.id, columnKey: col.key });
    } else if (isOpen) {
      setOpenLookup(null);
    }
  };

  const resolvedOption = useMemo(
    () => (resolvedId ? options.find((o) => o.id === resolvedId) : undefined),
    [options, resolvedId]
  );

  const filteredOptions = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return options.slice(0, 50);
    return options
      .filter((o) => {
        const name = (o.name ?? '').toLowerCase();
        const code = (o.code ?? '').toLowerCase();
        const unit = o.unit_number != null ? String(o.unit_number) : '';
        return (
          name.includes(q) ||
          code.includes(q) ||
          unit.includes(q) ||
          (o.subtitle ?? '').toLowerCase().includes(q)
        );
      })
      .slice(0, 50);
  }, [options, search]);

  const hasExactMatch = filteredOptions.some(
    (o) => o.name.toLowerCase() === search.toLowerCase().trim()
  );

  const showCreateRow =
    col.allowCreate && search.trim().length > 0 && !hasExactMatch;

  const handleSelect = (opt: { id: string; name: string }) => {
    onCellChange(row.id, col.key, opt.name);
    onResolveLookup?.(row.id, col.key, opt.id);
    setOpenLookup(null);
  };

  const handleCreate = () => {
    const newVal = search.trim();
    if (!newVal) return;
    col.onCreateRequest?.(newVal);
    onCellChange(row.id, col.key, newVal);
    setOpenLookup(null);
  };

  const isEmpty = !value || value.trim() === '';
  const needsMapping = !isEmpty && !resolvedId && status !== 'pending_create';

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 min-h-[24px] w-full text-left"
          aria-label={`${col.label} row ${rowIndex + 1}`}
          onClick={(e) => {
            e.stopPropagation();
            handleOpenChange(true);
          }}
        >
          {isEmpty ? (
            <span className="text-muted-foreground italic text-xs">empty</span>
          ) : status === 'pending_create' ? (
            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 gap-1">
              <Sparkles className="h-3 w-3" />
              Will create: {value}
            </Badge>
          ) : resolvedOption ? (
            <>
              <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />
              <span className="truncate">{resolvedOption.name}</span>
              {resolvedOption.subtitle && (
                <span className="text-[10px] text-muted-foreground truncate">
                  {resolvedOption.subtitle}
                </span>
              )}
            </>
          ) : needsMapping ? (
            <>
              <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
              <span className="truncate">{value}</span>
              <span className="text-[10px] text-amber-600 ml-1">
                Needs mapping
              </span>
            </>
          ) : (
            <span className="truncate">{value}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="p-2 border-b">
          <Input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${col.label.toLowerCase()}...`}
            className="h-8 text-sm"
          />
        </div>
        <div className="max-h-64 overflow-auto">
          {showCreateRow && (
            <button
              type="button"
              onClick={handleCreate}
              className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 border-b"
            >
              <Plus className="h-4 w-4" />
              <span className="truncate">Create new: "{search.trim()}"</span>
            </button>
          )}
          {filteredOptions.length === 0 && !showCreateRow && (
            <div className="px-3 py-4 text-xs text-muted-foreground text-center">
              No matches found
            </div>
          )}
          {filteredOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleSelect(opt)}
              className={cn(
                'flex items-center justify-between w-full text-left px-3 py-2 text-sm hover:bg-muted',
                resolvedId === opt.id && 'bg-green-50'
              )}
            >
              <div className="flex flex-col min-w-0">
                <span className="truncate">{opt.name}</span>
                {(opt.subtitle ||
                  opt.code ||
                  opt.unit_number != null) && (
                  <span className="text-[10px] text-muted-foreground truncate">
                    {opt.subtitle ??
                      [
                        opt.code ? `Code: ${opt.code}` : null,
                        opt.unit_number != null
                          ? `Unit #${opt.unit_number}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                  </span>
                )}
              </div>
              {resolvedId === opt.id && (
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 ml-2" />
              )}
            </button>
          ))}
        </div>
        {resolvedId && (
          <div className="p-2 border-t">
            <button
              type="button"
              onClick={() => {
                onCellChange(row.id, col.key, '');
                onResolveLookup?.(row.id, col.key, '');
                setOpenLookup(null);
              }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
              Clear selection
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default EditableImportTable;
