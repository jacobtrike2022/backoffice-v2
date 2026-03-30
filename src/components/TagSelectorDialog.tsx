import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Check, Plus, Tag as TagIcon, Folder, Edit, Trash2, Zap } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { 
  getTagHierarchy, 
  buildTagHierarchyStructure,
  deleteTag,
  type Tag, 
  type SystemCategory,
  type TagHierarchy
} from '../lib/crud/tags';
import { CreateTagModal } from './CreateTagModal';
import { TagRecommendationPanel } from './TagRecommendationPanel';
import { supabase } from '../lib/supabase';
import { publicAnonKey, getServerUrl } from '../utils/supabase/info';

interface TagSelectorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTags: string[]; // Storing tag names for now to maintain compatibility
  onTagsChange: (tags: string[], tagObjects?: Tag[]) => void; // Return both
  systemCategory?: SystemCategory; // e.g., 'content', 'people', 'units'
  allowManagement?: boolean; // Allow editing/deleting tags directly from the list
  canManageSystemTags?: boolean; // Allow editing/deleting system-locked tags (e.g. super admin)
  restrictToParentName?: string; // Only show tags under this specific Parent Tag name
  // AI Recommendation props
  showAISuggest?: boolean;
  contentContext?: {
    title?: string;
    description?: string;
    transcript?: string;
    keyFacts?: any[];
    trackId?: string;
    organizationId?: string;
  };
}

