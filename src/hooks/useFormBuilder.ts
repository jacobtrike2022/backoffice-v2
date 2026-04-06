import { useState, useEffect, useRef, useCallback } from 'react';
import {
  createForm,
  updateForm,
  publishForm as publishFormCrud,
  getFormWithSections,
  createFormSection,
  updateFormSection,
  deleteFormSection,
  bulkUpsertFormBlocks,
  type CreateFormInput,
  type FormSection,
  type FormWithSections,
} from '../lib/crud/forms';
import { createFormVersion } from '../lib/crud/formVersions';
import type { BlockTemplate } from '../lib/crud/blockGroups';
import { instantiateGroupTemplate } from '../lib/forms/blockGroupSerializer';
import { NO_FOLLOWUP_PACK, buildFollowUpPack, FOLLOWUP_PACK_MARKER, FOLLOWUP_TRIGGER_KEY, isFollowUpPackBlock } from '../lib/forms/builtinFollowUps';

// ============================================================================
// TYPES
// ============================================================================

export interface EmailNotification {
  id: string;
  to_type: 'specific_email' | 'store_manager' | 'district_manager' | 'admin';
  to_email?: string;
  subject?: string;
  include_score?: boolean;
  include_responses?: boolean;
  trigger: 'always' | 'on_fail' | 'on_pass';
}

export interface OnFailConfig {
  reassign?: { enabled: boolean; delay_hours: number };
  assign_form?: { enabled: boolean; form_id: string; form_title: string };
  assign_training?: { enabled: boolean; playlist_id: string; playlist_title: string };
  fail_message?: string;
}

export interface SubmissionConfig {
  confirmation_message?: string;
  redirect_url?: string;
  send_email_to_submitter?: boolean;
  email_notifications?: EmailNotification[];
  score_threshold_action?: {
    below_threshold_email?: string;
    below_threshold_message?: string;
  };
  on_fail?: OnFailConfig;
}

export interface StartConfig {
  identity_mode?: 'individual' | 'location' | 'anonymous';
  require_location?: boolean;
  require_shift?: boolean;
  shift_options?: string[];
  submission_limit?: 'unlimited' | 'daily' | 'shift' | 'weekly';
}

export interface FormMetadata {
  id: string;
  organization_id: string;
  title: string;
  description?: string;
  type: string;
  category?: string;
  status: 'draft' | 'published' | 'archived';
  tags?: string[];
  requires_approval?: boolean;
  allow_anonymous?: boolean;
  is_template?: boolean;
  scoring_enabled?: boolean;
  scoring_mode?: 'pass_fail' | 'weighted' | 'section';
  pass_threshold?: number;
  submission_config?: SubmissionConfig;
  start_config?: StartConfig;
}

export interface FormSettings {
  requires_approval: boolean;
  allow_anonymous: boolean;
  scoring_enabled?: boolean;
  scoring_mode?: 'pass_fail' | 'weighted' | 'section';
  pass_threshold?: number;
}

export interface LocalBlock {
  id: string;
  _isNew?: boolean;
  _isDirty?: boolean;
  form_id: string;
  section_id?: string | null;
  block_type: string;
  label: string;
  description?: string;
  placeholder?: string;
  options?: string[];
  validation_rules?: Record<string, unknown>;
  conditional_logic?: unknown;
  settings?: Record<string, unknown>;
  is_required: boolean;
  display_order: number;
  guideline_text?: string;
  guideline_attachments?: Array<{ url: string; type: string; name: string }>;
}

export interface UseFormBuilderProps {
  formId?: string;
  orgId: string;
  /** Initial form type when creating a new form (no formId). Defaults to 'inspection'. */
  initialType?: string;
}

export interface UseFormBuilderReturn {
  // Form metadata state
  form: FormMetadata | null;
  setFormTitle: (title: string) => void;
  setFormDescription: (desc: string) => void;
  setFormType: (type: string) => void;
  setFormCategory: (cat: string) => void;
  setFormStatus: (status: 'draft' | 'published' | 'archived') => void;
  setFormTags: (tags: string[]) => void;
  setFormSettings: (settings: Partial<FormSettings>) => void;
  setFormIsTemplate: (isTemplate: boolean) => void;
  setSubmissionConfig: (config: SubmissionConfig) => void;
  setStartConfig: (config: StartConfig) => void;

  // Sections state
  sections: FormSection[];
  addSection: (afterSectionId?: string | null) => Promise<void>;
  updateSection: (sectionId: string, updates: Partial<FormSection>) => void;
  deleteSection: (sectionId: string) => Promise<void>;

