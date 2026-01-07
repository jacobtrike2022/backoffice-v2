import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  GitBranch,
  X,
  Loader2,
  ChevronRight,
  ChevronLeft,
  MapPin,
  Building2,
  Store,
  Check,
  Zap,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { getSupabaseClient } from '../../utils/supabase/client';
import * as trackRelCrud from '../../lib/crud/trackRelationships';
import * as storesCrud from '../../lib/crud/stores';
import * as crud from '../../lib/crud';
import { VariantGenerationChat } from './VariantGenerationChat';
import { StateVariantWizard } from '../state-variant/StateVariantWizard';

interface CreateVariantModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceTrack?: {
    id: string;
    title: string;
    type: string;
    thumbnail_url?: string;
  };
  onVariantCreated: (newTrackId: string) => void;
}

interface TrackOption {
  id: string;
  title: string;
  type: string;
  thumbnail_url?: string;
  status: string;
}

type VariantType = 'geographic' | 'company' | 'unit';
type Step = 'select-track' | 'select-type' | 'configure-context' | 'generation-method' | 'creating';

// US States data
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

const variantTypeConfig: Record<VariantType, { icon: React.ElementType; label: string; description: string; color: string }> = {
  geographic: {
    icon: MapPin,
    label: 'Geographic',
    description: 'Adapt for state/regional regulations',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
  },
  company: {
    icon: Building2,
    label: 'Company',
    description: 'Customize for your organization',
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
  },
  unit: {
    icon: Store,
    label: 'Unit',
    description: 'Customize for specific store/location',
    color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
  }
};

