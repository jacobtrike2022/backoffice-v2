import React, { useMemo, useState } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Label } from './ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Edit,
  Check,
  AlertTriangle,
  ArrowRight,
  Users,
} from 'lucide-react';
import { cn } from './ui/utils';
import { formatPhoneDisplay } from '../lib/importMapping';
import type {
  SyncClassificationResult,
  SyncRowClassification,
  FieldChange,
  MatchLevel,
} from '../lib/crud/users';

// ============================================================================
// Types
// ============================================================================

export type SyncTab = 'all' | 'new' | 'changes' | 'unchanged' | 'missing';
export type MissingAction = 'leave' | 'deactivate';

export interface SyncReviewDiffProps {
  classification: SyncClassificationResult;
  activeTab: SyncTab;
  onTabChange: (tab: SyncTab) => void;
  applyFilter: Record<number, { create?: boolean; update?: boolean }>;
  onToggleApply: (
    sourceRow: number,
    kind: 'create' | 'update',
    value: boolean,
  ) => void;
  missingAction: MissingAction;
  onMissingActionChange: (action: MissingAction) => void;
  // Typed confirmation for the "deactivate" action — bubbled up to parent so the
  // Apply button can gate on it. Without this, admins could click Apply without typing.
  deactivateConfirmText?: string;
  onDeactivateConfirmTextChange?: (value: string) => void;
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function matchLevelLabel(level: MatchLevel): string {
  switch (level) {
    case 'external_id':
      return 'HRIS ID';
    case 'email':
      return 'Email';
    case 'mobile_phone':
      return 'Mobile';
    case 'name_hire_date':
      return 'Name + Hire Date';
    case 'name_store':
      return 'Name + Store';
    default:
      return 'New';
  }
}

function fieldLabel(field: FieldChange['field']): string {
  const map: Record<FieldChange['field'], string> = {
    first_name: 'First Name',
    last_name: 'Last Name',
    email: 'Email',
    mobile_phone: 'Mobile Phone',
    phone: 'Phone',
    role_id: 'Role',
    store_id: 'Store',
    employee_id: 'Employee ID',
    hire_date: 'Hire Date',
    external_id: 'HRIS ID',
    external_id_source: 'HRIS Source',
  };
  return map[field] || field;
}

function formatFieldValue(
  field: FieldChange['field'],
  value: string | null,
): string {
  if (value === null || value === undefined || value === '') return 'empty';
  if (field === 'mobile_phone' || field === 'phone') {
    try {
      return formatPhoneDisplay(value) || value;
    } catch {
      return value;
    }
  }
  return value;
}

function getSourceRow(row: SyncRowClassification): number | undefined {
  if ('input' in row) {
    return row.input.source_row;
  }
  return undefined;
}

// ============================================================================
// Sub-components
// ============================================================================

interface TabDef {
  key: SyncTab;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  count: number;
  danger?: boolean;
}

const TabStrip: React.FC<{
  tabs: TabDef[];
  activeTab: SyncTab;
  onTabChange: (tab: SyncTab) => void;
}> = ({ tabs, activeTab, onTabChange }) => {
  return (
    <div className="border-b bg-muted/30 px-4 py-2 flex items-center gap-2 sticky top-0 z-10">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.key;
        return (
          <Button
            key={tab.key}
            size="sm"
            variant={isActive ? 'default' : 'ghost'}
            onClick={() => onTabChange(tab.key)}
            className={cn(
              tab.count === 0 && 'opacity-50',
              tab.danger && !isActive && 'text-amber-700 hover:text-amber-800',
            )}
          >
            {Icon && <Icon className="h-3 w-3 mr-1.5" />}
            {tab.label}{' '}
            <span className="ml-1.5 text-xs opacity-70">({tab.count})</span>
          </Button>
        );
      })}
    </div>
  );
};

// ----------------------------------------------------------------------------
// New tab
// ----------------------------------------------------------------------------

