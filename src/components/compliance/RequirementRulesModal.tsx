// ============================================================================
// REQUIREMENT RULES MODAL - "MAD LIBS" STYLE CONFIGURATION
// ============================================================================
// Allows admins to configure which roles in which states need a compliance
// requirement using a sentence-style interface:
// "People with [ROLES] in [STATES] need [REQUIREMENT]"
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import {
  Users,
  MapPin,
  FileCheck,
  Check,
  ChevronsUpDown,
  X,
  Loader2,
  Building2,
  UserCheck,
  Briefcase,
  Info,
  Save,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import {
  getRequirementRoles,
  setRequirementRoles,
  getOrgRolesForPicker,
  getOrgStates,
  type ComplianceRequirement,
  type RequirementRole
} from '../../lib/crud/compliance';

// ============================================================================
// TYPES
// ============================================================================

interface RequirementRulesModalProps {
  requirement: ComplianceRequirement | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: () => void;
}

interface OrgRole {
  id: string;
  name: string;
  description?: string;
  is_frontline: boolean;
  is_manager: boolean;
}

// US States for the picker
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
  { code: 'DC', name: 'Washington D.C.' },
];

// ============================================================================
// MULTI-SELECT COMPONENTS
// ============================================================================

interface MultiSelectRolesProps {
  roles: OrgRole[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  loading?: boolean;
}

function MultiSelectRoles({ roles, selectedIds, onChange, loading }: MultiSelectRolesProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRoles = roles.filter(role =>
    role.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleRole = (roleId: string) => {
    if (selectedIds.includes(roleId)) {
      onChange(selectedIds.filter(id => id !== roleId));
    } else {
      onChange([...selectedIds, roleId]);
    }
  };

  const selectAll = () => onChange(roles.map(r => r.id));
  const selectNone = () => onChange([]);
  const selectManagers = () => onChange(roles.filter(r => r.is_manager).map(r => r.id));
  const selectFrontline = () => onChange(roles.filter(r => r.is_frontline).map(r => r.id));

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-auto min-h-10"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('compliance.loadingRoles')}
              </span>
            ) : selectedIds.length === 0 ? (
<span className="text-muted-foreground">{t('compliance.selectRoles')}</span>
            ) : (
              <div className="flex flex-wrap gap-1 py-1">
                {selectedIds.slice(0, 3).map(id => {
                  const role = roles.find(r => r.id === id);
                  return role ? (
                    <Badge key={id} variant="secondary" className="text-xs">
                      {role.name}
                    </Badge>
                  ) : null;
                })}
                {selectedIds.length > 3 && (
                  <Badge variant="secondary" className="text-xs">
                    +{selectedIds.length - 3} {t('compliance.more')}
                  </Badge>
                )}
              </div>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <Command>
            <CommandInput
placeholder={t('compliance.searchRoles')}
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <div className="flex gap-1 p-2 border-b">
              <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs h-7">
                {t('common.all')}
              </Button>
              <Button variant="ghost" size="sm" onClick={selectNone} className="text-xs h-7">
                {t('common.none')}
              </Button>
              <Button variant="ghost" size="sm" onClick={selectManagers} className="text-xs h-7">
                <Briefcase className="h-3 w-3 mr-1" />
                {t('compliance.managers')}
              </Button>
              <Button variant="ghost" size="sm" onClick={selectFrontline} className="text-xs h-7">
                <UserCheck className="h-3 w-3 mr-1" />
                {t('compliance.frontline')}
              </Button>
            </div>
            <CommandList>
<CommandEmpty>{t('compliance.noRolesFound')}</CommandEmpty>
              <CommandGroup>
                <ScrollArea className="h-64">
                  {filteredRoles.map((role) => (
                    <CommandItem
                      key={role.id}
                      onSelect={() => toggleRole(role.id)}
                      className="cursor-pointer"
                    >
                      <div className="flex items-center gap-2 w-full">
                        <Checkbox
                          checked={selectedIds.includes(role.id)}
                          className="pointer-events-none"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{role.name}</div>
                          {role.description && (
                            <div className="text-xs text-muted-foreground truncate">
                              {role.description}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {role.is_manager && (
                            <Badge variant="outline" className="text-xs px-1">Mgr</Badge>
                          )}
                          {role.is_frontline && (
                            <Badge variant="outline" className="text-xs px-1">FL</Badge>
                          )}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </ScrollArea>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected roles display */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedIds.map(id => {
            const role = roles.find(r => r.id === id);
            return role ? (
              <Badge
                key={id}
                variant="secondary"
                className="text-xs pr-1 cursor-pointer hover:bg-destructive/20"
                onClick={() => toggleRole(id)}
              >
                {role.name}
                <X className="h-3 w-3 ml-1" />
              </Badge>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}

interface MultiSelectStatesProps {
  selectedCodes: string[];
  onChange: (codes: string[]) => void;
  orgStates?: string[]; // States where org has locations
}

function MultiSelectStates({ selectedCodes, onChange, orgStates }: MultiSelectStatesProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredStates = US_STATES.filter(state =>
    state.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    state.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleState = (code: string) => {
    if (selectedCodes.includes(code)) {
      onChange(selectedCodes.filter(c => c !== code));
    } else {
      onChange([...selectedCodes, code]);
    }
  };

  const selectAll = () => onChange(US_STATES.map(s => s.code));
  const selectNone = () => onChange([]);
  const selectOrgStates = () => {
    if (orgStates && orgStates.length > 0) {
      onChange(orgStates);
    }
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-auto min-h-10"
          >
            {selectedCodes.length === 0 ? (
<span className="text-muted-foreground">{t('compliance.selectStates')}</span>
            ) : selectedCodes.length === US_STATES.length ? (
<span>{t('compliance.allStates')}</span>
            ) : (
              <div className="flex flex-wrap gap-1 py-1">
                {selectedCodes.slice(0, 5).map(code => (
                  <Badge key={code} variant="secondary" className="text-xs">
                    {code}
                  </Badge>
                ))}
                {selectedCodes.length > 5 && (
                  <Badge variant="secondary" className="text-xs">
                    +{selectedCodes.length - 5} {t('compliance.more')}
                  </Badge>
                )}
              </div>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <Command>
            <CommandInput
placeholder={t('compliance.searchStates')}
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <div className="flex gap-1 p-2 border-b">
              <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs h-7">
                {t('common.all')}
              </Button>
              <Button variant="ghost" size="sm" onClick={selectNone} className="text-xs h-7">
                {t('common.none')}
              </Button>
              {orgStates && orgStates.length > 0 && (
                <Button variant="ghost" size="sm" onClick={selectOrgStates} className="text-xs h-7">
                  <Building2 className="h-3 w-3 mr-1" />
                  {t('compliance.ourLocations', { count: orgStates.length })}
                </Button>
              )}
            </div>
            <CommandList>
<CommandEmpty>{t('compliance.noStatesFound')}</CommandEmpty>
              <CommandGroup>
                <ScrollArea className="h-64">
                  {filteredStates.map((state) => (
                    <CommandItem
                      key={state.code}
                      onSelect={() => toggleState(state.code)}
                      className="cursor-pointer"
                    >
                      <div className="flex items-center gap-2 w-full">
                        <Checkbox
                          checked={selectedCodes.includes(state.code)}
                          className="pointer-events-none"
                        />
                        <span className="font-mono text-xs w-6">{state.code}</span>
                        <span className="flex-1">{state.name}</span>
                        {orgStates?.includes(state.code) && (
                          <Building2 className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </ScrollArea>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected states display */}
      {selectedCodes.length > 0 && selectedCodes.length <= 10 && (
        <div className="flex flex-wrap gap-1">
          {selectedCodes.map(code => {
            const state = US_STATES.find(s => s.code === code);
            return (
              <Badge
                key={code}
                variant="secondary"
                className="text-xs pr-1 cursor-pointer hover:bg-destructive/20"
                onClick={() => toggleState(code)}
              >
                {state?.name || code}
                <X className="h-3 w-3 ml-1" />
              </Badge>
            );
          })}
        </div>
      )}
      {selectedCodes.length > 10 && (
        <p className="text-xs text-muted-foreground">
          {selectedCodes.length} states selected
        </p>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function RequirementRulesModal({
  requirement,
  open,
  onOpenChange,
  onSave
}: RequirementRulesModalProps) {
  const { t } = useTranslation();
  // Data state
  const [roles, setRoles] = useState<OrgRole[]>([]);
  const [orgStates, setOrgStates] = useState<string[]>([]);
  const [existingRoles, setExistingRoles] = useState<RequirementRole[]>([]);

  // Selection state
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Load data when modal opens
  useEffect(() => {
    async function loadData() {
      if (!open || !requirement) return;

      setLoading(true);
      setError(null);

      try {
        const [rolesData, statesData, existingData] = await Promise.all([
          getOrgRolesForPicker(),
          getOrgStates(),
          getRequirementRoles(requirement.id)
        ]);

        setRoles(rolesData);
        setOrgStates(statesData);
        setExistingRoles(existingData);

        // Set initial selections from existing data
        setSelectedRoleIds(existingData.map(r => r.role_id));
        setHasChanges(false);
      } catch (err) {
        console.error('Failed to load data:', err);
        setError(t('compliance.failedLoadRolesStates'));
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [open, requirement]);

  // Track changes (roles only — state is read-only on the requirement)
  useEffect(() => {
    if (!loading) {
      const existingIds = existingRoles.map(r => r.role_id).sort();
      const currentIds = [...selectedRoleIds].sort();
      setHasChanges(JSON.stringify(existingIds) !== JSON.stringify(currentIds));
    }
  }, [selectedRoleIds, existingRoles, loading]);

  // Handle save
  const handleSave = async () => {
    if (!requirement) return;

    setSaving(true);
    setError(null);

    try {
      // Save role assignments
      await setRequirementRoles(requirement.id, selectedRoleIds);

      // Note: State is stored on the requirement itself (state_code field)
      // If user changed states, we'd need to update the requirement record
      // For now, the modal shows the state context but changing states
      // would require creating new requirements for each state

      onSave?.();
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to save:', err);
      setError(t('compliance.failedSaveRoles'));
    } finally {
      setSaving(false);
    }
  };

  // Summary text
  const getSummaryText = () => {
    const roleCount = selectedRoleIds.length;

    if (roleCount === 0) {
      return 'No roles selected - this requirement will not trigger any assignments';
    }

    const roleText = roleCount === roles.length
      ? 'all roles'
      : roleCount === 1
        ? roles.find(r => r.id === selectedRoleIds[0])?.name || '1 role'
        : `${roleCount} roles`;

    const stateText = requirement?.state_code
      ? US_STATES.find(s => s.code === requirement.state_code)?.name || requirement.state_code
      : 'all states';

    return `People with ${roleText} in ${stateText} need ${requirement?.requirement_name}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
{t('compliance.configureReqRulesTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('compliance.configureReqRulesDesc')}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Mad Libs Sentence Display */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <p className="text-lg font-medium text-center">
                  {getSummaryText()}
                </p>
              </CardContent>
            </Card>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Requirement Info */}
            <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
              <FileCheck className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{requirement?.requirement_name}</p>
                <p className="text-sm text-muted-foreground">
                  {requirement?.topic?.name} • {requirement?.authority?.name}
                </p>
              </div>
            </div>

            <Separator />

            {/* Roles Selection */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
<Label className="text-base font-medium">{t('compliance.peopleWithRoles')}</Label>
              </div>
              <MultiSelectRoles
                roles={roles}
                selectedIds={selectedRoleIds}
                onChange={setSelectedRoleIds}
                loading={loading}
              />
              <p className="text-xs text-muted-foreground">
                {selectedRoleIds.length} of {roles.length} roles selected
              </p>
            </div>

            <Separator />

            {/* State Context (read-only) */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
<Label className="text-base font-medium">{t('compliance.inTheseStates')}</Label>
              </div>

              {requirement?.state_code ? (
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                  <Badge variant="secondary" className="text-sm">
                    {requirement.state_code}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    — {US_STATES.find(s => s.code === requirement.state_code)?.name || requirement.state_code}
                  </span>
                </div>
              ) : (
                <div className="p-3 bg-muted/50 rounded-lg">
<span className="text-sm text-muted-foreground">{t('compliance.allStatesNoRestriction')}</span>
                </div>
              )}

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  The state is set on the requirement itself. To apply this training in additional states, create a separate requirement for each state.
                </AlertDescription>
              </Alert>
            </div>

            <Separator />

            {/* Summary */}
            <div className="space-y-2">
<Label className="text-base font-medium">{t('compliance.summaryLabel')}</Label>
              <Card>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-sm">
                      {selectedRoleIds.length} role{selectedRoleIds.length !== 1 ? 's' : ''} will be required to complete this training
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-sm">
                      Applies to employees in {requirement?.state_code || 'all states'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-sm">
                      Must complete within {requirement?.days_to_complete || 30} days of trigger
                    </span>
                  </div>
                  {requirement?.recertification_years && (
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span className="text-sm">
                        Recertification required every {requirement.recertification_years} year{requirement.recertification_years !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || loading || !hasChanges}
            className="bg-brand-gradient text-white shadow-brand hover:opacity-90"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('common.saving')}
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {t('compliance.saveRules')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default RequirementRulesModal;