export function CreateVariantModal({
  isOpen,
  onClose,
  sourceTrack: initialSourceTrack,
  onVariantCreated
}: CreateVariantModalProps) {
  const supabase = getSupabaseClient();

  // State
  const [step, setStep] = useState<Step>(initialSourceTrack ? 'select-type' : 'select-track');
  const [tracks, setTracks] = useState<TrackOption[]>([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<TrackOption | null>(initialSourceTrack || null);
  const [selectedVariantType, setSelectedVariantType] = useState<VariantType | null>(null);

  // Context state
  const [selectedState, setSelectedState] = useState<string>('');
  const [stores, setStores] = useState<any[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [isLoadingStores, setIsLoadingStores] = useState(false);
  const [organizationName, setOrganizationName] = useState<string>('');

  // Generated title
  const [variantTitle, setVariantTitle] = useState<string>('');

  // Generation method (Sprint 1 = manual only)
  const [generationMethod, setGenerationMethod] = useState<'manual' | 'ai'>('manual');

  // Creating state
  const [isCreating, setIsCreating] = useState(false);

  // Full source track with content
  const [fullSourceTrack, setFullSourceTrack] = useState<any>(null);

  // State Variant Wizard (v2 AI pipeline for geographic variants)
  const [showStateVariantWizard, setShowStateVariantWizard] = useState(false);

  // Fetch full source track content when selected track changes
  useEffect(() => {
    if (selectedTrack?.id) {
      crud.getTrackById(selectedTrack.id).then(setFullSourceTrack);
    } else {
      setFullSourceTrack(null);
    }
  }, [selectedTrack?.id]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep(initialSourceTrack ? 'select-type' : 'select-track');
      setSelectedTrack(initialSourceTrack || null);
      setSelectedVariantType(null);
      setSelectedState('');
      setSelectedStore('');
      setVariantTitle('');
      setGenerationMethod('manual');
      setIsCreating(false);
      setShowStateVariantWizard(false);

      if (!initialSourceTrack) {
        loadTracks();
      }
      loadOrganization();
    }
  }, [isOpen, initialSourceTrack]);

  // Load stores when unit variant is selected
  useEffect(() => {
    if (selectedVariantType === 'unit') {
      loadStores();
    }
  }, [selectedVariantType]);

  // Auto-generate title based on context
  useEffect(() => {
    if (selectedTrack && selectedVariantType) {
      let suffix = '';
      switch (selectedVariantType) {
        case 'geographic':
          if (selectedState) {
            const state = US_STATES.find(s => s.code === selectedState);
            suffix = ` (${state?.name || selectedState})`;
          }
          break;
        case 'company':
          suffix = organizationName ? ` (${organizationName})` : ' (Company)';
          break;
        case 'unit':
          if (selectedStore) {
            const store = stores.find(s => s.id === selectedStore);
            suffix = ` (${store?.name || 'Store'})`;
          }
          break;
      }
      setVariantTitle(`${selectedTrack.title}${suffix}`);
    }
  }, [selectedTrack, selectedVariantType, selectedState, selectedStore, organizationName, stores]);

  async function loadTracks() {
    setIsLoadingTracks(true);
    try {
      const { data, error } = await supabase
        .from('tracks')
        .select('id, title, type, thumbnail_url, status')
        .in('status', ['published', 'draft'])
        .or('is_latest_version.eq.true,version_number.is.null')
        .order('title');

      if (error) throw error;
      setTracks(data || []);
    } catch (error: any) {
      console.error('Error loading tracks:', error);
      toast.error('Failed to load tracks');
    } finally {
      setIsLoadingTracks(false);
    }
  }

  async function loadStores() {
    setIsLoadingStores(true);
    try {
      const storesData = await storesCrud.getStores();
      setStores(storesData || []);
    } catch (error: any) {
      console.error('Error loading stores:', error);
      toast.error('Failed to load stores');
    } finally {
      setIsLoadingStores(false);
    }
  }

  async function loadOrganization() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('organization_id, organizations(name)')
          .eq('id', user.id)
          .single();

        if (profile?.organizations) {
          setOrganizationName((profile.organizations as any).name || '');
        }
      }
    } catch (error) {
      console.error('Error loading organization:', error);
    }
  }

  async function handleAIGenerated(generatedContent: string, generatedTitle: string) {
    if (!selectedTrack || !selectedVariantType) return;

    setIsCreating(true);
    setStep('creating');

    try {
      const variantContext = buildVariantContext();

      // 1. Fetch the source track's full data (we already have it in fullSourceTrack)
      const sourceTrackData = fullSourceTrack || await crud.getTrackById(selectedTrack.id);

      if (!sourceTrackData) {
        throw new Error('Failed to fetch source track data');
      }

      // 2. Create the new track as a draft with AI content
      const newTrackData = {
        title: generatedTitle,
        description: sourceTrackData.description,
        transcript: sourceTrackData.type === 'video' ? sourceTrackData.transcript : null,
        content_text: sourceTrackData.type !== 'video' ? generatedContent : null,
        type: sourceTrackData.type,
        status: 'draft',
        thumbnail_url: sourceTrackData.thumbnail_url,
        duration_minutes: sourceTrackData.duration_minutes,
        video_url: sourceTrackData.video_url,
        organization_id: sourceTrackData.organization_id,
        template_id: sourceTrackData.template_id,
        is_system_content: false,
        is_latest_version: true,
        version_number: 1,
        view_count: 0,
      };

      // If it's a video, we might want to update the transcript instead of content_text
      if (sourceTrackData.type === 'video') {
        newTrackData.transcript = generatedContent;
      }

      const { data: newTrack, error: createError } = await supabase
        .from('tracks')
        .insert(newTrackData)
        .select()
        .single();

      if (createError || !newTrack) {
        throw new Error('Failed to create variant track');
      }

      // 3. Create relationships
      await trackRelCrud.createVariantRelationship(
        selectedTrack.id,
        newTrack.id,
        selectedVariantType,
        variantContext
      );

      await trackRelCrud.createTrackRelationship(
        selectedTrack.id,
        newTrack.id,
        'source'
      );

      // 4. Copy tags
      const { data: sourceTags } = await supabase
        .from('track_tags')
        .select('tag_id')
        .eq('track_id', selectedTrack.id);

      if (sourceTags && sourceTags.length > 0) {
        const newTags = sourceTags.map(t => ({
          track_id: newTrack.id,
          tag_id: t.tag_id
        }));
        await supabase.from('track_tags').insert(newTags);
      }

      toast.success('AI-Generated variant created successfully!');
      onVariantCreated(newTrack.id);
    } catch (error: any) {
      console.error('Error creating AI variant:', error);
      toast.error(error.message || 'Failed to create variant');
      setStep('generation-method');
    } finally {
      setIsCreating(false);
    }
  }

  function buildVariantContext(): trackRelCrud.VariantContext {
    const variantContext: trackRelCrud.VariantContext = {};

    switch (selectedVariantType) {
      case 'geographic':
        const state = US_STATES.find(s => s.code === selectedState);
        variantContext.state_code = selectedState;
        variantContext.state_name = state?.name;
        break;
      case 'company':
        variantContext.org_name = organizationName;
        break;
      case 'unit':
        const store = stores.find(s => s.id === selectedStore);
        variantContext.store_id = selectedStore;
        variantContext.store_name = store?.name;
        break;
    }
    return variantContext;
  }

  async function handleCreateVariant() {
    if (!selectedTrack || !selectedVariantType) {
      toast.error('Please complete all required steps');
      return;
    }

    setIsCreating(true);
    setStep('creating');

    try {
      // Build variant context
      const variantContext: trackRelCrud.VariantContext = {};

      switch (selectedVariantType) {
        case 'geographic':
          const state = US_STATES.find(s => s.code === selectedState);
          variantContext.state_code = selectedState;
          variantContext.state_name = state?.name;
          break;
        case 'company':
          variantContext.org_name = organizationName;
          break;
        case 'unit':
          const store = stores.find(s => s.id === selectedStore);
          variantContext.store_id = selectedStore;
          variantContext.store_name = store?.name;
          break;
      }

      // 1. Fetch the source track's full data
      const { data: sourceTrackData, error: sourceError } = await supabase
        .from('tracks')
        .select('*')
        .eq('id', selectedTrack.id)
        .single();

      if (sourceError || !sourceTrackData) {
        throw new Error('Failed to fetch source track data');
      }

      // 2. Create the new track as a draft copy
      const newTrackData = {
        title: variantTitle,
        description: sourceTrackData.description,
        transcript: sourceTrackData.transcript,
        type: sourceTrackData.type,
        status: 'draft',
        thumbnail_url: sourceTrackData.thumbnail_url,
        duration_minutes: sourceTrackData.duration_minutes,
        video_url: sourceTrackData.video_url,
        organization_id: sourceTrackData.organization_id,
        template_id: sourceTrackData.template_id,
        is_system_content: false,
        is_latest_version: true,
        version_number: 1,
        view_count: 0,
      };

      const { data: newTrack, error: createError } = await supabase
        .from('tracks')
        .insert(newTrackData)
        .select()
        .single();

      if (createError || !newTrack) {
        throw new Error('Failed to create variant track');
      }

      // 3. Create the variant relationship
      await trackRelCrud.createVariantRelationship(
        selectedTrack.id,
        newTrack.id,
        selectedVariantType,
        variantContext
      );

      // 4. Also create a source relationship (so it shows up in "Sourced From")
      await trackRelCrud.createTrackRelationship(
        selectedTrack.id,
        newTrack.id,
        'source'
      );

      // 5. Copy tags if any
      const { data: sourceTags } = await supabase
        .from('track_tags')
        .select('tag_id')
        .eq('track_id', selectedTrack.id);

      if (sourceTags && sourceTags.length > 0) {
        const newTags = sourceTags.map(t => ({
          track_id: newTrack.id,
          tag_id: t.tag_id
        }));
        await supabase.from('track_tags').insert(newTags);
      }

      toast.success('Variant created successfully!');
      onVariantCreated(newTrack.id);
    } catch (error: any) {
      console.error('Error creating variant:', error);
      toast.error(error.message || 'Failed to create variant');
      setStep('generation-method');
    } finally {
      setIsCreating(false);
    }
  }

  function canProceedToNextStep(): boolean {
    switch (step) {
      case 'select-track':
        return !!selectedTrack;
      case 'select-type':
        return !!selectedVariantType;
      case 'configure-context':
        switch (selectedVariantType) {
          case 'geographic':
            return !!selectedState;
          case 'company':
            return true; // Company variant uses current org
          case 'unit':
            return !!selectedStore;
          default:
            return false;
        }
      case 'generation-method':
        return true;
      default:
        return false;
    }
  }

  function goToNextStep() {
    switch (step) {
      case 'select-track':
        setStep('select-type');
        break;
      case 'select-type':
        setStep('configure-context');
        break;
      case 'configure-context':
        setStep('generation-method');
        break;
      case 'generation-method':
        handleCreateVariant();
        break;
    }
  }

  function goToPreviousStep() {
    switch (step) {
      case 'select-type':
        if (!initialSourceTrack) {
          setStep('select-track');
        }
        break;
      case 'configure-context':
        setStep('select-type');
        break;
      case 'generation-method':
        setStep('configure-context');
        break;
    }
  }

  function getStepNumber(): number {
    const steps: Step[] = initialSourceTrack
      ? ['select-type', 'configure-context', 'generation-method']
      : ['select-track', 'select-type', 'configure-context', 'generation-method'];
    return steps.indexOf(step) + 1;
  }

  function getTotalSteps(): number {
    return initialSourceTrack ? 3 : 4;
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      style={{ marginBottom: 0 }}
    >
      <div className={`bg-background border border-border rounded-lg shadow-xl w-full mx-4 flex flex-col transition-all duration-300 overflow-hidden ${
        generationMethod === 'ai' && step === 'generation-method' 
          ? 'max-w-4xl h-[85vh] max-h-[90vh]' 
          : 'max-w-lg max-h-[90vh]'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
              <GitBranch className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Create Variant</h2>
              <p className="text-sm text-muted-foreground">
                Step {getStepNumber()} of {getTotalSteps()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            disabled={isCreating}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 pt-4 flex-shrink-0">
          <div className="flex gap-2">
            {Array.from({ length: getTotalSteps() }).map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i < getStepNumber() ? 'bg-orange-500' : 'bg-muted'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 flex-1 overflow-y-auto">
          {/* Step 1: Select Track (if no source track provided) */}
          {step === 'select-track' && (
            <div>
              <Label className="text-sm font-medium mb-2 block">
                Select Source Track
              </Label>
              {isLoadingTracks ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : tracks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <p>No tracks available.</p>
                </div>
              ) : (
                <div className="border border-border rounded-lg max-h-64 overflow-y-auto">
                  {tracks.map(track => (
                    <button
                      key={track.id}
                      type="button"
                      onClick={() => setSelectedTrack(track)}
                      className={`w-full px-3 py-2.5 text-left border-b border-border last:border-b-0 transition-colors ${
                        selectedTrack?.id === track.id
                          ? 'bg-orange-500/10 border-l-2 border-l-orange-500'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {track.thumbnail_url && (
                          <img
                            src={track.thumbnail_url}
                            alt=""
                            className="w-10 h-10 rounded object-cover"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground text-sm truncate">
                            {track.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className="bg-brand-gradient text-white text-xs px-2 py-0.5">
                              {track.type}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {track.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Select Variant Type */}
          {step === 'select-type' && (
            <div>
              <Label className="text-sm font-medium mb-3 block">
                Select Variant Type
              </Label>
              <div className="flex flex-col gap-3">
                {(Object.keys(variantTypeConfig) as VariantType[]).map(type => {
                  const config = variantTypeConfig[type];
                  const Icon = config.icon;
                  const isSelected = selectedVariantType === type;

                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setSelectedVariantType(type)}
                      className={`p-4 border rounded-lg text-left transition-all flex items-center gap-4 ${
                        isSelected
                          ? 'border-orange-500 bg-orange-500/10 ring-2 ring-orange-500/20'
                          : 'border-border hover:border-orange-300 hover:bg-muted'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-lg ${config.color} flex items-center justify-center flex-shrink-0`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-foreground">{config.label}</h3>
                        <p className="text-sm text-muted-foreground mt-0.5">{config.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 3: Configure Context */}
          {step === 'configure-context' && selectedVariantType && (
            <div className="space-y-4">
              <Label className="text-sm font-medium block">
                Configure {variantTypeConfig[selectedVariantType].label} Variant
              </Label>

              {selectedVariantType === 'geographic' && (
                <div>
                  <Label htmlFor="state-select" className="text-sm mb-2 block">
                    Select State
                  </Label>
                  <Select value={selectedState} onValueChange={setSelectedState}>
                    <SelectTrigger id="state-select">
                      <SelectValue placeholder="Select a state..." />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map(state => (
                        <SelectItem key={state.code} value={state.code}>
                          {state.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedVariantType === 'company' && (
                <div className="bg-muted/50 border border-border rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{organizationName || 'Your Organization'}</p>
                      <p className="text-xs text-muted-foreground">Company variant will be customized for your organization</p>
                    </div>
                  </div>
                </div>
              )}

              {selectedVariantType === 'unit' && (
                <div>
                  <Label htmlFor="store-select" className="text-sm mb-2 block">
                    Select Store/Location
                  </Label>
                  {isLoadingStores ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : stores.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      <p>No stores available.</p>
                    </div>
                  ) : (
                    <Select value={selectedStore} onValueChange={setSelectedStore}>
                      <SelectTrigger id="store-select">
                        <SelectValue placeholder="Select a store..." />
                      </SelectTrigger>
                      <SelectContent>
                        {stores.map(store => (
                          <SelectItem key={store.id} value={store.id}>
                            {store.name} {store.code ? `(${store.code})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {/* Variant Title */}
              <div className="pt-2">
                <Label htmlFor="variant-title" className="text-sm mb-2 block">
                  Variant Title
                </Label>
                <Input
                  id="variant-title"
                  value={variantTitle}
                  onChange={(e) => setVariantTitle(e.target.value)}
                  placeholder="Enter variant title..."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Auto-generated based on your selection. You can customize it.
                </p>
              </div>
            </div>
          )}

          {/* Step 4: Generation Method */}
          {step === 'generation-method' && (
            <div className={`space-y-4 flex flex-col ${generationMethod === 'ai' ? 'h-full' : ''}`}>
              <div className="flex-shrink-0">
                <Label className="text-sm font-medium block mb-3">
                  Generation Method
                </Label>

                {/* For geographic variants, show the new State Research option */}
                {selectedVariantType === 'geographic' && (
                  <button
                    type="button"
                    onClick={() => setShowStateVariantWizard(true)}
                    className="w-full mb-4 p-4 border-2 border-dashed border-primary/50 rounded-lg text-left transition-all hover:border-primary hover:bg-primary/5 group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/25 group-hover:shadow-orange-500/40 transition-shadow">
                        <Sparkles className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-foreground flex items-center gap-2">
                          State Research & Redline
                          <Badge className="bg-primary/10 text-primary text-[10px] border-0">Recommended</Badge>
                        </p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          AI researches state regulations and generates a redline draft with citations
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </button>
                )}

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <button
                    type="button"
                    onClick={() => setGenerationMethod('ai')}
                    className={`p-3 border rounded-lg text-left transition-all ${
                      generationMethod === 'ai'
                        ? 'border-orange-500 bg-orange-500/10 ring-2 ring-orange-500/20'
                        : 'border-border hover:border-orange-300 hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        generationMethod === 'ai' ? 'border-orange-500 bg-orange-500' : 'border-muted'
                      }`}>
                        {generationMethod === 'ai' && <Check className="w-2 h-2 text-white" />}
                      </div>
                      <div>
                        <p className="font-medium text-sm text-foreground flex items-center gap-1">
                          AI Chat
                          <Zap className="w-3 h-3 text-orange-500" />
                        </p>
                        <p className="text-[10px] text-muted-foreground">Interactive adaptation</p>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGenerationMethod('manual')}
                    className={`p-3 border rounded-lg text-left transition-all ${
                      generationMethod === 'manual'
                        ? 'border-orange-500 bg-orange-500/10 ring-2 ring-orange-500/20'
                        : 'border-border hover:border-orange-300 hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        generationMethod === 'manual' ? 'border-orange-500 bg-orange-500' : 'border-muted'
                      }`}>
                        {generationMethod === 'manual' && <Check className="w-2 h-2 text-white" />}
                      </div>
                      <div>
                        <p className="font-medium text-sm text-foreground">Manual Copy</p>
                        <p className="text-[10px] text-muted-foreground">Direct clone of source</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {generationMethod === 'ai' ? (
                <div className="flex-1 min-h-0">
                  <VariantGenerationChat
                    sourceTrack={{
                      id: selectedTrack!.id,
                      title: selectedTrack!.title,
                      type: selectedTrack!.type as any,
                      transcript: fullSourceTrack?.transcript,
                      content: fullSourceTrack?.content_text || fullSourceTrack?.content,
                      thumbnail_url: selectedTrack!.thumbnail_url
                    }}
                    variantType={selectedVariantType!}
                    variantContext={buildVariantContext()}
                    onGenerated={handleAIGenerated}
                    onCancel={() => setGenerationMethod('manual')}
                  />
                </div>
              ) : (
                <div className="bg-muted/50 border border-border rounded-lg p-4">
                  <h4 className="text-sm font-medium text-foreground mb-2">Summary</h4>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p><span className="font-medium">Source:</span> {selectedTrack?.title}</p>
                    <p><span className="font-medium">Type:</span> {selectedVariantType && variantTypeConfig[selectedVariantType].label}</p>
                    <p><span className="font-medium">New Title:</span> {variantTitle}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Creating State */}
          {step === 'creating' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-10 h-10 animate-spin text-orange-500 mb-4" />
              <p className="text-lg font-medium text-foreground">Creating Variant...</p>
              <p className="text-sm text-muted-foreground mt-1">This may take a moment</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {step !== 'creating' && !(step === 'generation-method' && generationMethod === 'ai') && (
          <div className="flex items-center justify-between gap-3 p-6 border-t border-border flex-shrink-0">
            <Button
              variant="outline"
              onClick={step === 'select-track' || (step === 'select-type' && initialSourceTrack) ? onClose : goToPreviousStep}
              disabled={isCreating}
            >
              {step === 'select-track' || (step === 'select-type' && initialSourceTrack) ? (
                'Cancel'
              ) : (
                <>
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </>
              )}
            </Button>
            <Button
              onClick={goToNextStep}
              disabled={!canProceedToNextStep() || isCreating}
              className="bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700"
            >
              {step === 'generation-method' ? (
                <>
                  <GitBranch className="w-4 h-4 mr-2" />
                  Create Variant
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* State Variant Wizard (v2 AI pipeline) */}
      {selectedTrack && selectedState && (
        <StateVariantWizard
          isOpen={showStateVariantWizard}
          onClose={() => setShowStateVariantWizard(false)}
          sourceTrack={{
            id: selectedTrack.id,
            title: selectedTrack.title,
            type: selectedTrack.type as 'article' | 'video' | 'story' | 'checkpoint',
            content_text: fullSourceTrack?.content_text,
            transcript: fullSourceTrack?.transcript,
            description: fullSourceTrack?.description,
          }}
          initialState={US_STATES.find(s => s.code === selectedState)}
          onComplete={(draft, variantTrackId) => {
            // Draft was published successfully - now we have the actual track ID
            setShowStateVariantWizard(false);
            toast.success('State variant created!');
            // Close the main modal and notify parent with the new track ID
            const trackId = variantTrackId || draft.draftId;
            if (trackId) {
              onVariantCreated(trackId);
            }
            onClose();
          }}
        />
      )}
    </div>
  );
}