  // Blocks state
  blocks: LocalBlock[];
  selectedBlockId: string | null;
  setSelectedBlockId: (id: string | null) => void;
  addBlock: (blockType: string, sectionId?: string | null, afterBlockId?: string) => void;
  addBlockGroup: (templates: import('../lib/crud/blockGroups').BlockTemplate[], sectionId?: string | null, afterBlockId?: string) => void;
  addFollowUpPack: (parentBlockId: string, triggerValue?: 'Yes' | 'No') => void;
  removeFollowUpPack: (parentBlockId: string) => void;
  hasFollowUpPack: (parentBlockId: string) => boolean;
  updateFollowUpTrigger: (parentBlockId: string, triggerValue: 'Yes' | 'No') => void;
  updateBlock: (blockId: string, updates: Partial<LocalBlock>) => void;
  deleteBlock: (blockId: string) => void;
  reorderBlock: (blockId: string, newIndex: number, sectionId?: string | null) => void;
  reorderSection: (sectionId: string, newIndex: number) => void;

  // Save/publish
  saveForm: () => Promise<void>;
  publishForm: () => Promise<void>;

  // Loading state
  isLoading: boolean;
  isSaving: boolean;
  isDirty: boolean;
  error: string | null;
}

// ============================================================================
// HOOK
// ============================================================================

