/**
 * TrackFormGate — Shown inline after a track completes within a playlist
 * when the track has a required_form_id attached.
 *
 * Loads the form, renders it using FormRenderer, and on submit saves
 * the submission with track + playlist context, then calls onComplete
 * to allow advancing to the next track.
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ClipboardCheck,
  SkipForward,
} from 'lucide-react';
import { FormRenderer, type FormBlockData, type ScoringResult } from './forms/shared/FormRenderer';
import { getFormById, submitFormResponse } from '../lib/crud/forms';
import { toast } from 'sonner';

interface TrackFormGateProps {
  /** The playlist this track belongs to */
  playlistId: string;
  /** The track that was just completed */
  trackId: string;
  /** Display title of the track (for context banner) */
  trackTitle: string;
  /** The form ID to load and render */
  formId: string;
  /** Title of the form (optional, for display before loading) */
  formTitle?: string;
  /** Gate mode — 'required' blocks advancement, 'optional' allows skip */
  gateMode: 'required' | 'optional';
  /** Current user ID for the submission */
  userId?: string;
  /** Called after the form is successfully submitted */
  onComplete: () => void;
  /** Called if the user skips (only available when gateMode is 'optional') */
  onSkip?: () => void;
}

export function TrackFormGate({
  playlistId,
  trackId,
  trackTitle,
  formId,
  formTitle,
  gateMode,
  userId,
  onComplete,
  onSkip,
}: TrackFormGateProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    title: string;
    description?: string;
    blocks: FormBlockData[];
    settings?: { scoring_enabled?: boolean; scoring_mode?: 'pass_fail' | 'weighted' | 'section'; pass_threshold?: number };
    organization_id?: string;
  } | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadForm();
  }, [formId]);

  async function loadForm() {
    try {
      setLoading(true);
      setError(null);
      const form = await getFormById(formId);
      if (!form) {
        setError('Form not found');
        return;
      }
      setFormData({
        title: form.title,
        description: form.description,
        blocks: (form.form_blocks || []) as FormBlockData[],
        settings: form.settings,
        organization_id: form.organization_id,
      });
    } catch (err) {
      console.error('[TrackFormGate] Error loading form:', err);
      setError(err instanceof Error ? err.message : 'Failed to load form');
    } finally {
      setLoading(false);
    }
  }

  async function handleFormSubmit(answers: Record<string, unknown>, scoring?: ScoringResult) {
    if (submitting) return;
    setSubmitting(true);
    try {
      const responseWithContext = {
        ...answers,
        _playlist_id: playlistId,
        _track_id: trackId,
        _submitted_via: 'track_form_gate',
      };

      await submitFormResponse(
        formId,
        responseWithContext,
        userId,
        scoring ? {
          score_percentage: scoring.score_percentage,
          passed: scoring.passed,
          total_score: scoring.earned_weight,
          max_possible_score: scoring.total_weight,
          scoring_mode: scoring.scoring_mode,
          section_scores: scoring.section_scores,
        } : undefined
      );

      setSubmitted(true);
      toast.success('Form completed — advancing to next track');
      setTimeout(() => onComplete(), 1200);
    } catch (err) {
      console.error('[TrackFormGate] Submit error:', err);
      toast.error('Failed to submit form. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="p-10 text-center">
          <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold mb-1">Form Completed</h2>
          <p className="text-sm text-muted-foreground">Advancing to the next track...</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="p-10 text-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading form...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="p-10 text-center">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
          <h3 className="font-semibold mb-2">Could not load form</h3>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button variant="outline" onClick={loadForm}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  if (!formData) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Context banner — tells the learner why they're seeing a form */}
      <Card className="border-orange-300/40 bg-orange-50/50 dark:border-orange-900/30 dark:bg-orange-950/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
              <ClipboardCheck className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-orange-900 dark:text-orange-100">
                Complete this form to continue
              </p>
              <p className="text-xs text-orange-700 dark:text-orange-300 mt-0.5">
                After completing "{trackTitle}", please fill out the following form
                {gateMode === 'required' ? ' before advancing to the next track.' : '.'}
              </p>
              <Badge
                variant="outline"
                className="mt-1.5 text-[10px] border-orange-300 dark:border-orange-800 text-orange-700 dark:text-orange-300 gap-1"
              >
                <FileText className="h-2.5 w-2.5" />
                {gateMode === 'required' ? 'Required before next track' : 'Optional'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* The form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{formData.title}</CardTitle>
          {formData.description && (
            <CardDescription>{formData.description}</CardDescription>
          )}
        </CardHeader>
        <Separator />
        <CardContent className="pt-5">
          <FormRenderer
            blocks={formData.blocks}
            formId={formId}
            onSubmit={handleFormSubmit}
            scoringEnabled={formData.settings?.scoring_enabled}
            scoringMode={formData.settings?.scoring_mode}
            passThreshold={formData.settings?.pass_threshold}
            organizationId={formData.organization_id}
          />
        </CardContent>
      </Card>

      {/* Skip option — only for optional gate mode */}
      {gateMode === 'optional' && onSkip && (
        <div className="text-center">
          <Button variant="ghost" onClick={onSkip} className="text-muted-foreground gap-1.5">
            <SkipForward className="h-3.5 w-3.5" />
            Skip for now
          </Button>
          <p className="text-[11px] text-muted-foreground mt-1">
            You can come back to this form later.
          </p>
        </div>
      )}
    </div>
  );
}

export default TrackFormGate;
