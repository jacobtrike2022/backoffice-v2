import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Globe, Building2, Factory, MapPin, BookOpen, Briefcase, Store, X, ChevronDown, ChevronUp, Check } from 'lucide-react';
import type { ContentScope, ScopeAssignmentInput } from '../lib/crud/trackScope';
import {
  getSectors,
  getIndustries,
  getPrograms,
  getCompanies,
  getUnits,
  US_STATES,
  getTrackScopeAssignments,
  setTrackScope,
} from '../lib/crud/trackScope';

interface TrackScopeSelectorProps {
  trackId: string;
  currentScope: ContentScope;
  onScopeChange?: (scope: ContentScope, assignments: ScopeAssignmentInput[]) => void;
  readOnly?: boolean;
}

const SCOPE_OPTIONS: { value: ContentScope; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'universal', label: 'Universal', icon: <Globe className="h-4 w-4" />, description: 'Visible to all organizations' },
  { value: 'sector', label: 'Sector', icon: <Building2 className="h-4 w-4" />, description: 'Visible to organizations in selected sectors' },
  { value: 'industry', label: 'Industry', icon: <Factory className="h-4 w-4" />, description: 'Visible to organizations in selected industries' },
  { value: 'state', label: 'State', icon: <MapPin className="h-4 w-4" />, description: 'Visible to organizations operating in selected states' },
  { value: 'program', label: 'Program', icon: <BookOpen className="h-4 w-4" />, description: 'Visible to organizations enrolled in selected programs' },
  { value: 'company', label: 'Company', icon: <Briefcase className="h-4 w-4" />, description: 'Visible to selected organizations only' },
  { value: 'unit', label: 'Unit', icon: <Store className="h-4 w-4" />, description: 'Visible to selected stores/units only' },
];

interface EntityOption {
  id: string;
  name: string;
  parentName?: string;
}

