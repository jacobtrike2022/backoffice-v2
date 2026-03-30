import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Separator } from '../ui/separator';
import { Badge } from '../ui/badge';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Switch } from '../ui/switch';
import { TagSelectorDialog } from '../TagSelectorDialog';
import { VersionHistory } from './VersionHistory';
import { AssociatedPlaylists } from './AssociatedPlaylists';
import { TrackRelationships } from './TrackRelationships';
import { VersionDecisionModal } from './VersionDecisionModal';
import { UnsavedChangesDialog } from '../UnsavedChangesDialog';
import { CheckpointPreviewModal } from './CheckpointPreviewModal';
import {
  ArrowLeft,
  Save,
  Eye,
  Shield,
  Upload,
  Image as ImageIcon,
  X,
  Plus,
  CheckCircle,
  GripVertical,
  Trash2,
  Edit,
  Calendar,
  Clock,
  Tag as TagIcon,
  Lock,
  History,
  ChevronLeft,
  Zap,
  MoreVertical,
  Copy,
  Archive,
  GitBranch,
  Download
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import { toast } from 'sonner@2.0.3';
import { downloadKbTrackAsPdf } from '../../lib/utils/kbPdfExport';
import * as crud from '../../lib/crud';
import * as trackRelCrud from '../../lib/crud/trackRelationships';
import * as tagsCrud from '../../lib/crud/tags';
import { AIGenerateCheckpointModal } from './AIGenerateCheckpointModal';
import { supabase } from '../../lib/supabase';

interface Answer {
  id: string;
  text: string;
  isCorrect: boolean;
}

interface Question {
  id: string;
  question: string;
  answers: Answer[];
  explanation?: string;
}

interface CheckpointEditorProps {
  onClose?: () => void;
  trackId?: string; // If editing existing checkpoint
  track?: any; // Direct track object for content library view
  isNewContent?: boolean;
  currentRole?: string;
  onBack?: () => void; // For content library view
  onUpdate?: () => void; // For content library view
  onVersionClick?: (versionTrackId: string) => void; // Optional version navigation callback
  isSuperAdminAuthenticated?: boolean;
  onNavigateToPlaylist?: (playlistId: string) => void;
  registerUnsavedChangesCheck?: (checkFn: (() => boolean) | null) => void; // Register unsaved changes check
  onArchive?: (track: any) => void; // Archive callback
  onDuplicate?: (track: any) => void; // Duplicate callback
  onCreateVariant?: (track: any) => void; // Create variant callback
}

export function CheckpointEditor({ onClose, trackId, track, isNewContent = false, currentRole, onBack, onUpdate, onVersionClick, isSuperAdminAuthenticated, onNavigateToPlaylist, registerUnsavedChangesCheck, onArchive, onDuplicate, onCreateVariant }: CheckpointEditorProps) {
  const { t } = useTranslation();
  const [isEditMode, setIsEditMode] = useState(isNewContent); // Start in edit mode only for new content
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [existingTrack, setExistingTrack] = useState<any>(null);
  const [hasCreatedTrack, setHasCreatedTrack] = useState(false); // Prevent double-save after creating new track
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [passingScore, setPassingScore] = useState('70');
  const [timeLimit, setTimeLimit] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isTagSelectorOpen, setIsTagSelectorOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [isSystemContentLocal, setIsSystemContentLocal] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([
    {
      id: '1',
      question: '',
      answers: [
        { id: 'a1', text: '', isCorrect: false },
        { id: 'a2', text: '', isCorrect: false }
      ]
    }
  ]);
  const [showPreview, setShowPreview] = useState(false);
  const [showLearnerPreview, setShowLearnerPreview] = useState(false);

  // Versioning state
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<any>(null);
  
  // Unsaved changes dialog
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  
  // AI Generation modal
  const [showAIModal, setShowAIModal] = useState(false);

  // Actions menu popover state
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);

  // Track source relationships (for AI-generated checkpoints - supports multiple sources)
  const [sourceTrackIds, setSourceTrackIds] = useState<string[]>([]);
  
  // Track initial state for unsaved changes detection
  const [initialState, setInitialState] = useState<any>(null);
  
  // Ref to track if we just saved (to bypass unsaved changes check)
  const justSavedRef = useRef(false);

  // Determine the current track ID - either from props or from track object
  const currentTrackId = trackId || track?.id;
  const isSuperAdmin = isSuperAdminAuthenticated || currentRole === 'Trike Super Admin';
  const isSystemContent = existingTrack?.is_system_content && !isSuperAdmin;

  // Load existing checkpoint if editing
  useEffect(() => {
    const loadFromTrackObject = async () => {
      // Load directly from passed track object
      setExistingTrack(track);
      setTitle(track.title || '');
      setDescription(track.description || '');

      // Load tags from junction table (source of truth)
      let tagNames: string[] = track.tags || [];
      if (track.id) {
        try {
          tagNames = await tagsCrud.getTrackTagNames(track.id);
          console.log(`🏷️ Loaded ${tagNames.length} tags from track_tags junction table`);
        } catch (tagError) {
          console.warn('Could not fetch tags from junction table, falling back to track.tags:', tagError);
          tagNames = track.tags || [];
        }
      }
      setTags(tagNames);
      setThumbnailUrl(track.thumbnail_url || '');
      setIsSystemContentLocal(track.is_system_content || false);

      // Parse checkpoint data from transcript field
      let parsedQuestions: any[] = questions;
      let parsedPassingScore = '70';
      let parsedTimeLimit = '';
      if (track.transcript) {
        try {
          const checkpointData = JSON.parse(track.transcript);
          if (checkpointData.questions) {
            setQuestions(checkpointData.questions);
            parsedQuestions = checkpointData.questions;
          }
          if (checkpointData.passingScore) {
            setPassingScore(checkpointData.passingScore.toString());
            parsedPassingScore = checkpointData.passingScore.toString();
          }
          if (checkpointData.timeLimit != null) {
            setTimeLimit(checkpointData.timeLimit.toString());
            parsedTimeLimit = checkpointData.timeLimit.toString();
          } else {
            setTimeLimit('');
            parsedTimeLimit = '';
          }
        } catch (e) {
          console.error('Error parsing checkpoint data:', e);
        }
      }

      // Save initial state
      setInitialState({
        title: track.title || '',
        description: track.description || '',
        tags: tagNames,
        thumbnailUrl: track.thumbnail_url || '',
        questions: parsedQuestions,
        passingScore: parsedPassingScore,
        timeLimit: parsedTimeLimit,
      });
    };

    if (track) {
      loadFromTrackObject();
    } else if (trackId) {
      loadCheckpoint();
    } else if (isNewContent) {
      // For NEW checkpoints, set initial state to empty defaults
      setInitialState({
        title: '',
        description: '',
        tags: [],
        thumbnailUrl: '',
        questions: [
          {
            id: '1',
            question: '',
            answers: [
              { id: 'a1', text: '', isCorrect: false },
              { id: 'a2', text: '', isCorrect: false }
            ]
          }
        ],
        passingScore: '70',
        timeLimit: '',
      });
    }
  }, [trackId, track, isNewContent]);

  const loadCheckpoint = async () => {
    if (!trackId) return;

    setIsLoading(true);
    try {
      const track = await crud.getTrackById(trackId);
      setExistingTrack(track);
      setTitle(track.title || '');
      setDescription(track.description || '');

      // Load tags from junction table (source of truth)
      let tagNames: string[] = track.tags || [];
      try {
        tagNames = await tagsCrud.getTrackTagNames(trackId);
        console.log(`🏷️ Loaded ${tagNames.length} tags from track_tags junction table`);
      } catch (tagError) {
        console.warn('Could not fetch tags from junction table, falling back to track.tags:', tagError);
        tagNames = track.tags || [];
      }
      setTags(tagNames);
      setThumbnailUrl(track.thumbnail_url || '');
      setIsSystemContentLocal(track.is_system_content || false);

      // Parse checkpoint data from transcript field (we'll store JSON there)
      let parsedQuestions: any[] = questions;
      let parsedPassingScore = '70';
      let parsedTimeLimit = '';
      if (track.transcript) {
        try {
          const checkpointData = JSON.parse(track.transcript);
          if (checkpointData.questions) {
            setQuestions(checkpointData.questions);
            parsedQuestions = checkpointData.questions;
          }
          if (checkpointData.passingScore) {
            setPassingScore(checkpointData.passingScore.toString());
            parsedPassingScore = checkpointData.passingScore.toString();
          }
          if (checkpointData.timeLimit != null) {
            setTimeLimit(checkpointData.timeLimit.toString());
            parsedTimeLimit = checkpointData.timeLimit.toString();
          } else {
            setTimeLimit('');
            parsedTimeLimit = '';
          }
        } catch (e) {
          console.error('Error parsing checkpoint data:', e);
        }
      }

      // Save initial state
      setInitialState({
        title: track.title || '',
        description: track.description || '',
        tags: tagNames,
        thumbnailUrl: track.thumbnail_url || '',
        isSystemContent: track.is_system_content || false,
        questions: parsedQuestions,
        passingScore: parsedPassingScore,
        timeLimit: parsedTimeLimit,
      });
    } catch (error: any) {
      console.error('Error loading checkpoint:', error);
      toast.error(t('contentAuthoring.failedLoadCheckpoint'));
    } finally {
      setIsLoading(false);
    }
  };

  // Check if there are unsaved changes
  const hasUnsavedChanges = () => {
    console.log('🔍 hasUnsavedChanges called - isEditMode:', isEditMode, 'initialState:', !!initialState, 'justSaved:', justSavedRef.current);
    
    // If we just saved, immediately return false (bypass check)
    if (justSavedRef.current) {
      console.log('✅ Just saved, returning false');
      return false;
    }
    
    if (!isEditMode) {
      console.log('❌ Not in edit mode, returning false');
      return false;
    }
    
    // If no initial state, check if there's ANY content worth saving
    if (!initialState) {
      console.log('⚠️ No initial state, checking for ANY content');
      // For new checkpoints, check if user has added ANY meaningful content
      const hasContent = 
        title.trim() !== '' ||
        description.trim() !== '' ||
        tags.length > 0 ||
        thumbnailUrl !== '' ||
        questions.some(q => q.question?.trim() || q.answers.some(a => a.text?.trim()));
      
      console.log('📊 Content check:', { 
        hasTitle: title.trim() !== '', 
        hasDescription: description.trim() !== '',
        hasTags: tags.length > 0,
        hasThumbnail: thumbnailUrl !== '',
        hasQuestions: questions.some(q => q.question?.trim() || q.answers.some(a => a.text?.trim())),
        questionCount: questions.length,
        result: hasContent
      });
      
      return hasContent;
    }
    
    const arraysEqual = (a: any[], b: any[]) => {
      if (a.length !== b.length) return false;
      return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
    };
    
    const hasChanges = (
      title !== initialState.title ||
      description !== initialState.description ||
      !arraysEqual(tags, initialState.tags) ||
      thumbnailUrl !== initialState.thumbnailUrl ||
      isSystemContentLocal !== initialState.isSystemContent ||
      passingScore !== initialState.passingScore ||
      timeLimit !== initialState.timeLimit ||
      JSON.stringify(questions) !== JSON.stringify(initialState.questions)
    );
    
    console.log('✅ Has changes:', hasChanges);
    return hasChanges;
  };

  // Warn user before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isEditMode, initialState, title, description, tags, thumbnailUrl, passingScore, timeLimit, questions]);

  // Register unsaved changes check with parent
  useEffect(() => {
    if (registerUnsavedChangesCheck) {
      if (isEditMode) {
        registerUnsavedChangesCheck(hasUnsavedChanges);
      } else {
        registerUnsavedChangesCheck(null);
      }
    }
    
    // Cleanup on unmount
    return () => {
      if (registerUnsavedChangesCheck) {
        registerUnsavedChangesCheck(null);
      }
    };
  }, [isEditMode, registerUnsavedChangesCheck, hasUnsavedChanges]);

  // Auto-save draft 3 seconds after any change (debounced)
  useEffect(() => {
    if (!isEditMode || !hasUnsavedChanges() || isSystemContent || !trackId) {
      return;
    }
    
    console.log('⏰ Auto-save will trigger in 3 seconds...');
    const autoSaveTimer = setTimeout(() => {
      console.log('💾 Auto-saving checkpoint draft after changes...');
      handleSaveDraft(true); // Pass silent=true to avoid toast spam
    }, 3000); // 3 seconds after last change
    
    return () => clearTimeout(autoSaveTimer);
  }, [isEditMode, title, description, questions, passingScore, timeLimit, tags, thumbnailUrl]);

  const handleAIGenerate = async (generatedQuestions: any[], sourceInfo: {
    trackIds: string[];
    trackTitles: string[];
    factCount: number;
    thumbnailUrl?: string;
    metadata?: { suggestedTitle: string; suggestedDescription: string };
    trackId: string;
    trackTitle: string;
  }) => {
    const trackCount = sourceInfo.trackIds?.length || 1;
    const trackDescription = trackCount > 1
      ? `${trackCount} source tracks`
      : sourceInfo.trackTitle;

    console.log('🤖 AI generated', generatedQuestions.length, 'questions from', trackDescription);

    // Store the source track IDs for relationship tracking (supports multiple)
    const trackIdsToStore = sourceInfo.trackIds || [sourceInfo.trackId];
    setSourceTrackIds(trackIdsToStore);
    console.log('📎 Source track IDs stored for relationships:', trackIdsToStore);

    // Check if there are existing questions with content
    const hasExistingQuestions = questions.some(q => q.question?.trim());

    if (hasExistingQuestions) {
      const shouldReplace = window.confirm(
        `You have ${questions.length} existing question(s). Replace all with ${generatedQuestions.length} AI-generated questions?`
      );

      if (shouldReplace) {
        setQuestions(generatedQuestions);
      } else {
        // Append to existing
        setQuestions([...questions, ...generatedQuestions]);
      }
    } else {
      // No existing questions, just replace
      setQuestions(generatedQuestions);
    }

    // Auto-populate title and description if metadata provided
    if (sourceInfo.metadata) {
      // Only auto-populate if current values are empty
      if (!title.trim()) {
        setTitle(sourceInfo.metadata.suggestedTitle);
      }
      if (!description.trim()) {
        setDescription(sourceInfo.metadata.suggestedDescription);
      }
    }

    // Auto-copy thumbnail from source track if available and current checkpoint has no thumbnail
    if (sourceInfo.thumbnailUrl && !thumbnailUrl) {
      console.log('📸 Copying thumbnail from source track:', sourceInfo.thumbnailUrl);
      setThumbnailUrl(sourceInfo.thumbnailUrl);
      toast.success(t('contentAuthoring.thumbnailCopiedFromSource'), {
        description: t('contentAuthoring.thumbnailCopiedDesc'),
        duration: 3000
      });
    }

    // Inherit tags from source tracks (excluding Content Type and KB Category tags)
    // Only inherit if checkpoint doesn't already have tags
    if (tags.length === 0) {
      try {
        // Get parent tag IDs that should be excluded from inheritance:
        // - "Content Type" - checkpoints are a different type than source
        // - "KB Category" - checkpoints are excluded from Knowledge Base
        const { data: excludedParents } = await supabase
          .from('tags')
          .select('id, name')
          .in('name', ['Content Type', 'KB Category']);

        const excludedParentIds = new Set(excludedParents?.map(p => p.id) || []);

        // Fetch tags from all source tracks
        const sourceTrackIdsToFetch = sourceInfo.trackIds || [sourceInfo.trackId];
        const { data: sourceTracks } = await supabase
          .from('tracks')
          .select('id, tags')
          .in('id', sourceTrackIdsToFetch);

        // Collect unique tags from all source tracks
        const allTagNames = new Set<string>();
        for (const sourceTrack of sourceTracks || []) {
          if (sourceTrack?.tags && Array.isArray(sourceTrack.tags)) {
            for (const tagName of sourceTrack.tags) {
              allTagNames.add(tagName);
            }
          }
        }

        const inheritedTagNames: string[] = [];

        // For each unique tag, look up its parent to filter out excluded categories
        for (const tagName of allTagNames) {
          // Skip system tags
          if (tagName.startsWith('system:')) continue;

          // Look up the tag to check its parent
          const { data: tagData } = await supabase
            .from('tags')
            .select('id, name, parent_id')
            .eq('name', tagName)
            .maybeSingle();

          if (tagData) {
            // Exclude if parent is "Content Type" or "KB Category"
            if (tagData.parent_id && excludedParentIds.has(tagData.parent_id)) {
              console.log(`🚫 Excluding tag (Content Type/KB Category): ${tagName}`);
              continue;
            }
            inheritedTagNames.push(tagName);
          } else {
            // Tag not found in tags table, include it anyway (might be a custom tag)
            inheritedTagNames.push(tagName);
          }
        }

        if (inheritedTagNames.length > 0) {
          const trackCountDesc = sourceTrackIdsToFetch.length > 1
            ? `${sourceTrackIdsToFetch.length} source tracks`
            : 'source content';
          console.log('🏷️ Inheriting tags from source tracks:', inheritedTagNames);
          setTags(inheritedTagNames);
          toast.success(`Inherited ${inheritedTagNames.length} tag(s) from ${trackCountDesc}`, {
            description: 'Content Type and KB Category tags were excluded.',
            duration: 3000
          });
        }
      } catch (error) {
        console.error('Error inheriting tags from source tracks:', error);
        // Non-blocking - continue without tags if fetch fails
      }
    }

    // Scroll to first question after a brief delay
    setTimeout(() => {
      const firstQuestion = document.querySelector('[data-question-index="0"]');
      if (firstQuestion) {
        firstQuestion.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);

    toast.success(t('contentAuthoring.aiQuestionsAdded', { count: generatedQuestions.length }), {
      description: t('contentAuthoring.aiQuestionsAutoSave')
    });
  };

  const addQuestion = () => {
    const newQuestion: Question = {
      id: Date.now().toString(),
      question: '',
      answers: [
        { id: `${Date.now()}-a1`, text: '', isCorrect: false },
        { id: `${Date.now()}-a2`, text: '', isCorrect: false }
      ],
      explanation: ''
    };
    setQuestions([...questions, newQuestion]);
  };

  const removeQuestion = (questionId: string) => {
    if (questions.length === 1) {
      toast.error(t('contentAuthoring.checkpointNeedsQuestion'));
      return;
    }
    setQuestions(questions.filter(q => q.id !== questionId));
  };

  const updateQuestion = (questionId: string, field: string, value: any) => {
    setQuestions(questions.map(q => 
      q.id === questionId ? { ...q, [field]: value } : q
    ));
  };

  const addAnswer = (questionId: string) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId) {
        return {
          ...q,
          answers: [
            ...q.answers,
            { id: `${Date.now()}-a${q.answers.length + 1}`, text: '', isCorrect: false }
          ]
        };
      }
      return q;
    }));
  };

  const removeAnswer = (questionId: string, answerId: string) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId) {
        if (q.answers.length <= 2) {
          toast.error(t('contentAuthoring.questionNeedsAnswers'));
          return q;
        }
        return {
          ...q,
          answers: q.answers.filter(a => a.id !== answerId)
        };
      }
      return q;
    }));
  };

  const updateAnswer = (questionId: string, answerId: string, text: string) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId) {
        return {
          ...q,
          answers: q.answers.map(a => 
            a.id === answerId ? { ...a, text } : a
          )
        };
      }
      return q;
    }));
  };

  const setCorrectAnswer = (questionId: string, answerId: string) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId) {
        return {
          ...q,
          answers: q.answers.map(a => ({
            ...a,
            isCorrect: a.id === answerId
          }))
        };
      }
      return q;
    }));
  };

  // Handle back button with unsaved changes check
  const handleBackWithCheck = () => {
    const backFn = onBack || onClose;
    if (!backFn) return;
    
    console.log('🔍 handleBackWithCheck called', {
      isEditMode,
      hasChanges: hasUnsavedChanges(),
      initialState,
      currentState: { title, description, tags, thumbnailUrl, passingScore, timeLimit, questions }
    });
    
    if (hasUnsavedChanges()) {
      setPendingNavigation(() => backFn);
      setShowUnsavedDialog(true);
    } else {
      backFn();
    }
  };

  // Handle discard from dialog
  const handleDiscardChanges = () => {
    setShowUnsavedDialog(false);
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
  };

  // Handle save and navigate
  const handleSaveAndNavigate = async () => {
    if (isSystemContent) {
      toast.error(t('contentAuthoring.cannotEditTrikeLibrary'));
      setShowUnsavedDialog(false);
      return;
    }

    // Set saving state BEFORE validation to prevent double-clicks
    setIsSaving(true);

    if (!validateCheckpoint()) {
      setShowUnsavedDialog(false);
      setIsSaving(false);
      return;
    }

    try {
      const checkpointData = {
        questions,
        passingScore: parseInt(passingScore),
        timeLimit: timeLimit ? parseInt(timeLimit) : null
      };

      // Calculate duration: use timeLimit if set (not empty/null), otherwise question count (0.5 min per question)
      const hasTimeLimit = timeLimit && typeof timeLimit === 'string' && timeLimit.trim() !== '';
      const calculatedDuration = hasTimeLimit
        ? parseInt(timeLimit)
        : Math.ceil(questions.length * 0.5);

      const trackData = {
        title,
        description,
        type: 'checkpoint' as const,
        transcript: JSON.stringify(checkpointData),
        duration_minutes: calculatedDuration,
        tags,
        thumbnail_url: thumbnailUrl,
        is_system_content: isSystemContentLocal
      };

      if (currentTrackId) {
        await crud.updateTrack({ id: currentTrackId, ...trackData });
        toast.success(t('contentAuthoring.changesSaved'));
      } else {
        await crud.createTrack({ ...trackData, status: 'draft' as const });
        toast.success(t('contentAuthoring.checkpointCreatedAsDraft'));
      }

      // Close dialog and navigate
      setShowUnsavedDialog(false);
      setIsSaving(false);
      
      if (pendingNavigation) {
        setTimeout(() => {
          if (pendingNavigation) {
            pendingNavigation();
            setPendingNavigation(null);
          }
        }, 100);
      }
    } catch (error: any) {
      console.error('Error saving checkpoint:', error);
      toast.error(t('contentAuthoring.failedSaveCheckpoint'));
      setShowUnsavedDialog(false);
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (currentTrackId) {
      // If editing existing, reload original data and exit edit mode
      setIsEditMode(false);
      if (track) {
        // Reload from track prop
        setTitle(track.title || '');
        setDescription(track.description || '');
        setTags(track.tags || []);
        setThumbnailUrl(track.thumbnail_url || '');
        
        if (track.transcript) {
          try {
            const checkpointData = JSON.parse(track.transcript);
            if (checkpointData.questions) setQuestions(checkpointData.questions);
            if (checkpointData.passingScore) setPassingScore(checkpointData.passingScore.toString());
            if (checkpointData.timeLimit != null) {
            setTimeLimit(checkpointData.timeLimit.toString());
          } else {
            setTimeLimit('');
          }
          } catch (e) {
            console.error('Error parsing checkpoint data:', e);
          }
        }
      } else {
        loadCheckpoint();
      }
    } else {
      // If creating new, go back
      handleBackWithCheck();
    }
  };

  // Handle save draft without navigation
  const handleSaveDraft = async (silent = false) => {
    if (isSystemContent) {
      if (!silent) toast.error(t('contentAuthoring.cannotEditTrikeLibrary'));
      return;
    }

    // Prevent double-save if we've already created a track and are waiting for navigation
    if (hasCreatedTrack && !currentTrackId) {
      console.log('⚠️ Track already created, waiting for navigation...');
      return;
    }

    // Set saving state BEFORE validation to prevent double-clicks
    setIsSaving(true);

    if (!validateCheckpoint()) {
      setIsSaving(false);
      return;
    }

    let willNavigateAway = false;

    try {
      const checkpointData = {
        questions,
        passingScore: parseInt(passingScore),
        timeLimit: timeLimit ? parseInt(timeLimit) : null
      };

      // Calculate duration: use timeLimit if set (not empty/null), otherwise question count (0.5 min per question)
      const hasTimeLimit = timeLimit && typeof timeLimit === 'string' && timeLimit.trim() !== '';
      const calculatedDuration = hasTimeLimit
        ? parseInt(timeLimit)
        : Math.ceil(questions.length * 0.5);

      const trackData = {
        title,
        description,
        type: 'checkpoint' as const,
        transcript: JSON.stringify(checkpointData),
        duration_minutes: calculatedDuration,
        tags,
        thumbnail_url: thumbnailUrl,
        is_system_content: isSystemContentLocal
      };

      if (currentTrackId) {
        // Detect if this is a version-triggering change
        const hasVersionTriggeringChanges = 
          title !== initialState?.title ||
          description !== initialState?.description ||
          JSON.stringify(questions) !== JSON.stringify(initialState?.questions) ||
          passingScore !== initialState?.passingScore ||
          timeLimit !== initialState?.timeLimit;

        if (hasVersionTriggeringChanges && existingTrack?.status === 'published') {
          console.log('🔍 Version-triggering changes detected for published track, checking playlists...');
          const stats = await crud.getTrackAssignmentStats(currentTrackId);
          console.log('🔍 Assignment stats:', stats);
          
          // Only trigger versioning if track is in at least one playlist
          if (stats.playlistCount > 0) {
            console.log('🔔 Track is in playlists, showing version decision modal. Stats:', stats);
            setPendingChanges(trackData);
            setIsVersionModalOpen(true);
            setIsSaving(false);
            return;
          } else {
            console.log('✅ No playlists found - saving directly without versioning');
          }
        }

        await crud.updateTrack({ id: currentTrackId, ...trackData });
        if (!silent) toast.success(t('contentAuthoring.changesSaved'));
        
        // Update initial state to reflect saved state
        setInitialState({
          title,
          description,
          tags,
          thumbnailUrl,
          questions,
          passingScore,
          timeLimit,
        });
        
        // Exit edit mode to show view mode
        setIsEditMode(false);
        
        // Refresh the track data
        if (onUpdate) {
          await onUpdate();
        }
      } else {
        // Creating new checkpoint - we'll navigate away, so keep button disabled
        willNavigateAway = true;
        
        const newTrack = await crud.createTrack({ ...trackData, status: 'draft' as const });
        if (!silent) toast.success(t('contentAuthoring.checkpointCreatedAsDraft'));
        
        // Mark that we've created a track to prevent double-save
        setHasCreatedTrack(true);
        
        // Create track relationships if this checkpoint was AI-generated from source(s)
        if (sourceTrackIds.length > 0) {
          console.log('📎 Creating track relationships for', sourceTrackIds.length, 'source track(s)');
          for (const srcTrackId of sourceTrackIds) {
            try {
              console.log('📎 Creating track relationship: source=' + srcTrackId + ', derived=' + newTrack.id);
              await trackRelCrud.createTrackRelationship(srcTrackId, newTrack.id, 'source');
              console.log('✅ Track relationship created successfully for source:', srcTrackId);
            } catch (relError: any) {
              console.error('❌ Failed to create track relationship for source ' + srcTrackId + ':', relError);
              // Don't block the save - relationship is nice-to-have
            }
          }
          console.log('✅ All track relationships created');
        }
        
        // Mark that we just saved (before state updates) to bypass unsaved changes check
        justSavedRef.current = true;
        
        // Update initial state to reflect saved state
        setInitialState({
          title,
          description,
          tags,
          thumbnailUrl,
          questions,
          passingScore,
          timeLimit,
        });
        
        // Unregister unsaved changes check before navigating (track is already saved)
        if (registerUnsavedChangesCheck) {
          registerUnsavedChangesCheck(null);
        }
        
        // For new content creation, close the editor and return to library
        // Keep button disabled during navigation
        const backFn = onBack || onClose;
        if (backFn) {
          // Use setTimeout to ensure state updates have propagated before navigation
          setTimeout(() => {
            backFn();
            // Reset the flag after navigation completes
            setTimeout(() => {
              justSavedRef.current = false;
            }, 100);
          }, 0);
        }
        
        // Safety timeout: re-enable button after 2 seconds if navigation didn't happen
        setTimeout(() => {
          setIsSaving(false);
        }, 2000);
      }
    } catch (error: any) {
      console.error('Error saving checkpoint:', error);
      toast.error(t('contentAuthoring.failedSaveCheckpoint'));
      // Reset flags on error so user can retry
      if (hasCreatedTrack && !currentTrackId) {
        setHasCreatedTrack(false);
      }
      justSavedRef.current = false;
    } finally {
      // Only re-enable button if we're NOT navigating away
      if (!willNavigateAway) {
        setIsSaving(false);
      }
      // If navigating away, keep button disabled to prevent double-clicks
    }
  };

  const validateCheckpoint = () => {
    if (!title.trim()) {
      toast.error(t('contentAuthoring.titleRequiredError'));
      return false;
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question.trim()) {
        toast.error(t('contentAuthoring.questionEmptyError', { number: i + 1 }));
        return false;
      }

      const hasCorrectAnswer = q.answers.some(a => a.isCorrect);
      if (!hasCorrectAnswer) {
        toast.error(t('contentAuthoring.questionNeedsCorrectAnswer', { number: i + 1 }));
        return false;
      }

      const emptyAnswers = q.answers.filter(a => !a.text.trim());
      if (emptyAnswers.length > 0) {
        toast.error(t('contentAuthoring.questionHasEmptyAnswers', { number: i + 1 }));
        return false;
      }
    }

    return true;
  };

  const handlePublish = async () => {
    if (isSystemContent) {
      toast.error(t('contentAuthoring.cannotEditTrikeLibrary'));
      return;
    }

    if (!validateCheckpoint()) return;

    setIsSaving(true);
    try {
      const checkpointData = {
        questions,
        passingScore: parseInt(passingScore),
        timeLimit: timeLimit ? parseInt(timeLimit) : null
      };

      // Calculate duration: use timeLimit if set (not empty/null), otherwise question count (0.5 min per question)
      const hasTimeLimit = timeLimit && typeof timeLimit === 'string' && timeLimit.trim() !== '';
      const calculatedDuration = hasTimeLimit
        ? parseInt(timeLimit)
        : Math.ceil(questions.length * 0.5);

      const trackData = {
        title,
        description,
        type: 'checkpoint' as const,
        transcript: JSON.stringify(checkpointData),
        duration_minutes: calculatedDuration,
        tags,
        thumbnail_url: thumbnailUrl,
        is_system_content: isSystemContentLocal,
        status: 'published' as const
      };

      if (trackId) {
        // Update and publish
        await crud.updateTrack({ id: trackId, ...trackData });
        toast.success(t('contentAuthoring.checkpointPublished'));
      } else {
        // Create and publish
        await crud.createTrack(trackData);
        toast.success(t('contentAuthoring.checkpointPublished'));
      }
      
      onClose();
    } catch (error: any) {
      console.error('Error publishing checkpoint:', error);
      toast.error(t('contentAuthoring.failedPublishCheckpoint'));
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublishAndAssign = async () => {
    // TODO: Implement assignment workflow
    await handlePublish();
    // In the future, this would redirect to the assignment wizard
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t('contentAuthoring.loadingCheckpoint')}</p>
        </div>
      </div>
    );
  }

  if (showPreview) {
    return (
      <div className="space-y-6">
        {/* Preview Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" onClick={() => setShowPreview(false)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('contentAuthoring.backToEditor')}
            </Button>
            <h1 className="text-foreground">{t('contentAuthoring.checkpointPreview')}</h1>
          </div>
          <Button variant="outline" onClick={handleSaveDraft} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? t('common.saving') : t('contentAuthoring.saveDraft')}
          </Button>
        </div>

        {/* Preview Content */}
        <Card className="max-w-4xl mx-auto">
          <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">{title || t('contentAuthoring.untitledCheckpoint')}</CardTitle>
                {description && (
                  <p className="text-muted-foreground mt-2">{description}</p>
                )}
              </div>
              <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400">
                {t('contentAuthoring.questionsCount', { count: questions.length })}
              </Badge>
            </div>
            <div className="flex items-center space-x-4 mt-4 text-sm text-muted-foreground">
              <span>{t('contentAuthoring.passingScoreLabel', { score: passingScore })}</span>
              {timeLimit && <span>• {t('contentAuthoring.timeLimitLabel', { limit: timeLimit })}</span>}
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="space-y-8">
              {questions.map((question, qIndex) => (
                <div key={question.id} className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <Badge variant="outline" className="mt-1 bg-primary/10 text-primary border-primary/20">
                      Q{qIndex + 1}
                    </Badge>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{question.question || `Question ${qIndex + 1}`}</p>
                      
                      <div className="mt-4 space-y-2">
                        {question.answers.map((answer, aIndex) => (
                          <div 
                            key={answer.id}
                            className={`p-3 rounded-lg border-2 transition-colors ${
                              answer.isCorrect 
                                ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
                                : 'border-border bg-accent/30'
                            }`}
                          >
                            <div className="flex items-center space-x-3">
                              <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                                answer.isCorrect 
                                  ? 'border-green-500 bg-green-500' 
                                  : 'border-border'
                              }`}>
                                {answer.isCorrect && (
                                  <CheckCircle className="h-4 w-4 text-white" />
                                )}
                              </div>
                              <span className={answer.isCorrect ? 'font-medium text-green-700 dark:text-green-300' : 'text-foreground'}>
                                {answer.text || `Option ${aIndex + 1}`}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {question.explanation && (
                        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 rounded">
                          <p className="text-sm text-blue-900 dark:text-blue-100">
                            <span className="font-semibold">{t('contentAuthoring.explanationLabel')}: </span>
                            {question.explanation}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  {qIndex < questions.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // View Mode (non-edit) - Display the checkpoint content for Content Library
  if (!isEditMode && existingTrack) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" onClick={handleBackWithCheck}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('common.back')}
            </Button>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-foreground">{title}</h1>
                <Badge 
                  variant="outline"
                  className={`${
                    existingTrack.status === 'published'
                      ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}
                >
                  {existingTrack.status === 'published' ? t('common.published') : t('common.draft')}
                </Badge>
                {isSystemContent && (
                  <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400">
                    <Lock className="h-3 w-3 mr-1" />
                    {t('contentAuthoring.trikeLibrary')}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Preview Button */}
            <Button 
              onClick={() => setShowLearnerPreview(true)} 
              variant="outline"
              className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <Eye className="h-4 w-4 mr-2" />
              {t('contentAuthoring.preview')}
            </Button>
            
            {/* Edit Button */}
            {(!isSystemContent || isSuperAdmin) && (
              <>
                <Button onClick={() => setIsEditMode(true)} className="hero-primary">
                  <Edit className="h-4 w-4 mr-2" />
                  {t('contentAuthoring.editTrack')}
                  {isSystemContent && isSuperAdmin && (
                    <Badge className="ml-2 bg-orange-100 text-orange-800">
                      {t('contentAuthoring.superAdmin')}
                    </Badge>
                  )}
                </Button>
                {/* Actions Menu */}
                <Popover open={isActionsMenuOpen} onOpenChange={setIsActionsMenuOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10"
                      title="More actions"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-1" align="end">
                    <div className="flex flex-col">
                      <Button
                        variant="ghost"
                        className="justify-start h-9"
                        onClick={async () => {
                          setIsActionsMenuOpen(false);
                          const t = existingTrack || track;
                          await downloadKbTrackAsPdf(t, { toast });
                        }}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        {t('contentAuthoring.downloadPdf')}
                      </Button>
                      {(onDuplicate || onCreateVariant || onArchive) && (
                        <Separator className="my-1" />
                      )}
                      {onDuplicate && (
                        <Button
                          variant="ghost"
                          className="justify-start h-9"
                          onClick={() => {
                            setIsActionsMenuOpen(false);
                            onDuplicate(existingTrack || track);
                          }}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          {t('common.duplicate')}
                        </Button>
                      )}
                      {onCreateVariant && (
                        <Button
                          variant="ghost"
                          className="justify-start h-9"
                          onClick={() => {
                            setIsActionsMenuOpen(false);
                            onCreateVariant(existingTrack || track);
                          }}
                        >
                          <GitBranch className="h-4 w-4 mr-2" />
                          {t('contentAuthoring.createVariant')}
                        </Button>
                      )}
                      {(onDuplicate || onCreateVariant) && onArchive && (
                        <Separator className="my-1" />
                      )}
                      {onArchive && (
                        <Button
                          variant="ghost"
                          className="justify-start h-9"
                          onClick={() => {
                            setIsActionsMenuOpen(false);
                            onArchive(existingTrack || track);
                          }}
                        >
                          <Archive className="h-4 w-4 mr-2" />
                          {t('common.archive')}
                        </Button>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </>
            )}
          </div>
        </div>

        {/* Checkpoint Display */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Old Version Banner - Show when viewing a non-latest version */}
            {existingTrack && existingTrack.version_number && !existingTrack.is_latest_version && (
              <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 mb-6">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                      <History className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-blue-900 dark:text-blue-100">
                        {t('contentAuthoring.viewingVersion', { version: existingTrack.version_number })}
                      </p>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        {t('contentAuthoring.olderVersionNote')}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.history.back()}
                      className="border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      {t('common.back')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            
            <Card className="overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl">{title}</CardTitle>
                    {description && (
                      <p className="text-muted-foreground mt-2">{description}</p>
                    )}
                  </div>
                  <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400">
                    {t('contentAuthoring.questionsCount', { count: questions.length })}
                  </Badge>
                </div>
                <div className="flex items-center space-x-4 mt-4 text-sm text-muted-foreground">
                  <span>{t('contentAuthoring.passingScoreLabel', { score: passingScore })}</span>
                  {timeLimit && <span>• {t('contentAuthoring.timeLimitLabel', { limit: timeLimit })}</span>}
                </div>
              </CardHeader>
              <CardContent className="p-8">
                <div className="space-y-8">
                  {questions.map((question, qIndex) => (
                    <div key={question.id} className="space-y-4">
                      <div className="flex items-start space-x-3">
                        <Badge variant="outline" className="mt-1 bg-primary/10 text-primary border-primary/20">
                          Q{qIndex + 1}
                        </Badge>
                        <div className="flex-1">
                          <p className="font-medium text-foreground">{question.question}</p>
                          
                          <div className="mt-4 space-y-2">
                            {question.answers.map((answer, aIndex) => (
                              <div 
                                key={answer.id}
                                className={`p-3 rounded-lg border-2 transition-colors ${
                                  answer.isCorrect 
                                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
                                    : 'border-border bg-accent/30'
                                }`}
                              >
                                <div className="flex items-center space-x-3">
                                  <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                                    answer.isCorrect 
                                      ? 'border-green-500 bg-green-500' 
                                      : 'border-border'
                                  }`}>
                                    {answer.isCorrect && (
                                      <CheckCircle className="h-4 w-4 text-white" />
                                    )}
                                  </div>
                                  <span className={answer.isCorrect ? 'font-medium text-green-700 dark:text-green-300' : 'text-foreground'}>
                                    {answer.text}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>

                          {question.explanation && (
                            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 rounded">
                              <p className="text-sm text-blue-900 dark:text-blue-100">
                                <span className="font-semibold">{t('contentAuthoring.explanationLabel')}: </span>
                                {question.explanation}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      {qIndex < questions.length - 1 && <Separator />}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Super Admin Settings */}
            {isSuperAdmin && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-4 w-4 text-orange-500" />
                    {t('contentAuthoring.superAdminSettings')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="system-content" className="text-sm font-medium">{t('contentAuthoring.systemTemplate')}</Label>
                      <p className="text-xs text-muted-foreground">
                        {t('contentAuthoring.markAsTrikeLibrary')}
                      </p>
                    </div>
                    <Switch
                      id="system-content"
                      checked={isEditMode ? isSystemContentLocal : existingTrack?.is_system_content}
                      onCheckedChange={(checked) => {
                        if (isEditMode) {
                          setIsSystemContentLocal(checked);
                        } else if (currentTrackId) {
                          crud.updateTrack({ id: currentTrackId, is_system_content: checked })
                            .then(() => {
                              toast.success(checked ? t('contentAuthoring.markedAsSystemContent') : t('contentAuthoring.removedFromTrikeLibrary'));
                              if (onUpdate) onUpdate();
                            });
                        }
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Publishing Status */}
            {(!isSystemContent || isSuperAdmin) && currentTrackId && existingTrack && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('contentAuthoring.publishingStatus')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{t('common.status')}</span>
                    <Badge 
                      variant="outline"
                      className={`cursor-pointer transition-colors ${
                        existingTrack.status === 'published'
                          ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200'
                          : 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 hover:bg-yellow-200'
                      }`}
                      onClick={async () => {
                        const newStatus = existingTrack.status === 'published' ? 'draft' : 'published';
                        try {
                          await crud.updateTrack({ id: currentTrackId, status: newStatus });
                          toast.success(newStatus === 'published' ? t('contentAuthoring.checkpointPublished') : t('contentAuthoring.checkpointMovedToDrafts'));
                          // Update local state and call onUpdate if available
                          setExistingTrack({ ...existingTrack, status: newStatus });
                          if (onUpdate) {
                            await onUpdate();
                          }
                        } catch (error: any) {
                          console.error('Error updating status:', error);
                          toast.error(t('contentAuthoring.failedUpdateStatus'));
                        }
                      }}
                    >
                      {existingTrack.status === 'published' ? t('common.published') : t('common.draft')}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {existingTrack.status === 'published' ? t('contentAuthoring.clickToDraft') : t('contentAuthoring.clickToPublish')}
                  </p>
                </CardContent>
              </Card>
            )}
            
            {/* Checkpoint Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('contentAuthoring.checkpointStats')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground">{t('contentAuthoring.totalQuestions')}</p>
                  <p className="text-2xl font-bold text-foreground">{questions.length}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-muted-foreground">{t('contentAuthoring.estDuration')}</p>
                  <p className="font-medium text-foreground">
                    {timeLimit && timeLimit.trim() !== ''
                      ? `${timeLimit} ${parseInt(timeLimit) === 1 ? 'min' : 'mins'}`
                      : `${Math.ceil(questions.length * 0.5)} ${Math.ceil(questions.length * 0.5) === 1 ? 'min' : 'mins'}`
                    }
                  </p>
                </div>
                <Separator />
                <div>
                  <p className="text-muted-foreground">{t('contentAuthoring.passingScore')}</p>
                  <p className="font-medium text-foreground">{passingScore}%</p>
                </div>
                {timeLimit && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-muted-foreground">{t('contentAuthoring.timeLimit')}</p>
                      <p className="font-medium text-foreground">{t('contentAuthoring.timeLimitMinutes', { limit: timeLimit })}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Tags */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <TagIcon className="h-4 w-4 mr-2" />
                  Tags
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {tags.length > 0 ? (
                    tags.map((tag, index) => (
                      <Badge key={index} variant="secondary">
                        {tag}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('contentAuthoring.noTagsAdded')}</p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsTagSelectorOpen(true)}
                  className="w-full mt-2"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Tags
                </Button>
              </CardContent>
            </Card>
            
            {/* Associated Playlists */}
            {currentTrackId && (
              <AssociatedPlaylists 
                trackId={currentTrackId}
                onPlaylistClick={onNavigateToPlaylist}
              />
            )}
            
            {/* Track Relationships */}
            {currentTrackId && (
              <TrackRelationships
                trackId={currentTrackId}
                trackType="checkpoint"
                onNavigateToTrack={onVersionClick}
              />
            )}
            
            {/* Version History */}
            {currentTrackId && (
              <VersionHistory
                trackId={currentTrackId}
                currentVersion={existingTrack?.version_number || 1}
                onVersionClick={async (versionTrackId) => {
                  console.log('🔍 Version clicked, loading version:', versionTrackId);
                  if (onVersionClick) {
                    onVersionClick(versionTrackId);
                  } else {
                    // Fallback to URL navigation if prop not provided
                    window.location.href = `/checkpoint/${versionTrackId}`;
                  }
                }}
              />
            )}
          </div>
        </div>
        
        {/* Checkpoint Preview Modal */}
        <CheckpointPreviewModal
          isOpen={showLearnerPreview}
          onClose={() => setShowLearnerPreview(false)}
          questions={questions}
          passingScore={passingScore}
          timeLimit={timeLimit}
          title={title}
        />

        {/* Tag Selector Dialog (View Mode) */}
        <TagSelectorDialog
          isOpen={isTagSelectorOpen}
          onClose={() => setIsTagSelectorOpen(false)}
          selectedTags={tags}
          onTagsChange={async (newTags) => {
            // In view mode, save directly to database
            try {
              if (!currentTrackId) return;

              await crud.updateTrack({
                id: currentTrackId,
                tags: newTags
              });
              setTags(newTags); // Update local state
              toast.success(t('contentAuthoring.tagsUpdated'));
              if (onUpdate) {
                onUpdate(); // Refresh track data
              }
            } catch (error: any) {
              console.error('Error updating tags:', error);
              toast.error(t('contentAuthoring.failedUpdateTags'), {
                description: error.message || 'Please try again'
              });
            }
          }}
          systemCategory="content"
          showAISuggest={true}
          contentContext={{
            title: existingTrack?.title || '',
            description: existingTrack?.description || '',
            transcript: (() => {
              // For checkpoints, extract question text as transcript-like content
              if (existingTrack?.transcript) {
                try {
                  const checkpointData = JSON.parse(existingTrack.transcript);
                  if (checkpointData.questions) {
                    return checkpointData.questions.map((q: any, idx: number) => `Question ${idx + 1}: ${q.question}`).join('\n\n');
                  }
                } catch (e) {
                  return '';
                }
              }
              return '';
            })(),
            keyFacts: [],
            trackId: currentTrackId,
            organizationId: existingTrack?.organization_id,
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" onClick={handleBackWithCheck}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('common.back')}
          </Button>
          <h1 className="text-foreground">
            {currentTrackId ? title || t('contentAuthoring.editCheckpoint') : t('contentAuthoring.createNewCheckpoint')}
          </h1>
        </div>
        <div className="flex items-center space-x-2">
          {/* AI Generate Button */}
          <Button 
            onClick={() => setShowAIModal(true)}
            className="bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 shadow-lg hover:shadow-orange-500/20"
            title="AI-Assisted Question Generator"
          >
            <Zap className="h-4 w-4 mr-2" />
            {t('contentAuthoring.aiGenerate')}
          </Button>
          
          {currentTrackId && (
            <>
              <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                <X className="h-4 w-4 mr-2" />
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSaveDraft} disabled={isSaving} className="hero-primary">
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? t('common.saving') : t('common.saveChanges')}
              </Button>
            </>
          )}
          {!currentTrackId && (
            <>
              <Button variant="outline" onClick={handleSaveDraft} disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? t('common.saving') : t('contentAuthoring.saveDraft')}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Editor */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('contentAuthoring.checkpointDetails')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Title */}
              <div>
                <Label htmlFor="title">{t('contentAuthoring.titleLabel')}</Label>
                <Input
                  id="title"
                  placeholder={t('contentAuthoring.checkpointTitlePlaceholder')}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-2"
                />
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="description">{t('common.description')}</Label>
                <Textarea
                  id="description"
                  placeholder={t('contentAuthoring.checkpointDescPlaceholder')}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-2"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Passing Score */}
                <div>
                  <Label htmlFor="passingScore">{t('contentAuthoring.passingScorePercent')}</Label>
                  <Input
                    id="passingScore"
                    type="number"
                    min="0"
                    max="100"
                    placeholder="70"
                    value={passingScore}
                    onChange={(e) => setPassingScore(e.target.value)}
                    className="mt-2"
                  />
                </div>

                {/* Time Limit */}
                <div>
                  <Label htmlFor="timeLimit">{t('contentAuthoring.timeLimitMinutesLabel')}</Label>
                  <Input
                    id="timeLimit"
                    type="number"
                    placeholder={t('common.optional')}
                    value={timeLimit}
                    onChange={(e) => setTimeLimit(e.target.value)}
                    className="mt-2"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Questions */}
          <div className="space-y-4">
            {questions.map((question, qIndex) => (
              <Card key={question.id} className="border-2 border-primary/10" data-question-index={qIndex}>
                <CardHeader className="bg-accent/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <GripVertical className="h-5 w-5 text-muted-foreground cursor-move" />
                      <CardTitle className="text-lg">{t('contentAuthoring.questionNumber', { number: qIndex + 1 })}</CardTitle>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeQuestion(question.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  {/* Question Text */}
                  <div>
                    <Label>{t('contentAuthoring.questionTextLabel')}</Label>
                    <Input
                      placeholder={t('contentAuthoring.questionPlaceholder')}
                      value={question.question}
                      onChange={(e) => updateQuestion(question.id, 'question', e.target.value)}
                      className="mt-2"
                    />
                  </div>

                  {/* Answers */}
                  <div>
                    <Label className="mb-3 block">{t('contentAuthoring.answerOptionsLabel')}</Label>
                    <RadioGroup 
                      value={question.answers.find(a => a.isCorrect)?.id || ''}
                      onValueChange={(value) => setCorrectAnswer(question.id, value)}
                    >
                      <div className="space-y-3">
                        {question.answers.map((answer, aIndex) => (
                          <div key={answer.id} className="flex items-center space-x-2">
                            <RadioGroupItem value={answer.id} id={answer.id} />
                            <Input
                              placeholder={`Option ${aIndex + 1}...`}
                              value={answer.text}
                              onChange={(e) => updateAnswer(question.id, answer.id, e.target.value)}
                              className={`flex-1 ${answer.isCorrect ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : ''}`}
                            />
                            {question.answers.length > 2 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeAnswer(question.id, answer.id)}
                                className="flex-shrink-0"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </RadioGroup>
                    <p className="text-xs text-muted-foreground mt-2">
                      {t('contentAuthoring.selectRadioHint')}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addAnswer(question.id)}
                      className="mt-3"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      {t('contentAuthoring.addAnswerOption')}
                    </Button>
                  </div>

                  {/* Explanation */}
                  <div>
                    <Label>{t('contentAuthoring.explanationOptionalLabel')}</Label>
                    <Textarea
                      placeholder={t('contentAuthoring.explanationPlaceholder')}
                      value={question.explanation || ''}
                      onChange={(e) => updateQuestion(question.id, 'explanation', e.target.value)}
                      className="mt-2"
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Add Question Button */}
            <Button
              variant="outline"
              onClick={addQuestion}
              className="w-full border-2 border-dashed border-primary/50 hover:bg-primary/5 hover:border-primary"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('contentAuthoring.addQuestion')}
            </Button>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Publishing Status */}
          {(!isSystemContent || isSuperAdmin) && currentTrackId && existingTrack && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('contentAuthoring.publishingStatus')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('common.status')}</span>
                  <Badge 
                    variant="outline"
                    className={`cursor-pointer transition-colors ${
                      existingTrack.status === 'published'
                        ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200'
                        : 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 hover:bg-yellow-200'
                    }`}
                    onClick={async () => {
                      const newStatus = existingTrack.status === 'published' ? 'draft' : 'published';
                      try {
                        await crud.updateTrack({ id: currentTrackId, status: newStatus });
                        toast.success(newStatus === 'published' ? t('contentAuthoring.checkpointPublished') : t('contentAuthoring.checkpointMovedToDrafts'));
                        // Update local state and call onUpdate if available
                        setExistingTrack({ ...existingTrack, status: newStatus });
                        if (onUpdate) {
                          await onUpdate();
                        }
                      } catch (error: any) {
                        console.error('Error updating status:', error);
                        toast.error(t('contentAuthoring.failedUpdateStatus'));
                      }
                    }}
                  >
                    {existingTrack.status === 'published' ? t('common.published') : t('common.draft')}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Click the status badge to {existingTrack.status === 'published' ? 'move to drafts' : 'publish'}
                </p>
              </CardContent>
            </Card>
          )}
          
          {/* Checkpoint Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('contentAuthoring.checkpointStats')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">{t('contentAuthoring.totalQuestions')}</p>
                <p className="text-2xl font-bold text-foreground">{questions.length}</p>
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground">{t('contentAuthoring.passingScore')}</p>
                <p className="font-medium text-foreground">{passingScore}%</p>
              </div>
              {timeLimit && (
                <>
                  <Separator />
                  <div>
                    <p className="text-muted-foreground">Time Limit</p>
                    <p className="font-medium text-foreground">{timeLimit} minutes</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Tags */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tags</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {tags.map((tag, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => setTags(tags.filter((_, i) => i !== index))}
                  >
                    {tag}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                ))}
                {tags.length === 0 && (
                  <p className="text-sm text-muted-foreground">{t('contentAuthoring.noTagsAdded')}</p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsTagSelectorOpen(true)}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('contentAuthoring.addTags')}
              </Button>
            </CardContent>
          </Card>

          {/* Thumbnail */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center">
                <ImageIcon className="h-4 w-4 mr-2" />
                {t('contentAuthoring.thumbnail')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {thumbnailUrl ? (
                <div className="space-y-3">
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
                    <img 
                      src={thumbnailUrl} 
                      alt="Checkpoint thumbnail" 
                      className="w-full h-full object-cover" 
                    />
                  </div>
                  <div className="flex gap-2">
                    <label className="flex-1">
                      <Button variant="outline" size="sm" className="w-full" asChild>
                        <span>
                          <Upload className="h-4 w-4 mr-2" />
                          {t('contentAuthoring.replace')}
                        </span>
                      </Button>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file && currentTrackId) {
                            try {
                              setIsUploading(true);
                              const url = await crud.uploadTrackMedia(currentTrackId, file, 'thumbnail');
                              setThumbnailUrl(url);
                              toast.success(t('contentAuthoring.thumbnailUpdated'));
                            } catch (error: any) {
                              console.error('Error uploading thumbnail:', error);
                              toast.error(t('contentAuthoring.failedUploadThumbnail'));
                            } finally {
                              setIsUploading(false);
                            }
                          }
                        }}
                        disabled={isUploading}
                      />
                    </label>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setThumbnailUrl('')}
                      disabled={isUploading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <label>
                  <div className="border-2 border-dashed border-border rounded-lg p-6 hover:bg-accent/50 transition-colors cursor-pointer">
                    <div className="text-center">
                      <ImageIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground mb-1">{t('contentAuthoring.uploadThumbnail')}</p>
                      <p className="text-xs text-muted-foreground">{t('contentAuthoring.thumbnailAspectHint')}</p>
                    </div>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file && currentTrackId) {
                        try {
                          setIsUploading(true);
                          const url = await crud.uploadTrackMedia(currentTrackId, file, 'thumbnail');
                          setThumbnailUrl(url);
                          toast.success(t('contentAuthoring.thumbnailUploaded'));
                        } catch (error: any) {
                          console.error('Error uploading thumbnail:', error);
                          toast.error(t('contentAuthoring.failedUploadThumbnail'));
                        } finally {
                          setIsUploading(false);
                        }
                      }
                    }}
                    disabled={isUploading || !currentTrackId}
                  />
                </label>
              )}
              <p className="text-xs text-muted-foreground">
                {currentTrackId ? t('contentAuthoring.thumbnailUsedIn') : t('contentAuthoring.saveFirstToUploadThumbnail')}
              </p>
            </CardContent>
          </Card>

          {/* Quick Tips */}
          <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <CardHeader>
              <CardTitle className="text-sm text-blue-900 dark:text-blue-100">{t('contentAuthoring.quickTips')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-blue-800 dark:text-blue-200">
              <p>• {t('contentAuthoring.tipMinAnswers')}</p>
              <p>• {t('contentAuthoring.tipMarkCorrect')}</p>
              <p>• {t('contentAuthoring.tipAddExplanations')}</p>
              <p>• {t('contentAuthoring.tipPreviewBeforePublish')}</p>
            </CardContent>
          </Card>
          
          {/* Associated Playlists */}
          {currentTrackId && (
            <AssociatedPlaylists
              trackId={currentTrackId}
              onPlaylistClick={onNavigateToPlaylist}
            />
          )}
          
          {/* Track Relationships */}
          {currentTrackId && (
            <TrackRelationships
              trackId={currentTrackId}
              trackType="checkpoint"
              onNavigateToTrack={onVersionClick}
            />
          )}
          
          {/* Version History */}
          {currentTrackId && (
            <VersionHistory
              trackId={currentTrackId}
              currentVersion={existingTrack?.version_number || 1}
              onVersionClick={async (versionTrackId) => {
                console.log('🔍 Version clicked, loading version:', versionTrackId);
                if (onVersionClick) {
                  onVersionClick(versionTrackId);
                } else {
                  // Fallback to URL navigation if prop not provided
                  window.location.href = `/checkpoint/${versionTrackId}`;
                }
              }}
            />
          )}
        </div>
      </div>

      {/* Tag Selector Dialog */}
      <TagSelectorDialog
        isOpen={isTagSelectorOpen}
        onClose={() => setIsTagSelectorOpen(false)}
        selectedTags={tags}
        onTagsChange={async (newTags) => {
          if (isEditMode) {
            setTags(newTags);
          } else {
            // In view mode, save directly to database
            try {
              if (!currentTrackId) return;
              
              await crud.updateTrack({
                id: currentTrackId,
                tags: newTags
              });
              setTags(newTags); // Update local state
              toast.success(t('contentAuthoring.tagsUpdated'));
              if (onUpdate) {
                onUpdate(); // Refresh track data
              }
            } catch (error: any) {
              console.error('Error updating tags:', error);
              toast.error(t('contentAuthoring.failedUpdateTags'), {
                description: error.message || 'Please try again'
              });
            }
          }
        }}
        systemCategory="content"
        // AI Recommendation props
        showAISuggest={true}
        contentContext={{
          title: isEditMode ? title : (existingTrack?.title || ''),
          description: isEditMode ? description : (existingTrack?.description || ''),
          transcript: (() => {
            // For checkpoints, extract question text as transcript-like content
            if (isEditMode) {
              return questions.map((q, idx) => `Question ${idx + 1}: ${q.question}`).join('\n\n');
            } else if (existingTrack?.transcript) {
              try {
                const checkpointData = JSON.parse(existingTrack.transcript);
                if (checkpointData.questions) {
                  return checkpointData.questions.map((q: any, idx: number) => `Question ${idx + 1}: ${q.question}`).join('\n\n');
                }
              } catch (e) {
                return '';
              }
            }
            return '';
          })(),
          keyFacts: [], // Checkpoints don't have key facts
          trackId: currentTrackId,
          organizationId: existingTrack?.organization_id,
        }}
      />
      
      {/* Version Decision Modal */}
      <VersionDecisionModal
        isOpen={isVersionModalOpen}
        onClose={() => {
          setIsVersionModalOpen(false);
          setPendingChanges(null);
        }}
        trackId={currentTrackId || ''}
        trackTitle={title}
        currentVersion={existingTrack?.version_number || 1}
        pendingChanges={pendingChanges}
        onVersionCreated={async (newTrackId, strategy) => {
          console.log('📍 CheckpointEditor: onVersionCreated callback triggered');
          console.log('✅ Version created! New track ID:', newTrackId);
          console.log('📝 Strategy:', strategy);
          
          toast.success(`Version ${(existingTrack?.version_number || 1) + 1} created with ${strategy} strategy!`);
          
          console.log('🔄 Closing modal...');
          setIsVersionModalOpen(false);
          console.log('🔄 Exiting edit mode...');
          setIsEditMode(false);
          
          console.log('⏳ Waiting 300ms before refreshing data...');
          // Small delay to let modal close gracefully
          setTimeout(async () => {
            console.log('🔄 Calling onUpdate with new track ID:', newTrackId);
            // Pass the new track ID to onUpdate so it loads the new version
            await onUpdate(newTrackId);
            console.log('✅ Track data refreshed with new version');
          }, 300);
        }}
      />
      
      {/* Unsaved Changes Dialog */}
      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onOpenChange={(open) => setShowUnsavedDialog(open)}
        onDiscard={handleDiscardChanges}
        onSave={handleSaveAndNavigate}
      />
      
      {/* Checkpoint Preview Modal */}
      <CheckpointPreviewModal
        isOpen={showLearnerPreview}
        onClose={() => setShowLearnerPreview(false)}
        questions={questions}
        passingScore={passingScore}
        timeLimit={timeLimit}
        title={title}
      />
      
      {/* AI Generate Modal */}
      <AIGenerateCheckpointModal
        isOpen={showAIModal}
        onClose={() => setShowAIModal(false)}
        onGenerate={handleAIGenerate}
      />
    </div>
  );
}