const NewTab: React.FC<{
  rows: Extract<SyncRowClassification, { kind: 'new' }>[];
  applyFilter: SyncReviewDiffProps['applyFilter'];
  onToggleApply: SyncReviewDiffProps['onToggleApply'];
}> = ({ rows, applyFilter, onToggleApply }) => {
  if (rows.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        No new employees to create.
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-3 text-xs text-muted-foreground">
        {rows.length} employee{rows.length !== 1 ? 's' : ''} will be added.
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>First Name</TableHead>
              <TableHead>Last Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>HRIS ID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, idx) => {
              const sourceRow = row.input.source_row ?? idx;
              const approved =
                applyFilter[sourceRow]?.create !== false; // default true
              return (
                <TableRow key={sourceRow}>
                  <TableCell>
                    <Checkbox
                      checked={approved}
                      onCheckedChange={(v) =>
                        onToggleApply(sourceRow, 'create', v === true)
                      }
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {row.input.first_name}
                  </TableCell>
                  <TableCell className="font-medium">
                    {row.input.last_name}
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.input.email || (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.input.mobile_phone ? (
                      formatPhoneDisplay(row.input.mobile_phone)
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.input.external_id || (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------------
// Changes tab
// ----------------------------------------------------------------------------

const ChangesTab: React.FC<{
  rows: Array<
    Extract<SyncRowClassification, { kind: 'update' | 'reactivate' }>
  >;
  applyFilter: SyncReviewDiffProps['applyFilter'];
  onToggleApply: SyncReviewDiffProps['onToggleApply'];
}> = ({ rows, applyFilter, onToggleApply }) => {
  if (rows.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        No field changes detected.
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-3 text-xs text-muted-foreground">
        {rows.length} employee{rows.length !== 1 ? 's' : ''} will be updated.
      </div>
      {rows.map((row, idx) => {
        const sourceRow = row.input.source_row ?? idx;
        const approved = applyFilter[sourceRow]?.update !== false; // default true
        return (
          <div
            key={`${sourceRow}-${row.existing_user_id}`}
            className="border rounded-lg p-3 mb-2"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">
                  {row.input.first_name} {row.input.last_name}
                </span>
                <Badge variant="outline" className="text-[10px]">
                  Matched by {matchLevelLabel(row.matched_by)}
                </Badge>
                {row.kind === 'reactivate' && (
                  <Badge className="text-[10px] bg-blue-100 text-blue-700 hover:bg-blue-100">
                    Reactivating
                  </Badge>
                )}
              </div>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                <Checkbox
                  checked={approved}
                  onCheckedChange={(v) =>
                    onToggleApply(sourceRow, 'update', v === true)
                  }
                />
                Apply
              </label>
            </div>
            <div className="space-y-1 text-xs ml-4">
              {row.field_changes.map((fc) => {
                const oldVal = formatFieldValue(fc.field, fc.old);
                const newVal = formatFieldValue(fc.field, fc.new);
                return (
                  <div
                    key={fc.field}
                    className="flex items-center gap-2 flex-wrap"
                  >
                    <span className="text-muted-foreground w-28 shrink-0">
                      {fieldLabel(fc.field)}:
                    </span>
                    <span
                      className={cn(
                        'line-through',
                        fc.old ? 'text-red-600' : 'text-muted-foreground italic',
                      )}
                    >
                      {oldVal}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span
                      className={cn(
                        'font-medium',
                        fc.new ? 'text-green-700' : 'text-muted-foreground italic',
                      )}
                    >
                      {newVal}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ----------------------------------------------------------------------------
// Unchanged tab
// ----------------------------------------------------------------------------

const UnchangedTab: React.FC<{
  rows: Extract<SyncRowClassification, { kind: 'unchanged' }>[];
}> = ({ rows }) => {
  const [expanded, setExpanded] = useState(false);

  if (rows.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        No unchanged employees.
      </div>
    );
  }

  return (
    <div className="p-4">
      <div
        className="border rounded-lg p-3 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <Check className="h-4 w-4 text-green-600" />
          <span className="font-medium">
            {rows.length} employee{rows.length !== 1 ? 's are' : ' is'} already
            in sync.
          </span>
          <span className="text-xs text-muted-foreground ml-auto">
            Click to {expanded ? 'collapse' : 'expand'}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="border rounded-lg overflow-hidden mt-3">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Matched By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, idx) => (
                <TableRow key={`${row.existing_user_id}-${idx}`}>
                  <TableCell className="font-medium">
                    {row.input.first_name} {row.input.last_name}
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.input.email || (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {matchLevelLabel(row.matched_by)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

// ----------------------------------------------------------------------------
// Missing tab
// ----------------------------------------------------------------------------

const MissingTab: React.FC<{
  missingUsers: SyncClassificationResult['missing_users'];
  missingAction: MissingAction;
  onMissingActionChange: (action: MissingAction) => void;
  confirmText: string;
  onConfirmTextChange: (value: string) => void;
}> = ({ missingUsers, missingAction, onMissingActionChange, confirmText, onConfirmTextChange }) => {

  if (missingUsers.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        <Check className="h-6 w-6 mx-auto mb-2 text-green-600" />
        Every active employee is present in this report.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>
            {missingUsers.length} employee
            {missingUsers.length !== 1 ? 's are' : ' is'} in your system but not
            in this report.
          </strong>
          <p className="text-xs mt-1 text-muted-foreground">
            A partial report (e.g., one department or store) shouldn't affect
            employees outside it. Choose carefully:
          </p>
        </AlertDescription>
      </Alert>

      <RadioGroup
        value={missingAction}
        onValueChange={(v) => onMissingActionChange(v as MissingAction)}
        className="space-y-2"
      >
        <div className="flex items-start gap-2 border rounded-lg p-3">
          <RadioGroupItem value="leave" id="missing-leave" className="mt-0.5" />
          <Label
            htmlFor="missing-leave"
            className="flex-1 cursor-pointer font-normal"
          >
            <div className="font-medium">Leave as-is</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Recommended — the report may be partial. No changes will be made
              to missing users.
            </div>
          </Label>
        </div>
        <div className="flex items-start gap-2 border rounded-lg p-3">
          <RadioGroupItem
            value="deactivate"
            id="missing-deactivate"
            className="mt-0.5"
          />
          <Label
            htmlFor="missing-deactivate"
            className="flex-1 cursor-pointer font-normal"
          >
            <div className="font-medium">Mark as inactive</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Only if this is a complete census of all current employees.
            </div>
          </Label>
        </div>
      </RadioGroup>

      {missingAction === 'deactivate' && (
        <Alert className="border-amber-300 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-900">
            <strong>
              This will deactivate {missingUsers.length} employee
              {missingUsers.length !== 1 ? 's' : ''}.
            </strong>
            <p className="text-xs mt-1 mb-2">
              Type <span className="font-mono font-bold">deactivate</span>{' '}
              below to confirm:
            </p>
            <Input
              value={confirmText}
              onChange={(e) => onConfirmTextChange(e.target.value)}
              placeholder="deactivate"
              className="max-w-xs bg-white"
            />
          </AlertDescription>
        </Alert>
      )}

      <div>
        <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
          <Users className="h-3 w-3" />
          Missing users ({missingUsers.length})
        </div>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>HRIS ID</TableHead>
                <TableHead>Last Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {missingUsers.map((u) => (
                <TableRow key={u.user_id}>
                  <TableCell className="font-medium">
                    {u.first_name} {u.last_name}
                  </TableCell>
                  <TableCell className="text-xs">
                    {u.email || (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs font-mono">
                    {u.external_id || (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {u.last_active_at ? (
                      new Date(u.last_active_at).toLocaleDateString()
                    ) : (
                      <span className="text-muted-foreground">Never</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------------
// All tab (summary view)
// ----------------------------------------------------------------------------

const AllTab: React.FC<{
  classification: SyncClassificationResult;
  onTabChange: (tab: SyncTab) => void;
}> = ({ classification, onTabChange }) => {
  const { stats } = classification;

  const cards: Array<{
    key: SyncTab;
    label: string;
    count: number;
    icon: React.ComponentType<{ className?: string }>;
    description: string;
    accent: string;
  }> = [
    {
      key: 'new',
      label: 'New',
      count: stats.new,
      icon: Plus,
      description: 'Will be added to your system',
      accent: 'text-green-700 bg-green-50 border-green-200',
    },
    {
      key: 'changes',
      label: 'Changes',
      count: stats.update + stats.reactivate,
      icon: Edit,
      description: 'Field-level updates to existing employees',
      accent: 'text-blue-700 bg-blue-50 border-blue-200',
    },
    {
      key: 'unchanged',
      label: 'Unchanged',
      count: stats.unchanged,
      icon: Check,
      description: 'Already in sync — no action needed',
      accent: 'text-muted-foreground bg-muted/50 border-muted',
    },
    {
      key: 'missing',
      label: 'Missing',
      count: stats.missing,
      icon: AlertTriangle,
      description: 'In your system but not in this report',
      accent:
        stats.missing > 0
          ? 'text-amber-700 bg-amber-50 border-amber-200'
          : 'text-muted-foreground bg-muted/50 border-muted',
    },
  ];

  return (
    <div className="p-4">
      <div className="mb-4 text-sm">
        <span className="font-medium">{stats.total}</span> rows classified
        {(stats.ambiguous > 0 || stats.duplicate_in_file > 0) && (
          <span className="ml-2 text-xs text-muted-foreground">
            ({stats.ambiguous} ambiguous, {stats.duplicate_in_file} duplicates
            in file)
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.key}
              onClick={() => onTabChange(c.key)}
              className={cn(
                'border rounded-lg p-4 text-left hover:shadow-sm transition-shadow',
                c.accent,
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className="h-4 w-4" />
                <span className="font-medium">{c.label}</span>
                <span className="ml-auto text-2xl font-semibold tabular-nums">
                  {c.count}
                </span>
              </div>
              <div className="text-xs opacity-80">{c.description}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// Main component
// ============================================================================

export const SyncReviewDiff: React.FC<SyncReviewDiffProps> = ({
  classification,
  activeTab,
  onTabChange,
  applyFilter,
  onToggleApply,
  missingAction,
  onMissingActionChange,
  deactivateConfirmText = '',
  onDeactivateConfirmTextChange = () => {},
  className,
}) => {
  const { classifications, stats, missing_users } = classification;

  const newRows = useMemo(
    () =>
      classifications.filter(
        (r): r is Extract<SyncRowClassification, { kind: 'new' }> =>
          r.kind === 'new',
      ),
    [classifications],
  );

  const changeRows = useMemo(
    () =>
      classifications.filter(
        (
          r,
        ): r is Extract<
          SyncRowClassification,
          { kind: 'update' | 'reactivate' }
        > => r.kind === 'update' || r.kind === 'reactivate',
      ),
    [classifications],
  );

  const unchangedRows = useMemo(
    () =>
      classifications.filter(
        (r): r is Extract<SyncRowClassification, { kind: 'unchanged' }> =>
          r.kind === 'unchanged',
      ),
    [classifications],
  );

  const tabs: TabDef[] = [
    { key: 'all', label: 'All', count: stats.total },
    { key: 'new', label: 'New', icon: Plus, count: stats.new },
    {
      key: 'changes',
      label: 'Changes',
      icon: Edit,
      count: stats.update + stats.reactivate,
    },
    {
      key: 'unchanged',
      label: 'Unchanged',
      icon: Check,
      count: stats.unchanged,
    },
    {
      key: 'missing',
      label: 'Missing',
      icon: AlertTriangle,
      count: stats.missing,
      danger: stats.missing > 0,
    },
  ];

  return (
    <div className={cn('flex flex-col h-full overflow-hidden', className)}>
      <TabStrip tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} />
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'all' && (
          <AllTab
            classification={classification}
            onTabChange={onTabChange}
          />
        )}
        {activeTab === 'new' && (
          <NewTab
            rows={newRows}
            applyFilter={applyFilter}
            onToggleApply={onToggleApply}
          />
        )}
        {activeTab === 'changes' && (
          <ChangesTab
            rows={changeRows}
            applyFilter={applyFilter}
            onToggleApply={onToggleApply}
          />
        )}
        {activeTab === 'unchanged' && <UnchangedTab rows={unchangedRows} />}
        {activeTab === 'missing' && (
          <MissingTab
            missingUsers={missing_users}
            missingAction={missingAction}
            onMissingActionChange={onMissingActionChange}
            confirmText={deactivateConfirmText}
            onConfirmTextChange={onDeactivateConfirmTextChange}
          />
        )}
      </div>
    </div>
  );
};

export default SyncReviewDiff;