export function TagSelectorDialog({ 
  isOpen, 
  onClose, 
  selectedTags, 
  onTagsChange,
  systemCategory = 'content',
  allowManagement = false,
  canManageSystemTags = false,
  restrictToParentName,
  showAISuggest = false,
  contentContext
}: TagSelectorDialogProps) {
  const { t } = useTranslation();
  const [parentGroups, setParentGroups] = useState<TagHierarchy[number]['parents']>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [tagToEdit, setTagToEdit] = useState<Tag | null>(null);
  const [prefilledTagData, setPrefilledTagData] = useState<{ name: string; description: string; parentId?: string; parentName?: string } | null>(null);
  const [localSelectedTags, setLocalSelectedTags] = useState<string[]>(selectedTags); // Local state for tag selection
  const [rawHierarchy, setRawHierarchy] = useState<Tag[]>([]);

  // AI Recommendation state
  const [aiRecommendations, setAiRecommendations] = useState<any[]>([]);
  const [newTagSuggestions, setNewTagSuggestions] = useState<any[]>([]);
  const [analysisSummary, setAnalysisSummary] = useState<string>('');
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [hasPendingAISuggestions, setHasPendingAISuggestions] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadTags();
      setLocalSelectedTags(selectedTags); // Reset local state when modal opens
      checkPendingSuggestions();
    }
  }, [isOpen, systemCategory, selectedTags]);

  const checkPendingSuggestions = async () => {
    if (!contentContext?.trackId) return;
    
    try {
      const { count, error } = await supabase
        .from('ai_tag_suggestions')
        .select('*', { count: 'exact', head: true })
        .eq('track_id', contentContext.trackId)
        .eq('status', 'pending');
        
      if (error) throw error;
      setHasPendingAISuggestions((count || 0) > 0);
    } catch (err) {
      console.error('Error checking pending AI suggestions:', err);
    }
  };

  const handleAISuggest = async () => {
    if (!contentContext) {
      toast.error(t('content.noContentToAnalyze'));
      return;
    }

    // Check if there's enough content to analyze
    const hasContent = 
      contentContext.title || 
      contentContext.description || 
      contentContext.transcript ||
      (contentContext.keyFacts && contentContext.keyFacts.length > 0);

    if (!hasContent) {
      toast.error(t('content.addContentFirst'));
      return;
    }

    setIsLoadingAI(true);
    setShowAIPanel(true);
    setAiRecommendations([]);
    setNewTagSuggestions([]);
    setAnalysisSummary('');

    try {
      // 1. Check if we have pending suggestions in DB first (Phase 2 surfacing)
      if (hasPendingAISuggestions && contentContext.trackId) {
        const { data: pending, error: fetchError } = await supabase
          .from('ai_tag_suggestions')
          .select('*')
          .eq('track_id', contentContext.trackId)
          .eq('status', 'pending');
          
        if (!fetchError && pending && pending.length > 0) {
          // Process existing suggestions from DB
          // For simplicity in Phase 1->2 transition, we'll map them back to recommendations
          const matchedRecs = pending.map((p: any) => ({
            tag_id: '', // Will be filled below if found
            tag_name: p.suggested_tag_name,
            tag_color: null,
            parent_category: p.suggested_parent_category || 'Unknown',
            confidence: p.confidence || 0,
            reasoning: p.reasoning || '',
            auto_select: (p.confidence || 0) >= 85
          }));

          // Enrich with tag data from rawHierarchy
          const enriched = matchedRecs.map(rec => {
            const tag = rawHierarchy.find(t => t.name.toLowerCase() === rec.tag_name.toLowerCase());
            if (tag) {
              return { ...rec, tag_id: tag.id, tag_color: tag.color };
            }
            return rec;
          }).filter(r => r.tag_id !== '');

          if (enriched.length > 0) {
            setAiRecommendations(enriched);
            setAnalysisSummary(t('content.usingPendingAISuggestions'));
            setIsLoadingAI(false);
            return;
          }
        }
      }

      // 2. No pending suggestions or error, call OpenAI API
      // Use session token or anon key (demo mode has no auth session)
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || publicAnonKey;

      const response = await fetch(
        `${getServerUrl()}/recommend-tags`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'apikey': publicAnonKey,
            'Content-Type': 'application/json',
          },
        body: JSON.stringify({
          title: contentContext.title,
          description: contentContext.description,
          transcript: contentContext.transcript,
          keyFacts: contentContext.keyFacts,
          trackId: contentContext.trackId,
          organizationId: contentContext.organizationId,
        }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get recommendations');
      }

      const data = await response.json();
      
      setAiRecommendations(data.recommendations || []);
      setNewTagSuggestions(data.new_tag_suggestions || []);
      setAnalysisSummary(data.analysis_summary || '');

      // Auto-select high-confidence tags
      const autoSelectTags = (data.recommendations || [])
        .filter((r: any) => r.auto_select && !localSelectedTags.includes(r.tag_name))
        .map((r: any) => r.tag_name);

      if (autoSelectTags.length > 0) {
        setLocalSelectedTags(prev => [...new Set([...prev, ...autoSelectTags])]);
        toast.success(t('content.autoSelectedTags', { count: autoSelectTags.length }));
      } else if (data.recommendations?.length > 0) {
        toast.success(t('content.foundRelevantTags', { count: data.recommendations.length }));
      }

    } catch (error: any) {
      console.error('AI tag suggestion failed:', error);
      toast.error(error.message || t('content.failedGetAISuggestions'));
      setShowAIPanel(false);
    } finally {
      setIsLoadingAI(false);
    }
  };

  const handleToggleAIRecommendedTag = (tagName: string) => {
    if (localSelectedTags.includes(tagName)) {
      setLocalSelectedTags(localSelectedTags.filter(t => t !== tagName));
    } else {
      setLocalSelectedTags([...localSelectedTags, tagName]);
    }
  };

  const handleCreateNewTag = async (suggestion: any) => {
    setTagToEdit(null);
    // Use suggested_description for the tag description (not reasoning)
    // Use suggested_parent_id if available (resolved subcategory ID from backend)

    // Try to find the parent by name if ID is not provided
    let resolvedParentId = suggestion.suggested_parent_id;
    if (!resolvedParentId && suggestion.suggested_parent) {
      const foundParent = findTagByNameInHierarchy(rawHierarchy, suggestion.suggested_parent);
      resolvedParentId = foundParent?.id;
      console.log('[handleCreateNewTag] Found parent by name:', suggestion.suggested_parent, '→', foundParent);
    }

    console.log('[handleCreateNewTag] suggestion:', suggestion, 'resolvedParentId:', resolvedParentId);

    setPrefilledTagData({
      name: suggestion.suggested_name,
      description: suggestion.description || suggestion.suggested_description || '',
      parentId: resolvedParentId || undefined,
      parentName: suggestion.suggested_parent
    });
    setShowCreateModal(true);
  };

  const handleAIFeedback = async (tagName: string, feedback: 'positive' | 'negative') => {
    if (!contentContext?.trackId) return;
    
    try {
      await supabase
        .from('ai_tag_suggestions')
        .update({ 
          feedback, 
          feedback_at: new Date().toISOString() 
        })
        .eq('track_id', contentContext.trackId)
        .eq('suggested_tag_name', tagName);
        
      if (feedback === 'negative') {
        toast.info(t('content.aiFeedbackReceived'));
      } else {
        toast.success(t('content.aiFeedbackGladHelpful'));
      }
    } catch (err) {
      console.error('Error saving AI feedback:', err);
    }
  };

  const loadTags = async () => {
    setIsLoading(true);
    try {
      const hierarchy = await getTagHierarchy(systemCategory);
      setRawHierarchy(hierarchy);

      const flatten = (nodes: Tag[]): Tag[] => {
        const result: Tag[] = [];
        nodes.forEach(n => {
          result.push({ ...n, children: undefined });
          if (n.children && n.children.length > 0) {
            result.push(...flatten(n.children));
          }
        });
        return result;
      };

      const structured = buildTagHierarchyStructure(flatten(hierarchy));
      // Find the system category bucket for the requested system
      const matchingSystem = structured.find(entry => entry.systemCategory.system_category === systemCategory)
        || structured[0];

      setParentGroups(matchingSystem ? matchingSystem.parents : []);
    } catch (error: any) {
      console.error('Error loading tags:', error);
      toast.error(t('content.failedLoadTags'));
    } finally {
      setIsLoading(false);
    }
  };

  // Recursively search for a tag by name in the hierarchy (case-insensitive)
  const findTagByNameInHierarchy = (tags: Tag[], name: string, depth = 0): Tag | undefined => {
    for (const tag of tags) {
      if (tag.name.toLowerCase() === name.toLowerCase()) {
        console.log(`[findTagByNameInHierarchy] Found "${name}" at depth ${depth}:`, tag);
        return tag;
      }
      if (tag.children && tag.children.length > 0) {
        const found = findTagByNameInHierarchy(tag.children, name, depth + 1);
        if (found) return found;
      }
    }
    if (depth === 0) {
      console.log(`[findTagByNameInHierarchy] NOT found: "${name}". Available top-level tags:`, tags.map(t => t.name));
    }
    return undefined;
  };

  const handleToggleTag = (tag: Tag) => {
    const tagName = tag.name;
    if (localSelectedTags.includes(tagName)) {
      // Remove from local selection only
      setLocalSelectedTags(localSelectedTags.filter(t => t !== tagName));
    } else {
      // Add to local selection only
      setLocalSelectedTags([...localSelectedTags, tagName]);
    }
  };

  const handleToggleSubcategory = (subcategory: Tag, children: Tag[]) => {
    if (!children || children.length === 0) return;
    const childNames = children.map(c => c.name);
    const allSelected = childNames.every(name => localSelectedTags.includes(name));

    if (allSelected) {
      setLocalSelectedTags(prev => prev.filter(name => !childNames.includes(name)));
    } else {
      setLocalSelectedTags(prev => {
        const next = new Set(prev);
        childNames.forEach(name => next.add(name));
        return Array.from(next);
      });
    }
  };

  const handleCreateSuccess = (createdTagName?: string) => {
    loadTags();

    // If a new tag was created (not edited) and we have the name, auto-select it
    if (!tagToEdit && createdTagName && !localSelectedTags.includes(createdTagName)) {
      setLocalSelectedTags(prev => [...prev, createdTagName]);
      toast.success(t('content.tagCreatedAndSelected', { name: createdTagName }));
    } else {
      toast.success(tagToEdit ? t('content.tagUpdated') : t('content.tagCreatedSimple'));
    }

    setTagToEdit(null);
    setPrefilledTagData(null);
  };

  const handleEditTag = (e: React.MouseEvent, tag: Tag) => {
    e.stopPropagation();
    setTagToEdit(tag);
    setShowCreateModal(true);
  };

  const handleDeleteTag = async (e: React.MouseEvent, tag: Tag) => {
    e.stopPropagation();
    if (!confirm(t('content.confirmDeleteTag', { name: tag.name }))) return;
    
    try {
      await deleteTag(tag.id);
      toast.success(t('content.tagDeleted'));
      loadTags();
    } catch (error: any) {
      toast.error(error.message || t('content.failedDeleteTag'));
    }
  };

  const handleSave = () => {
    // Only call onTagsChange when user clicks "Apply Tags"
    const allTags = parentGroups.flatMap(parentGroup => {
      const tags = [parentGroup.tag, ...parentGroup.directChildren];
      parentGroup.subcategories.forEach(sc => {
        tags.push(sc.tag, ...sc.children);
      });
      return tags;
    });
    const selectedObjects = allTags.filter(t => localSelectedTags.includes(t.name));
    onTagsChange(localSelectedTags, selectedObjects);
    onClose();
  };

  // Prepare categories for display - flatten system categories if present
  // This ensures we show the actual tag categories (e.g. "Department") as headers
  // instead of the top-level system container (e.g. "UNITS")
  const displayCategories = React.useMemo(() => {
    const parents = restrictToParentName
      ? parentGroups.filter(pg => pg.tag.name.toLowerCase().trim() === restrictToParentName.toLowerCase().trim())
      : parentGroups;
    return parents;
  }, [parentGroups, restrictToParentName]);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[50vw] max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t('content.selectTags')}</DialogTitle>
            <DialogDescription>
              {t('content.selectTagsDesc', { system: systemCategory })}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4 space-y-6">
            {/* Create New Tag Button + AI Suggest Button */}
            <div className="flex justify-end gap-2">
              {/* AI Suggest Button - Only show when content context available */}
              {showAISuggest && contentContext && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAISuggest}
                  disabled={isLoadingAI}
                  className="text-orange-600 hover:text-orange-700 border-orange-300 hover:border-orange-400 hover:bg-orange-50 dark:text-orange-400 dark:border-orange-700 dark:hover:bg-orange-950"
                >
                      {isLoadingAI ? (
                        <div className="animate-spin h-4 w-4 mr-2 border-2 border-orange-500 border-t-transparent rounded-full" />
                      ) : (
                        <Zap className="h-4 w-4 mr-2 fill-current" />
                      )}
                      {t('content.aiSuggest')}
                </Button>
              )}
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateModal(true)}
                className="text-primary hover:text-primary/80"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('content.createNewTag')}
              </Button>
            </div>

            {/* AI Recommendations Panel - Show above tag categories */}
            {showAIPanel && (
              <TagRecommendationPanel
                recommendations={aiRecommendations}
                newTagSuggestions={newTagSuggestions}
                analysisSummary={analysisSummary}
                selectedTags={localSelectedTags}
                onToggleTag={handleToggleAIRecommendedTag}
                onCreateNewTag={handleCreateNewTag}
                onDismiss={() => setShowAIPanel(false)}
                onFeedback={handleAIFeedback}
                isLoading={isLoadingAI}
              />
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="flex justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && displayCategories.length === 0 && (
              <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl bg-muted/30">
                <TagIcon className="h-12 w-12 text-muted-foreground mb-3 opacity-50" />
                <p className="text-muted-foreground font-medium">{t('content.noTagsFoundForSystem')}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('content.getStartedCreatingTag')}</p>
                <Button
                  variant="link"
                  onClick={() => setShowCreateModal(true)}
                  className="mt-2"
                >
                  {t('content.createFirstTag')}
                </Button>
              </div>
            )}

            {/* Tag Categories (Parents) */}
            {!isLoading && displayCategories.map((category) => {
              const parent = category.tag;
              const directChildren = category.directChildren || [];
              const subcategories = category.subcategories || [];

              const hasContent =
                directChildren.length > 0 ||
                subcategories.length > 0 ||
                subcategories.some(sc => (sc.children || []).length > 0);

              if (!hasContent && !restrictToParentName) return null;

              return (
                <div key={parent.id} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Folder className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
                      {parent.name}
                    </h3>
                  </div>
                  
                  {/* Direct children (no subcategory) */}
                  {directChildren.length > 0 && (
                    <div className="flex flex-wrap gap-2 pl-6">
                      {directChildren.map((tag) => {
                        const isSelected = localSelectedTags.includes(tag.name);
                        const tagColor = tag.color || '#F74A05'; // Default to brand orange

                        return (
                          <div
                            key={tag.id}
                            onClick={() => handleToggleTag(tag)}
                            className={`
                              group relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all cursor-pointer border
                              ${isSelected 
                                ? 'border-transparent text-white shadow-sm' 
                                : 'hover:opacity-80'
                              }
                            `}
                            style={isSelected ? {
                              background: `linear-gradient(135deg, ${tagColor} 0%, ${tagColor}dd 100%)`,
                            } : {
                              backgroundColor: `${tagColor}15`,
                              borderColor: `${tagColor}40`,
                              color: tagColor
                            }}
                          >
                            {isSelected && <Check className="h-3.5 w-3.5" />}
                            <span className="text-sm font-medium">{tag.name}</span>

                            {allowManagement && (!tag.is_system_locked || canManageSystemTags) && (
                              <div className="flex items-center gap-1 ml-1 pl-1 border-l border-current/20 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={(e) => handleEditTag(e, tag)}
                                  className="p-0.5 hover:bg-black/10 rounded"
                                >
                                  <Edit className="h-3 w-3" />
                                </button>
                                <button 
                                  onClick={(e) => handleDeleteTag(e, tag)}
                                  className="p-0.5 hover:bg-red-500/20 rounded text-current"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Subcategories */}
                  {subcategories.map(subcategory => {
                    const children = subcategory.children || [];
                    const allSelected = children.length > 0 && children.every(c => localSelectedTags.includes(c.name));
                    const partiallySelected = !allSelected && children.some(c => localSelectedTags.includes(c.name));

                    return (
                      <div key={subcategory.tag.id} className="space-y-2 pl-4">
                        <button
                          type="button"
                          onClick={() => handleToggleSubcategory(subcategory.tag, children)}
                          className="flex items-center gap-2 text-sm font-medium text-left"
                        >
                          <div className={`
                            w-5 h-5 rounded-full border flex items-center justify-center
                            ${allSelected ? 'bg-primary text-white border-primary' : 'border-muted-foreground/40'}
                            ${partiallySelected ? 'bg-primary/10 border-primary/60' : ''}
                          `}>
                            {(allSelected || partiallySelected) && <Check className="h-3 w-3" />}
                          </div>
                          <span>{subcategory.tag.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({t('content.tagsCount', { count: children.length })})
                          </span>
                        </button>

                        <div className="flex flex-wrap gap-2 pl-6">
                          {children.length === 0 ? (
                            <span className="text-xs text-muted-foreground">{t('content.noTagsYet')}</span>
                          ) : (
                            children.map(tag => {
                              const isSelected = localSelectedTags.includes(tag.name);
                              const tagColor = tag.color || '#F74A05';

                              return (
                                <div
                                  key={tag.id}
                                  onClick={() => handleToggleTag(tag)}
                                  className={`
                                    group relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all cursor-pointer border
                                    ${isSelected 
                                      ? 'border-transparent text-white shadow-sm' 
                                      : 'hover:opacity-80'
                                    }
                                  `}
                                  style={isSelected ? {
                                    background: `linear-gradient(135deg, ${tagColor} 0%, ${tagColor}dd 100%)`,
                                  } : {
                                    backgroundColor: `${tagColor}15`,
                                    borderColor: `${tagColor}40`,
                                    color: tagColor
                                  }}
                                >
                                  {isSelected && <Check className="h-3.5 w-3.5" />}
                                  <span className="text-sm font-medium">{tag.name}</span>

                                  {allowManagement && (!tag.is_system_locked || canManageSystemTags) && (
                                    <div className="flex items-center gap-1 ml-1 pl-1 border-l border-current/20 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button 
                                        onClick={(e) => handleEditTag(e, tag)}
                                        className="p-0.5 hover:bg-black/10 rounded"
                                      >
                                        <Edit className="h-3 w-3" />
                                      </button>
                                      <button 
                                        onClick={(e) => handleDeleteTag(e, tag)}
                                        className="p-0.5 hover:bg-red-500/20 rounded text-current"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Footer with Selected Summary */}
          <div className="pt-4 border-t mt-auto flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {t('content.tagsSelected', { count: localSelectedTags.length })}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSave} className="hero-primary">
                {t('content.applyTags')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Tag Modal - Reusing existing component */}
      {showCreateModal && (
        <CreateTagModal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setTagToEdit(null);
            setPrefilledTagData(null);
          }}
          onSuccess={handleCreateSuccess}
          categories={rawHierarchy} // Pass the full hierarchy for parent selection
          tagToEdit={tagToEdit}
          initialTagName={prefilledTagData?.name}
          initialDescription={prefilledTagData?.description}
          // parentId is already resolved in handleCreateNewTag, use it directly
          preselectedParentId={
            prefilledTagData?.parentId
              ? prefilledTagData.parentId
              : restrictToParentName
                ? displayCategories.find(c => c.tag.name.toLowerCase().trim() === restrictToParentName.toLowerCase().trim())?.tag.id
                : undefined
          }
          // When creating from AI suggestion with a parent, default to child type
          defaultType={prefilledTagData?.parentId ? 'child' : undefined}
        />
      )}
    </>
  );
}