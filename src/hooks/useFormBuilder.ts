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
  type FormSection,
  type FormWithSections,
} from '../lib/crud/forms';
import { createFormVersion } from '../lib/crud/formVersions';

// ============================================================================
// TYPES
// ============================================================================

export interface FormMetadata {
  id: string;
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
  pass_threshold?: number;
}

export interface FormSettings {
  requires_approval: boolean;
  allow_anonymous: boolean;
  scoring_enabled?: boolean;
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
}

export interface UseFormBuilderProps {
  formId?: string;
  orgId: string;
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

  // Sections state
  sections: FormSection[];
  addSection: () => Promise<void>;
  updateSection: (sectionId: string, updates: Partial<FormSection>) => void;
  deleteSection: (sectionId: string) => Promise<void>;

  // Blocks state
  blocks: LocalBlock[];
  selectedBlockId: string | null;
  setSelectedBlockId: (id: string | null) => void;
  addBlock: (blockType: string, sectionId?: string | null, afterBlockId?: string) => void;
  updateBlock: (blockId: string, updates: Partial<LocalBlock>) => void;
  deleteBlock: (blockId: string) => void;
  reorderBlock: (blockId: string, newIndex: number, sectionId?: string | null) => void;

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

export function useFormBuilder({ formId, orgId }: UseFormBuilderProps): UseFormBuilderReturn {
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

  // Mark dirty and schedule auto-save
  const markDirty = useCallback(() => {
    setIsDirty(true);
    isDirtyRef.current = true;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      saveFormRef.current?.();
    }, 3000);
  }, []);

  // ============================================================================
  // SAVE
  // ============================================================================

  const saveForm = useCallback(async () => {
    if (!form) return;
    setIsSaving(true);
    try {
      // Save form metadata
      await updateForm(form.id, {
        title: form.title,
        description: form.description,
        type: form.type as 'ojt-checklist' | 'inspection' | 'audit' | 'survey',
        category: form.category,
        status: form.status,
        requires_approval: form.requires_approval,
        allow_anonymous: form.allow_anonymous,
        is_template: form.is_template,
        settings: {
          scoring_enabled: form.scoring_enabled ?? false,
          pass_threshold: form.pass_threshold ?? 70,
        },
      } as any);

      // Save dirty/new blocks — filter to persisted IDs only (no temp IDs)
      const persistedBlocks = blocks.filter(b => !b._isNew);
      const newBlocks = blocks.filter(b => b._isNew);

      const blocksToUpsert = [
        ...persistedBlocks.map(b => ({
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
          display_order: b.display_order,
        })),
        ...newBlocks.map(b => ({
          // No id — will be INSERTed
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
          display_order: b.display_order,
        })),
      ];

      await bulkUpsertFormBlocks(form.id, blocksToUpsert);

      // Always re-fetch so newly-inserted blocks get real DB IDs.
      // Merge carefully: keep the live in-memory version for existing blocks
      // (the user may be actively editing them) and only use the DB version
      // for blocks that were _isNew (they now have real IDs in the response).
      // This avoids stamping stale state onto blocks being typed into.
      const refreshed = await getFormWithSections(form.id, orgId);
      if (refreshed) {
        const refreshedBlocks = buildLocalBlocks(refreshed);
        setBlocks(prev => {
          // Index current in-memory blocks by real DB ID (exclude temp _isNew IDs)
          const currentMap = new Map(prev.filter(b => !b._isNew).map(b => [b.id, b]));
          // For each DB block: prefer the live in-memory version if one exists
          // (preserves unsaved typing); fall back to DB version for new blocks.
          return refreshedBlocks.map(rb => currentMap.get(rb.id) ?? rb);
        });
      }

      setIsDirty(false);
      isDirtyRef.current = false;
    } catch (err) {
      console.error('Error saving form:', err);
      setError(err instanceof Error ? err.message : 'Failed to save form');
      // Keep isDirty so the user knows a save failure occurred and can retry
      setIsDirty(true);
      isDirtyRef.current = true;
    } finally {
      setIsSaving(false);
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
            setBlocks(buildLocalBlocks(data));
          } else {
            setError('Form not found');
          }
        } else {
          // Create a new form immediately so we always have a real DB ID
          const newForm = await createForm(
            { title: 'Untitled Form', type: 'inspection' },
            orgId
          );
          if (cancelled) return;
          setForm({
            id: newForm.id,
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
          setBlocks([]);
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
  }, [formId, orgId]);

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
        pass_threshold: settings.pass_threshold ?? prev.pass_threshold,
      };
    });
    markDirty();
  }, [markDirty]);

  const setFormIsTemplate = useCallback((isTemplate: boolean) => {
    setForm(prev => prev ? { ...prev, is_template: isTemplate } : prev);
    markDirty();
  }, [markDirty]);

  // ============================================================================
  // SECTIONS
  // ============================================================================

  const addSection = useCallback(async () => {
    if (!form) return;
    try {
      const newSection = await createFormSection(
        form.id,
        {
          title: 'New Section',
          display_order: sections.length,
        },
        orgId
      );
      setSections(prev => [...prev, newSection]);
    } catch (err) {
      console.error('Error creating section:', err);
      setError(err instanceof Error ? err.message : 'Failed to create section');
    }
  }, [form, sections, orgId]);

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
        id: `new-${crypto.randomUUID()}`,
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

    sections,
    addSection,
    updateSection,
    deleteSection,

    blocks,
    selectedBlockId,
    setSelectedBlockId,
    addBlock,
    updateBlock,
    deleteBlock,
    reorderBlock,

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
    pass_threshold: (settings?.pass_threshold as number) ?? 70,
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
  };
  return labels[blockType] || blockType;
}

function hasChoices(blockType: string): boolean {
  return ['radio', 'checkboxes', 'dropdown'].includes(blockType);
}