export function useFormBuilder({ formId, orgId, initialType }: UseFormBuilderProps): UseFormBuilderReturn {
  const [form, setForm] = useState<FormMetadata | null>(null);
  const [sections, setSections] = useState<FormSection[]>([]);
  const [blocks, setBlocks] = useState<LocalBlock[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs for debounced auto-save
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirtyRef = useRef(false);
  const saveFormRef = useRef<() => Promise<void>>(() => Promise.resolve());

  // Keep isDirtyRef in sync
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  // Mark dirty and schedule auto-save.
  // Uses a longer idle-based debounce: the timer resets on every edit,
  // so a save only fires after the user stops editing for the full interval.
  const markDirty = useCallback(() => {
    setIsDirty(true);
    isDirtyRef.current = true;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      saveFormRef.current?.();
    }, 5000);
  }, []);

  // ============================================================================
  // SAVE
  // ============================================================================

  const isSavingRef = useRef(false);

  const saveForm = useCallback(async () => {
    if (!form) return;
    // If already saving, skip — the debounce will reschedule if still dirty.
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setIsSaving(true);
    try {
      // Save form metadata
      await updateForm(form.id, {
        title: form.title,
        description: form.description,
        type: form.type as 'ojt-checklist' | 'inspection' | 'audit' | 'survey',
        category: form.category,
        status: form.status,
        tags: form.tags || [],
        requires_approval: form.requires_approval,
        allow_anonymous: form.allow_anonymous,
        is_template: form.is_template,
        settings: {
          scoring_enabled: form.scoring_enabled ?? false,
          scoring_mode: form.scoring_mode ?? 'pass_fail',
          pass_threshold: form.pass_threshold ?? 70,
          ...(form.start_config ? { start_config: form.start_config } : {}),
        },
        submission_config: form.submission_config ?? {},
      } as any);

      // Use sequential indices as display_order to avoid collisions from fractional rounding.
      // Always include the block ID — we use proper UUIDs from creation so the DB
      // accepts them directly, eliminating the need for a post-save re-fetch.
      const blocksToUpsert = blocks.map((b, idx) => ({
        id: b.id,
        form_id: form.id,
        section_id: b.section_id ?? null,
        block_type: b.block_type,
        label: b.label,
        description: b.description,
        placeholder: b.placeholder,
        options: b.options,
        validation_rules: b.validation_rules,
        conditional_logic: b.conditional_logic,
        settings: b.settings,
        is_required: b.is_required,
        display_order: idx,
        guideline_text: b.guideline_text,
        guideline_attachments: b.guideline_attachments,
      }));

      await bulkUpsertFormBlocks(form.id, blocksToUpsert);

      // Clear dirty/new flags in-place — no re-fetch needed since we provide
      // stable UUIDs from block creation.  This is the critical optimization:
      // saves that used to take 3-4s (upsert + refetch + merge) now take ~1s.
      setBlocks(prev => prev.map(b =>
        (b._isDirty || b._isNew) ? { ...b, _isDirty: false, _isNew: false } : b
      ));

      setIsDirty(false);
      isDirtyRef.current = false;
    } catch (err: any) {
      console.error('[FormBuilder] Save failed:', err?.message || err, err?.details || '', err?.code || '');
      setError(err instanceof Error ? err.message : 'Failed to save form');
      // Keep isDirty so the user knows a save failure occurred and can retry
      setIsDirty(true);
      isDirtyRef.current = true;
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
      // If the form became dirty again while we were saving (user kept editing),
      // schedule another save so nothing gets lost.
      if (isDirtyRef.current) {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
          saveFormRef.current?.();
        }, 2000);
      }
    }
  }, [form, blocks, orgId]);

  // Keep ref in sync so debounce timer can call latest version
  useEffect(() => {
    saveFormRef.current = saveForm;
  }, [saveForm]);

  // ============================================================================
  // PUBLISH
  // ============================================================================

  const publishForm = useCallback(async () => {
    if (!form) return;
    // Save first to ensure everything is persisted
    await saveForm();
    await publishFormCrud(form.id);
    await createFormVersion(form.id, orgId);
    setForm(prev => prev ? { ...prev, status: 'published' } : prev);
  }, [form, orgId, saveForm]);

  // ============================================================================
  // LOAD / INIT
  // ============================================================================

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!orgId) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        if (formId) {
          // Load existing form
          const data = await getFormWithSections(formId, orgId);
          if (cancelled) return;
          if (data) {
            setForm(formDataToMetadata(data));
            setSections(data.form_sections || []);

            // Check if there are imported blocks from PDF import in sessionStorage
            const importedKey = `imported_form_blocks_${formId}`;
            const importedRaw = sessionStorage.getItem(importedKey);
            if (importedRaw) {
              sessionStorage.removeItem(importedKey);
              try {
                const parsed = JSON.parse(importedRaw);
                // Support both old format (array) and new format (object with blocks + sections)
                const importedBlocks: Array<{
                  ref_id?: string;
                  block_type: string;
                  label: string;
                  description?: string;
                  is_required: boolean;
                  options?: string[];
                  section_title?: string;
                  display_order: number;
                  conditional_logic?: {
                    action: string;
                    operator: string;
                    conditions: Array<{
                      source_block_ref_id?: string;
                      source_block_id?: string;
                      operator: string;
                      value: string;
                    }>;
                  } | null;
                }> = Array.isArray(parsed) ? parsed : (parsed.blocks || []);
                const importedSections: Array<{ title: string; description?: string }> = parsed.sections || [];

                // Create sections first if provided
                const sectionIdMap = new Map<string, string>();
                if (importedSections.length > 0) {
                  for (let i = 0; i < importedSections.length; i++) {
                    const sec = importedSections[i];
                    try {
                      const newSection = await createFormSection(
                        formId,
                        { title: sec.title, description: sec.description, display_order: i },
                        orgId
                      );
                      sectionIdMap.set(sec.title, newSection.id);
                    } catch (secErr) {
                      console.error('Error creating section:', secErr);
                    }
                  }
                  // Refresh sections from DB
                  const refreshed = await getFormWithSections(formId, orgId);
                  if (refreshed) {
                    setSections(refreshed.form_sections || []);
                  }
                }

                // First pass: generate IDs and build ref_id → real ID map
                const refIdToRealId = new Map<string, string>();
                const blockIds: string[] = [];
                for (let i = 0; i < importedBlocks.length; i++) {
                  const newId = crypto.randomUUID();
                  blockIds.push(newId);
                  const refId = importedBlocks[i].ref_id;
                  if (refId) {
                    refIdToRealId.set(refId, newId);
                  }
                }

                // Second pass: build blocks with remapped conditional_logic
                const localBlocks: LocalBlock[] = importedBlocks.map((b, i) => {
                  // Remap conditional_logic ref_ids to real block IDs
                  let mappedLogic: LocalBlock['conditional_logic'] = undefined;
                  if (b.conditional_logic?.conditions?.length) {
                    const mappedConditions = b.conditional_logic.conditions
                      .map(c => {
                        const refId = c.source_block_ref_id || c.source_block_id;
                        const realId = refId ? refIdToRealId.get(refId) : undefined;
                        if (!realId) return null; // Skip conditions with unresolvable refs
                        return {
                          source_block_id: realId,
                          operator: c.operator,
                          value: c.value || '',
                        };
                      })
                      .filter((c): c is NonNullable<typeof c> => c !== null);

                    if (mappedConditions.length > 0) {
                      mappedLogic = {
                        action: b.conditional_logic.action as 'show' | 'hide',
                        operator: (b.conditional_logic.operator as 'AND' | 'OR') || 'AND',
                        conditions: mappedConditions,
                      };
                    }
                  }

                  // Build validation_rules from AI output flags
                  const importedRules: Record<string, unknown> = { ...((b as any).validation_rules || {}) };
                  if ((b as any).allow_na) {
                    importedRules._allow_na = true;
                  }

                  return {
                    id: blockIds[i],
                    _isNew: true,
                    _isDirty: true,
                    form_id: formId,
                    section_id: (b.section_title && sectionIdMap.get(b.section_title)) || null,
                    block_type: b.block_type,
                    label: b.label,
                    description: b.description,
                    is_required: b.is_required,
                    options: b.options,
                    conditional_logic: mappedLogic,
                    validation_rules: Object.keys(importedRules).length > 0 ? importedRules : undefined,
                    display_order: i,
                    guideline_text: (b as any).guideline_text,
                    guideline_attachments: (b as any).guideline_attachments,
                  };
                });
                // For inspection/audit forms, auto-attach follow-up packs to yes_no blocks
                const formType = data.type || initialType;
                if (formType === 'inspection' || formType === 'audit') {
                  const yesNoBlocks = localBlocks.filter(b => b.block_type === 'yes_no');
                  const followUpInserts: LocalBlock[] = [];

                  for (const ynBlock of yesNoBlocks) {
                    const packBlocks = instantiateGroupTemplate(
                      NO_FOLLOWUP_PACK,
                      formId,
                      ynBlock.section_id ?? null,
                      ynBlock.id,
                      [...localBlocks, ...followUpInserts],
                      ynBlock.id,
                      { [FOLLOWUP_PACK_MARKER]: true, _followup_parent_id: ynBlock.id }
                    );
                    followUpInserts.push(...packBlocks);
                  }

                  if (followUpInserts.length > 0) {
                    // Interleave follow-ups after their parent yes_no blocks
                    const merged: LocalBlock[] = [];
                    for (const b of localBlocks) {
                      merged.push(b);
                      if (b.block_type === 'yes_no') {
                        const myFollowUps = followUpInserts.filter(
                          fb => (fb.settings as Record<string, unknown>)?._followup_parent_id === b.id
                        );
                        merged.push(...myFollowUps);
                      }
                    }
                    // Re-index display_order
                    merged.forEach((b, i) => { b.display_order = i; });
                    setBlocks(merged);
                  } else {
                    setBlocks(localBlocks);
                  }
                } else {
                  setBlocks(localBlocks);
                }
                markDirty();
              } catch {
                // Fallback to normal loaded blocks
                setBlocks(buildLocalBlocks(data));
              }
            } else {
              setBlocks(buildLocalBlocks(data));
            }
          } else {
            setError('Form not found');
          }
        } else {
          // Create a new form immediately so we always have a real DB ID
          const newForm = await createForm(
            { title: 'Untitled Form', type: (initialType ?? 'inspection') as CreateFormInput['type'] },
            orgId
          );
          if (cancelled) return;
          setForm({
            id: newForm.id,
            organization_id: newForm.organization_id,
            title: newForm.title,
            description: newForm.description || '',
            type: newForm.type,
            category: newForm.category || '',
            status: 'draft',
            tags: newForm.tags || [],
            requires_approval: newForm.requires_approval || false,
            allow_anonymous: newForm.allow_anonymous || false,
          });
          setSections([]);

          // Auto-scaffold starter blocks based on form type
          const formType = initialType ?? 'inspection';
          const scaffoldBlocks = getScaffoldBlocks(formType, newForm.id);
          if (scaffoldBlocks.length > 0) {
            setBlocks(scaffoldBlocks);
            markDirty();
          } else {
            setBlocks([]);
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error initializing form builder:', err);
          setError(err instanceof Error ? err.message : 'Failed to load form');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [formId, orgId, initialType, markDirty]);

  // ============================================================================
  // BEFOREUNLOAD
  // ============================================================================

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isDirtyRef.current) {
        saveFormRef.current?.();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // ============================================================================
  // FORM METADATA SETTERS
  // ============================================================================

  const setFormTitle = useCallback((title: string) => {
    setForm(prev => prev ? { ...prev, title } : prev);
    markDirty();
  }, [markDirty]);

  const setFormDescription = useCallback((description: string) => {
    setForm(prev => prev ? { ...prev, description } : prev);
    markDirty();
  }, [markDirty]);

  const setFormType = useCallback((type: string) => {
    setForm(prev => prev ? { ...prev, type } : prev);
    markDirty();
  }, [markDirty]);

  const setFormCategory = useCallback((category: string) => {
    setForm(prev => prev ? { ...prev, category } : prev);
    markDirty();
  }, [markDirty]);

  const setFormStatus = useCallback((status: 'draft' | 'published' | 'archived') => {
    setForm(prev => prev ? { ...prev, status } : prev);
    markDirty();
  }, [markDirty]);

  const setFormTags = useCallback((tags: string[]) => {
    setForm(prev => prev ? { ...prev, tags } : prev);
    markDirty();
  }, [markDirty]);

  const setFormSettings = useCallback((settings: Partial<FormSettings>) => {
    setForm(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        requires_approval: settings.requires_approval ?? prev.requires_approval,
        allow_anonymous: settings.allow_anonymous ?? prev.allow_anonymous,
        scoring_enabled: settings.scoring_enabled ?? prev.scoring_enabled,
        scoring_mode: settings.scoring_mode ?? prev.scoring_mode,
        pass_threshold: settings.pass_threshold ?? prev.pass_threshold,
      };
    });
    markDirty();
  }, [markDirty]);

  const setFormIsTemplate = useCallback((isTemplate: boolean) => {
    setForm(prev => prev ? { ...prev, is_template: isTemplate } : prev);
    markDirty();
  }, [markDirty]);

  const setSubmissionConfig = useCallback((config: SubmissionConfig) => {
    setForm(prev => prev ? { ...prev, submission_config: config } : prev);
    markDirty();
  }, [markDirty]);

  const setStartConfig = useCallback((config: StartConfig) => {
    setForm(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        start_config: config,
        // Sync allow_anonymous with identity_mode
        allow_anonymous: config.identity_mode === 'anonymous',
      };
    });
    markDirty();
  }, [markDirty]);

  // ============================================================================
  // SECTIONS
  // ============================================================================

  const addSection = useCallback(async (afterSectionId?: string | null) => {
    if (!form) return;
    try {
      // Create section with a temporary display_order — will be fixed in setSections
      const newSection = await createFormSection(
        form.id,
        { title: 'New Section', display_order: 9999 },
        orgId
      );

      const isUnsectionedContext = !afterSectionId || afterSectionId === null;

      setSections(prev => {
        let insertIdx: number;
        if (afterSectionId === '__end__') {
          // Explicit append at end (global "Add Section" button)
          insertIdx = prev.length;
        } else if (afterSectionId) {
          // Insert after the specified section
          const afterIdx = prev.findIndex(s => s.id === afterSectionId);
          insertIdx = afterIdx >= 0 ? afterIdx + 1 : 0;
        } else {
          // No section context (unsectioned blocks) — insert at top
          insertIdx = 0;
        }
        const updated = [...prev];
        updated.splice(insertIdx, 0, newSection);
        // Re-index all display_orders and persist
        return updated.map((s, i) => {
          const needsUpdate = s.display_order !== i;
          if (needsUpdate) {
            updateFormSection(s.id, { display_order: i }).catch(() => {});
          }
          return { ...s, display_order: i };
        });
      });

      // When adding from unsectioned context, move all unsectioned blocks into the new section
      if (isUnsectionedContext) {
        setBlocks(prev => prev.map(b =>
          !b.section_id ? { ...b, section_id: newSection.id, _isDirty: true } : b
        ));
        markDirty();
      }

      // Scroll to the new section after React renders it
      setTimeout(() => {
        const el = document.querySelector(`[data-section-id="${newSection.id}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    } catch (err) {
      console.error('Error creating section:', err);
      setError(err instanceof Error ? err.message : 'Failed to create section');
    }
  }, [form, orgId]);

  const updateSection = useCallback((sectionId: string, updates: Partial<FormSection>) => {
    setSections(prev =>
      prev.map(s => (s.id === sectionId ? { ...s, ...updates } : s))
    );
    // Persist section updates
    updateFormSection(sectionId, updates).catch(err => {
      console.error('Error updating section:', err);
    });
    markDirty();
  }, [markDirty]);

  const deleteSection = useCallback(async (sectionId: string) => {
    try {
      await deleteFormSection(sectionId);
      setSections(prev => prev.filter(s => s.id !== sectionId));
      // Blocks in this section have section_id set to NULL by DB CASCADE
      setBlocks(prev =>
        prev.map(b => (b.section_id === sectionId ? { ...b, section_id: null, _isDirty: true } : b))
      );
      markDirty();
    } catch (err) {
      console.error('Error deleting section:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete section');
    }
  }, [markDirty]);

  // ============================================================================
  // BLOCKS
  // ============================================================================

  const addBlock = useCallback((blockType: string, sectionId?: string | null, afterBlockId?: string) => {
    if (!form) return;

    setBlocks(prev => {
      // Find insertion index
      let insertIndex = prev.length;
      if (afterBlockId) {
        const afterIdx = prev.findIndex(b => b.id === afterBlockId);
        if (afterIdx !== -1) insertIndex = afterIdx + 1;
      }

      // Compute display_order: place after the block at insertIndex - 1
      const prevBlock = prev[insertIndex - 1];
      const nextBlock = prev[insertIndex];
      let displayOrder: number;
      if (prevBlock && nextBlock) {
        displayOrder = (prevBlock.display_order + nextBlock.display_order) / 2;
      } else if (prevBlock) {
        displayOrder = prevBlock.display_order + 1;
      } else {
        displayOrder = 0;
      }

      const newBlock: LocalBlock = {
        id: crypto.randomUUID(),
        _isNew: true,
        _isDirty: true,
        form_id: form.id,
        section_id: sectionId ?? null,
        block_type: blockType,
        label: blockTypeLabel(blockType),
        is_required: false,
        display_order: displayOrder,
        options: hasChoices(blockType) ? ['Option 1', 'Option 2', 'Option 3'] : undefined,
      };

      const updated = [...prev];
      updated.splice(insertIndex, 0, newBlock);
      return updated;
    });

    markDirty();
  }, [form, markDirty]);

  const addBlockGroup = useCallback((templates: BlockTemplate[], sectionId?: string | null, afterBlockId?: string) => {
    if (!form) return;
    const newBlocks = instantiateGroupTemplate(templates, form.id, sectionId ?? null, afterBlockId ?? null, blocks);

    setBlocks(prev => {
      let insertIndex = prev.length;
      if (afterBlockId) {
        const idx = prev.findIndex(b => b.id === afterBlockId);
        if (idx !== -1) insertIndex = idx + 1;
      }
      const updated = [...prev];
      updated.splice(insertIndex, 0, ...newBlocks);
      return updated;
    });

    markDirty();
  }, [form, blocks, markDirty]);

  // ── Built-in "No" Follow-Up Pack ─────────────────────────────────────────

  const hasFollowUpPack = useCallback((parentBlockId: string): boolean => {
    return blocks.some(b => {
      if (!isFollowUpPackBlock(b.settings as Record<string, unknown>)) return false;
      const logic = b.conditional_logic as { conditions?: Array<{ source_block_id: string }> } | null;
      return logic?.conditions?.some(c => c.source_block_id === parentBlockId) ?? false;
    });
  }, [blocks]);

  const addFollowUpPack = useCallback((parentBlockId: string, triggerValue: 'Yes' | 'No' = 'No') => {
    if (!form) return;
    // Don't add if already attached
    if (hasFollowUpPack(parentBlockId)) return;

    const parentBlock = blocks.find(b => b.id === parentBlockId);
    const sectionId = parentBlock?.section_id ?? null;

    const pack = buildFollowUpPack(triggerValue);
    const newBlocks = instantiateGroupTemplate(
      pack,
      form.id,
      sectionId,
      parentBlockId,
      blocks,
      parentBlockId,
      { [FOLLOWUP_PACK_MARKER]: true, _followup_parent_id: parentBlockId }
    );

    setBlocks(prev => {
      // Store the trigger value on the parent block's settings so the UI can read it
      const updated = prev.map(b =>
        b.id === parentBlockId
          ? { ...b, settings: { ...b.settings, [FOLLOWUP_TRIGGER_KEY]: triggerValue }, _isDirty: true }
          : b
      );
      const parentIdx = updated.findIndex(b => b.id === parentBlockId);
      const insertIdx = parentIdx !== -1 ? parentIdx + 1 : updated.length;
      updated.splice(insertIdx, 0, ...newBlocks);
      return updated;
    });

    markDirty();
  }, [form, blocks, hasFollowUpPack, markDirty]);

  const removeFollowUpPack = useCallback((parentBlockId: string) => {
    setBlocks(prev => {
      // Remove follow-up blocks and clear the trigger key from the parent
      return prev
        .filter(b => {
          if (!isFollowUpPackBlock(b.settings as Record<string, unknown>)) return true;
          const logic = b.conditional_logic as { conditions?: Array<{ source_block_id: string }> } | null;
          const pointsToParent = logic?.conditions?.some(c => c.source_block_id === parentBlockId) ?? false;
          const settingsParent = (b.settings as Record<string, unknown>)?._followup_parent_id === parentBlockId;
          return !(pointsToParent || settingsParent);
        })
        .map(b => {
          if (b.id === parentBlockId) {
            const { [FOLLOWUP_TRIGGER_KEY]: _, ...rest } = (b.settings || {}) as Record<string, unknown>;
            return { ...b, settings: rest, _isDirty: true };
          }
          return b;
        });
    });
    markDirty();
  }, [markDirty]);

  const updateFollowUpTrigger = useCallback((parentBlockId: string, triggerValue: 'Yes' | 'No') => {
    setBlocks(prev => prev.map(b => {
      // Update the trigger key on the parent block
      if (b.id === parentBlockId) {
        return { ...b, settings: { ...b.settings, [FOLLOWUP_TRIGGER_KEY]: triggerValue }, _isDirty: true };
      }
      // Update the condition value on all follow-up blocks for this parent
      if (!isFollowUpPackBlock(b.settings as Record<string, unknown>)) return b;
      const parentId = (b.settings as Record<string, unknown>)?._followup_parent_id;
      if (parentId !== parentBlockId) return b;

      const logic = b.conditional_logic as {
        action?: string; operator?: string;
        conditions?: Array<{ source_block_id: string; operator: string; value: string }>;
      } | null;
      if (!logic?.conditions?.length) return b;

      const updatedConditions = logic.conditions.map(c =>
        c.source_block_id === parentBlockId ? { ...c, value: triggerValue } : c
      );
      return {
        ...b,
        conditional_logic: { ...logic, conditions: updatedConditions },
        _isDirty: true,
      };
    }));
    markDirty();
  }, [markDirty]);

  const updateBlock = useCallback((blockId: string, updates: Partial<LocalBlock>) => {
    setBlocks(prev =>
      prev.map(b =>
        b.id === blockId
          ? { ...b, ...updates, _isDirty: true }
          : b
      )
    );
    markDirty();
  }, [markDirty]);

  const deleteBlock = useCallback((blockId: string) => {
    setBlocks(prev => prev.filter(b => b.id !== blockId));
    setSelectedBlockId(current => (current === blockId ? null : current));
    markDirty();
  }, [markDirty]);

  const reorderBlock = useCallback((blockId: string, newIndex: number, sectionId?: string | null) => {
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === blockId);
      if (idx === -1) return prev;

      const updated = [...prev];
      const [moved] = updated.splice(idx, 1);

      // Clamp newIndex
      const clampedIndex = Math.max(0, Math.min(newIndex, updated.length));
      updated.splice(clampedIndex, 0, {
        ...moved,
        section_id: sectionId !== undefined ? sectionId : moved.section_id,
        _isDirty: true,
      });

      // Re-assign display_orders sequentially within the same section_id group
      return updated.map((b, i) => ({ ...b, display_order: i }));
    });
    markDirty();
  }, [markDirty]);

  const reorderSection = useCallback((sectionId: string, newIndex: number) => {
    setSections(prev => {
      const idx = prev.findIndex(s => s.id === sectionId);
      if (idx === -1) return prev;
      const updated = [...prev];
      const [moved] = updated.splice(idx, 1);
      const clamped = Math.max(0, Math.min(newIndex, updated.length));
      updated.splice(clamped, 0, moved);
      // Re-assign display_order and persist each
      return updated.map((s, i) => {
        const newOrder = { ...s, display_order: i };
        updateFormSection(s.id, { display_order: i }).catch(() => {});
        return newOrder;
      });
    });
    markDirty();
  }, [markDirty]);

  return {
    form,
    setFormTitle,
    setFormDescription,
    setFormType,
    setFormCategory,
    setFormStatus,
    setFormTags,
    setFormSettings,
    setFormIsTemplate,
    setSubmissionConfig,
    setStartConfig,

    sections,
    addSection,
    updateSection,
    deleteSection,

    blocks,
    selectedBlockId,
    setSelectedBlockId,
    addBlock,
    addBlockGroup,
    addFollowUpPack,
    removeFollowUpPack,
    hasFollowUpPack,
    updateFollowUpTrigger,
    updateBlock,
    deleteBlock,
    reorderBlock,
    reorderSection,

    saveForm,
    publishForm,

    isLoading,
    isSaving,
    isDirty,
    error,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function formDataToMetadata(data: FormWithSections): FormMetadata {
  const settings = (data as any).settings as Record<string, unknown> | null | undefined;
  return {
    id: data.id,
    organization_id: data.organization_id,
    title: data.title,
    description: data.description || '',
    type: data.type,
    category: data.category || '',
    status: data.status as 'draft' | 'published' | 'archived',
    tags: data.tags || [],
    requires_approval: data.requires_approval,
    allow_anonymous: data.allow_anonymous,
    is_template: data.is_template ?? false,
    scoring_enabled: (settings?.scoring_enabled as boolean) ?? false,
    scoring_mode: (settings?.scoring_mode as 'pass_fail' | 'weighted' | 'section') ?? 'pass_fail',
    pass_threshold: (settings?.pass_threshold as number) ?? 70,
    submission_config: ((data as any).submission_config as SubmissionConfig | null) ?? {},
    start_config: (settings?.start_config as StartConfig | undefined) ?? undefined,
  };
}

function buildLocalBlocks(data: FormWithSections): LocalBlock[] {
  return (data.form_blocks || []).map((b: Record<string, unknown>) => ({
    id: b.id as string,
    form_id: b.form_id as string,
    section_id: (b.section_id as string | null) ?? null,
    block_type: ((b.type as string) || (b.block_type as string)) ?? '',
    label: (b.label as string) || '',
    description: b.description as string | undefined,
    placeholder: b.placeholder as string | undefined,
    options: Array.isArray(b.options) ? b.options as string[] : undefined,
    validation_rules: b.validation_rules as Record<string, unknown> | undefined,
    conditional_logic: b.conditional_logic,
    settings: b.settings as Record<string, unknown> | undefined,
    is_required: (b.is_required as boolean) || false,
    display_order: (b.display_order as number) || 0,
    guideline_text: b.guideline_text as string | undefined,
    guideline_attachments: Array.isArray(b.guideline_attachments) ? b.guideline_attachments as Array<{ url: string; type: string; name: string }> : undefined,
    _isNew: false,
    _isDirty: false,
  }));
}

function blockTypeLabel(blockType: string): string {
  const labels: Record<string, string> = {
    text: 'Short Answer',
    textarea: 'Long Answer',
    number: 'Number',
    date: 'Date',
    time: 'Time',
    radio: 'Multiple Choice',
    checkboxes: 'Checkboxes',
    dropdown: 'Dropdown',
    yes_no: 'Yes / No',
    rating: 'Rating',
    file: 'File Upload',
    signature: 'Signature',
    slider: 'Slider',
    location: 'Location',
    photo: 'Photo',
    instruction: 'Instruction',
    divider: 'Divider',
    store_lookup: 'Store',
    role_lookup: 'Role',
    person_lookup: 'Person',
  };
  return labels[blockType] || blockType;
}

function hasChoices(blockType: string): boolean {
  return ['radio', 'checkboxes', 'dropdown'].includes(blockType);
}

// ============================================================================
// SCAFFOLD BLOCKS — pre-populate new forms based on type
// ============================================================================

interface ScaffoldBlockDef {
  block_type: string;
  label: string;
  is_required: boolean;
  description?: string;
  options?: string[];
}

const SCAFFOLD_MAP: Record<string, ScaffoldBlockDef[]> = {
  inspection: [
    { block_type: 'instruction', label: 'Complete this inspection by answering each item. Add photos for any issues found.', is_required: false },
    { block_type: 'yes_no', label: 'Area is clean and organized', is_required: true },
    { block_type: 'yes_no', label: 'Equipment is functioning properly', is_required: true },
    { block_type: 'yes_no', label: 'Safety standards are met', is_required: true },
    { block_type: 'photo', label: 'Photo evidence', is_required: false },
    { block_type: 'textarea', label: 'Additional notes or observations', is_required: false },
  ],
  audit: [
    { block_type: 'instruction', label: 'Complete this audit checklist. Rate each item and provide detailed notes.', is_required: false },
    { block_type: 'rating', label: 'Overall compliance rating', is_required: true },
    { block_type: 'yes_no', label: 'Documentation is up to date', is_required: true },
    { block_type: 'yes_no', label: 'Procedures are being followed', is_required: true },
    { block_type: 'textarea', label: 'Findings and recommendations', is_required: false },
  ],
  'sign-off': [
    { block_type: 'instruction', label: 'Please read the above document carefully, then acknowledge and sign below.', is_required: false },
    { block_type: 'checkboxes', label: 'I have read and understand this document', is_required: true, options: ['I acknowledge'] },
    { block_type: 'signature', label: 'Signature', is_required: true },
  ],
  'ojt-checklist': [
    { block_type: 'instruction', label: 'Trainer: observe the trainee performing each task and rate their competency.', is_required: false },
    { block_type: 'yes_no', label: 'Trainee demonstrated understanding of procedures', is_required: true },
    { block_type: 'rating', label: 'Trainee competency level', is_required: true },
    { block_type: 'yes_no', label: 'Trainee completed task independently', is_required: true },
    { block_type: 'textarea', label: 'Trainer notes and feedback', is_required: false },
    { block_type: 'signature', label: 'Trainer signature', is_required: true },
  ],
  survey: [
    { block_type: 'instruction', label: 'We value your feedback. Please answer the following questions.', is_required: false },
    { block_type: 'radio', label: 'How would you rate your overall experience?', is_required: true, options: ['Excellent', 'Good', 'Average', 'Below Average', 'Poor'] },
    { block_type: 'rating', label: 'How likely are you to recommend this to others?', is_required: true },
    { block_type: 'textarea', label: 'What could we improve?', is_required: false },
  ],
};

function getScaffoldBlocks(formType: string, formId: string): LocalBlock[] {
  const defs = SCAFFOLD_MAP[formType];
  if (!defs) return [];

  return defs.map((def, index) => ({
    id: crypto.randomUUID(),
    _isNew: true,
    _isDirty: true,
    form_id: formId,
    section_id: null,
    block_type: def.block_type,
    label: def.label,
    description: def.description,
    is_required: def.is_required,
    display_order: index,
    options: def.options ?? (hasChoices(def.block_type) ? ['Option 1', 'Option 2', 'Option 3'] : undefined),
  }));
}