export default function TrackScopeSelector({ trackId, currentScope, onScopeChange, readOnly = false }: TrackScopeSelectorProps) {
  const [scope, setScope] = useState<ContentScope>(currentScope);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [entityOptions, setEntityOptions] = useState<EntityOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [entityPickerOpen, setEntityPickerOpen] = useState(false);
  const [statePickerOpen, setStatePickerOpen] = useState(false);
  const [entitySearch, setEntitySearch] = useState('');
  const [stateSearch, setStateSearch] = useState('');

  const needsStateSelector = ['state', 'program', 'company', 'unit'].includes(scope);
  const needsEntitySelector = scope !== 'universal' && scope !== 'state';

  const loadExistingAssignments = useCallback(async () => {
    if (!trackId) return;
    setLoading(true);
    try {
      const assignments = await getTrackScopeAssignments(trackId);
      const stateAssigns = assignments.filter(a => a.scope_type === 'state').map(a => a.scope_ref_id);
      const entityAssigns = assignments.filter(a => a.scope_type !== 'state').map(a => a.scope_ref_id);
      setSelectedStates(stateAssigns);
      setSelectedIds(entityAssigns);
    } catch (err) {
      console.error('Failed to load scope assignments:', err);
    } finally {
      setLoading(false);
    }
  }, [trackId]);

  useEffect(() => {
    loadExistingAssignments();
  }, [loadExistingAssignments]);

  useEffect(() => {
    setScope(currentScope);
  }, [currentScope]);

  const loadEntityOptions = useCallback(async () => {
    let options: EntityOption[] = [];
    try {
      switch (scope) {
        case 'sector': {
          const sectors = await getSectors();
          options = sectors.map(s => ({ id: s.id, name: s.name }));
          break;
        }
        case 'industry': {
          const [industries, sectors] = await Promise.all([getIndustries(), getSectors()]);
          const sectorMap = new Map(sectors.map(s => [s.id, s.name]));
          options = industries.map(i => ({
            id: i.id,
            name: i.name,
            parentName: i.parent_id ? sectorMap.get(i.parent_id) : undefined,
          }));
          break;
        }
        case 'program': {
          const programs = await getPrograms();
          options = programs.map(p => ({ id: p.id, name: p.name }));
          break;
        }
        case 'company': {
          const companies = await getCompanies();
          options = companies.map(c => ({ id: c.id, name: c.name }));
          break;
        }
        case 'unit': {
          const units = await getUnits();
          options = units.map(u => ({ id: u.id, name: u.name || u.code || u.id }));
          break;
        }
      }
    } catch (err) {
      console.error('Failed to load entity options:', err);
    }
    setEntityOptions(options);
  }, [scope]);

  useEffect(() => {
    if (needsEntitySelector) {
      loadEntityOptions();
    } else {
      setEntityOptions([]);
    }
  }, [needsEntitySelector, loadEntityOptions]);

  const handleScopeChange = (newScope: ContentScope) => {
    setScope(newScope);
    setSelectedIds([]);
    setSelectedStates([]);
    setDirty(true);
  };

  const toggleEntity = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
    setDirty(true);
  };

  const toggleState = (code: string) => {
    setSelectedStates(prev =>
      prev.includes(code) ? prev.filter(x => x !== code) : [...prev, code]
    );
    setDirty(true);
  };

  const handleSave = async () => {
    if (readOnly) return;
    setSaving(true);
    try {
      const assignments: ScopeAssignmentInput[] = [];

      if (scope !== 'universal') {
        const entityScopeType = scope as Exclude<ContentScope, 'universal'>;
        if (scope !== 'state') {
          selectedIds.forEach(id => {
            assignments.push({ scope_type: entityScopeType, scope_ref_id: id });
          });
        }
        if (needsStateSelector) {
          selectedStates.forEach(code => {
            assignments.push({ scope_type: 'state', scope_ref_id: code });
          });
        }
      }

      await setTrackScope(trackId, scope, assignments);
      setDirty(false);
      onScopeChange?.(scope, assignments);
    } catch (err) {
      console.error('Failed to save scope:', err);
    } finally {
      setSaving(false);
    }
  };

  const currentScopeConfig = SCOPE_OPTIONS.find(o => o.value === scope);
  const filteredEntities = entitySearch
    ? entityOptions.filter(e => e.name.toLowerCase().includes(entitySearch.toLowerCase()))
    : entityOptions;
  const filteredStates = stateSearch
    ? US_STATES.filter(s => s.name.toLowerCase().includes(stateSearch.toLowerCase()) || s.code.toLowerCase().includes(stateSearch.toLowerCase()))
    : US_STATES;

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Content Scope</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {currentScopeConfig?.icon}
          Content Scope
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Scope Level Selector */}
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
            Applicability Level
          </label>
          <Select
            value={scope}
            onValueChange={(v) => handleScopeChange(v as ContentScope)}
            disabled={readOnly}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCOPE_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  <span className="flex items-center gap-2">
                    {opt.icon}
                    {opt.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {currentScopeConfig && (
            <p className="text-xs text-muted-foreground mt-1">{currentScopeConfig.description}</p>
          )}
        </div>

        {/* Entity Multi-Select (for non-universal, non-state-only scopes) */}
        {needsEntitySelector && (
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
              {scope === 'sector' ? 'Sectors' :
               scope === 'industry' ? 'Industries' :
               scope === 'program' ? 'Programs' :
               scope === 'company' ? 'Companies' : 'Units'}
            </label>

            {/* Selected badges */}
            {selectedIds.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {selectedIds.map(id => {
                  const entity = entityOptions.find(e => e.id === id);
                  return (
                    <Badge key={id} variant="secondary" className="gap-1 text-xs">
                      {entity?.name || id}
                      {!readOnly && (
                        <X className="h-3 w-3 cursor-pointer" onClick={() => toggleEntity(id)} />
                      )}
                    </Badge>
                  );
                })}
              </div>
            )}

            {/* Entity picker */}
            {!readOnly && (
              <div className="border rounded-md">
                <button
                  type="button"
                  className="flex items-center justify-between w-full px-3 py-2 text-sm text-left"
                  onClick={() => setEntityPickerOpen(!entityPickerOpen)}
                >
                  <span className="text-muted-foreground">
                    {selectedIds.length === 0 ? `Select ${scope}s...` : `${selectedIds.length} selected`}
                  </span>
                  {entityPickerOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {entityPickerOpen && (
                  <div className="border-t max-h-48 overflow-y-auto">
                    <div className="p-2">
                      <input
                        type="text"
                        className="w-full px-2 py-1 text-sm border rounded bg-background"
                        placeholder="Search..."
                        value={entitySearch}
                        onChange={e => setEntitySearch(e.target.value)}
                      />
                    </div>
                    {filteredEntities.map(entity => (
                      <button
                        key={entity.id}
                        type="button"
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-accent text-left"
                        onClick={() => toggleEntity(entity.id)}
                      >
                        <div className={`h-4 w-4 rounded border flex items-center justify-center ${selectedIds.includes(entity.id) ? 'bg-primary border-primary' : 'border-input'}`}>
                          {selectedIds.includes(entity.id) && <Check className="h-3 w-3 text-primary-foreground" />}
                        </div>
                        <span>{entity.name}</span>
                        {entity.parentName && (
                          <span className="text-xs text-muted-foreground">({entity.parentName})</span>
                        )}
                      </button>
                    ))}
                    {filteredEntities.length === 0 && (
                      <p className="px-3 py-2 text-sm text-muted-foreground">No results</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* State Multi-Select (shown for state-level and below) */}
        {needsStateSelector && (
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Applicable States
            </label>

            {/* Selected state badges */}
            {selectedStates.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {selectedStates.map(code => {
                  const state = US_STATES.find(s => s.code === code);
                  return (
                    <Badge key={code} variant="outline" className="gap-1 text-xs">
                      {state?.code || code}
                      {!readOnly && (
                        <X className="h-3 w-3 cursor-pointer" onClick={() => toggleState(code)} />
                      )}
                    </Badge>
                  );
                })}
              </div>
            )}

            {/* State picker */}
            {!readOnly && (
              <div className="border rounded-md">
                <button
                  type="button"
                  className="flex items-center justify-between w-full px-3 py-2 text-sm text-left"
                  onClick={() => setStatePickerOpen(!statePickerOpen)}
                >
                  <span className="text-muted-foreground">
                    {selectedStates.length === 0 ? 'Select states...' : `${selectedStates.length} state${selectedStates.length > 1 ? 's' : ''} selected`}
                  </span>
                  {statePickerOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {statePickerOpen && (
                  <div className="border-t max-h-48 overflow-y-auto">
                    <div className="p-2">
                      <input
                        type="text"
                        className="w-full px-2 py-1 text-sm border rounded bg-background"
                        placeholder="Search states..."
                        value={stateSearch}
                        onChange={e => setStateSearch(e.target.value)}
                      />
                    </div>
                    {filteredStates.map(state => (
                      <button
                        key={state.code}
                        type="button"
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-accent text-left"
                        onClick={() => toggleState(state.code)}
                      >
                        <div className={`h-4 w-4 rounded border flex items-center justify-center ${selectedStates.includes(state.code) ? 'bg-primary border-primary' : 'border-input'}`}>
                          {selectedStates.includes(state.code) && <Check className="h-3 w-3 text-primary-foreground" />}
                        </div>
                        <span>{state.code}</span>
                        <span className="text-muted-foreground">{state.name}</span>
                      </button>
                    ))}
                    {filteredStates.length === 0 && (
                      <p className="px-3 py-2 text-sm text-muted-foreground">No results</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Save button */}
        {!readOnly && dirty && (
          <Button
            onClick={handleSave}
            disabled={saving}
            size="sm"
            className="w-full"
          >
            {saving ? 'Saving...' : 'Save Scope'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
