// ============================================================================
// STATE VARIANT COMPONENTS - Central Export
// ============================================================================

// Main wizard and editor components
export { StateVariantWizard, US_STATES } from './StateVariantWizard';
export type { StateVariantWizardProps } from './StateVariantWizard';

export { VariantEditorPage } from './VariantEditorPage';
export { VariantEditorLayout } from './VariantEditorLayout';

// Sub-components
export { RolePillsSelector } from './RolePillsSelector';
export { ResearchPlanPreview } from './ResearchPlanPreview';
export { ProgressZapScreen } from './ProgressZapScreen';
export { DiffRenderer } from './DiffRenderer';
export type { ViewMode } from './DiffRenderer';
export { ChangeNotesRail } from './ChangeNotesRail';
export { LightningBoltPanel } from './LightningBoltPanel';

// Re-export types from CRUD for convenience
export type {
  VariantDraft,
  DiffOp,
  ChangeNote,
  CitationRef,
  DraftStatus,
  ChangeNoteStatus,
} from '../../lib/crud/trackRelationships';
