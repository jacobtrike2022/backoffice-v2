// ============================================================================
// LIGHTNING BOLT PANEL
// ============================================================================
// Floating action panel for iterative edits
// - Lightning bolt icon opens instruction input
// - Quick chips for common actions
// - Calls apply-instructions endpoint
// ============================================================================

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Zap, X, Send, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import {
  applyInstructions,
  type ApplyInstructionsResponse,
  type VariantDraft
} from '../../lib/crud/trackRelationships';

interface LightningBoltPanelProps {
  draftId: string;
  contractId?: string;
  extractionId?: string;
  onDraftUpdate: (draft: VariantDraft) => void;
  disabled?: boolean;
}

const QUICK_CHIPS = [
  { label: 'Tighten wording', instruction: 'Tighten the wording to be more concise without losing meaning' },
  { label: 'Make it shorter', instruction: 'Shorten the content while preserving all key facts and state-specific requirements' },
  { label: 'Make it more direct', instruction: 'Make the language more direct and action-oriented' },
  { label: 'Use our tone', instruction: 'Adjust the tone to be more conversational and friendly while keeping it professional' },
  { label: 'Add context', instruction: 'Add more context and explanation for complex requirements' },
  { label: 'Simplify language', instruction: 'Simplify the language for easier reading comprehension' },
];

export function LightningBoltPanel({
  draftId,
  contractId,
  extractionId,
  onDraftUpdate,
  disabled = false,
}: LightningBoltPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isOpen &&
        panelRef.current &&
        !panelRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleApplyInstruction = async (instructionText: string) => {
    if (!instructionText.trim() || isApplying || disabled) return;

    setIsApplying(true);
    try {
      const response = await applyInstructions({
        draftId,
        instruction: instructionText.trim(),
        contractId,
        extractionId,
      });

      if (response.success) {
        onDraftUpdate(response.draft);
        setInstruction('');
        setIsOpen(false);

        toast.success('Changes applied', {
          description: `${response.changesApplied} changes made to the draft`,
        });

        // Show blocked changes warning if any
        if (response.blockedChanges && response.blockedChanges.length > 0) {
          toast.warning('Some changes were blocked', {
            description: `${response.blockedChanges.length} changes couldn't be applied`,
          });
        }
      } else {
        throw new Error(response.message || 'Failed to apply changes');
      }
    } catch (error: any) {
      toast.error('Failed to apply changes', {
        description: error.message,
      });
    } finally {
      setIsApplying(false);
    }
  };

  const handleQuickChip = (chipInstruction: string) => {
    handleApplyInstruction(chipInstruction);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleApplyInstruction(instruction);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleApplyInstruction(instruction);
    }
  };

  return (
    <div ref={panelRef} className="fixed bottom-6 right-6 z-50">
      {/* Floating action button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          disabled={disabled}
          className={`
            group relative p-4 rounded-full shadow-lg transition-all duration-300
            ${disabled
              ? 'bg-muted cursor-not-allowed'
              : 'bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 hover:scale-105 hover:shadow-xl hover:shadow-orange-500/25'}
          `}
          style={{
            boxShadow: disabled ? undefined : '0 0 30px rgba(246, 74, 5, 0.3)',
          }}
        >
          <Zap
            className={`w-6 h-6 ${disabled ? 'text-muted-foreground' : 'text-white'}`}
            style={{
              filter: disabled ? undefined : 'drop-shadow(0 0 8px rgba(255, 255, 255, 0.5))',
            }}
          />

          {/* Tooltip */}
          <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-card border border-border text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            Quick edits
          </span>

          {/* Pulse ring */}
          {!disabled && (
            <span className="absolute inset-0 rounded-full bg-orange-500/50 animate-ping" />
          )}
        </button>
      )}

      {/* Expanded panel */}
      {isOpen && (
        <div className="w-[400px] rounded-2xl bg-card border border-border shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-orange-500/10 to-transparent">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-orange-500/20">
                <Zap className="w-4 h-4 text-orange-500" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Quick Edits</h3>
                <p className="text-xs text-muted-foreground">Tell the agent what to change</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg hover:bg-accent transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick chips */}
          <div className="p-3 border-b border-border">
            <p className="text-xs text-muted-foreground mb-2 font-medium">Quick actions</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  onClick={() => handleQuickChip(chip.instruction)}
                  disabled={isApplying}
                  className={`
                    flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium
                    border border-border bg-background
                    transition-all hover:border-primary hover:bg-primary/5
                    ${isApplying ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  <Sparkles className="w-3 h-3 text-primary" />
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom instruction input */}
          <form onSubmit={handleSubmit} className="p-3">
            <div className="relative">
              <textarea
                ref={inputRef}
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Or type a custom instruction..."
                disabled={isApplying}
                rows={3}
                className="w-full px-3 py-2 pr-10 rounded-lg border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!instruction.trim() || isApplying}
                className={`
                  absolute right-2 bottom-2 p-1.5 rounded-lg transition-all
                  ${instruction.trim() && !isApplying
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'}
                `}
              >
                {isApplying ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Press Enter to submit, Shift+Enter for new line
            </p>
          </form>

          {/* Loading indicator */}
          {isApplying && (
            <div className="px-3 pb-3">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
                <div className="relative">
                  <Zap className="w-4 h-4 text-primary animate-pulse" />
                  <span className="absolute inset-0 animate-ping">
                    <Zap className="w-4 h-4 text-primary/50" />
                  </span>
                </div>
                <span className="text-xs text-primary font-medium">
                  Applying changes...
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Global styles for animations */}
      <style>{`
        @keyframes slide-in-from-bottom-4 {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-in {
          animation: slide-in-from-bottom-4 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}

export default LightningBoltPanel;
