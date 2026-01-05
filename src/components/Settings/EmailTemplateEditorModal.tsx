import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Separator } from '../ui/separator';
import { Save, X, Eye, Variable } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { EmailRichTextEditor } from './EmailRichTextEditor';
import { EmailVariablesEditor } from './EmailVariablesEditor';
import { EmailVariableInserter } from './EmailVariableInserter';
import type { EmailTemplate } from '../../lib/crud/email';

interface EmailVariable {
  key: string;
  description: string;
}

interface EmailTemplateEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (template: TemplateFormData) => Promise<void>;
  editingTemplate: EmailTemplate | null;
  mode: 'create' | 'edit' | 'customize';
}

export interface TemplateFormData {
  id?: string;
  name: string;
  slug: string;
  description: string;
  subject: string;
  body_html: string;
  body_text: string;
  available_variables: EmailVariable[];
}

// Generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

// Convert HTML to plain text
function htmlToPlainText(html: string): string {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  // Replace <br> and block elements with newlines
  temp.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  temp.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, li').forEach((el) => {
    el.prepend(document.createTextNode('\n'));
  });
  return (temp.textContent || temp.innerText || '').trim();
}

export function EmailTemplateEditorModal({
  isOpen,
  onClose,
  onSave,
  editingTemplate,
  mode,
}: EmailTemplateEditorModalProps) {
  const isEditMode = mode === 'edit';
  const isCustomizeMode = mode === 'customize';
  const [loading, setLoading] = useState(false);
  const [bodyTab, setBodyTab] = useState<'html' | 'text'>('html');
  const [autoGenerateText, setAutoGenerateText] = useState(true);
  const subjectInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formData, setFormData] = useState<TemplateFormData>({
    name: '',
    slug: '',
    description: '',
    subject: '',
    body_html: '',
    body_text: '',
    available_variables: [],
  });

  // Track if user has manually edited slug
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  // Load template data when editing or customizing
  useEffect(() => {
    if ((isEditMode || isCustomizeMode) && editingTemplate) {
      const variables = Array.isArray(editingTemplate.available_variables)
        ? editingTemplate.available_variables
        : [];

      setFormData({
        id: isEditMode ? editingTemplate.id : undefined, // Don't include ID for customize (creates new)
        name: isCustomizeMode
          ? editingTemplate.name // Keep same name for customize
          : editingTemplate.name,
        slug: editingTemplate.slug,
        description: editingTemplate.description || '',
        subject: editingTemplate.subject,
        body_html: editingTemplate.body_html,
        body_text: editingTemplate.body_text || '',
        available_variables: variables,
      });
      setSlugManuallyEdited(true); // Don't auto-generate slug for existing templates
      setAutoGenerateText(false); // Don't auto-generate text for existing templates
    } else {
      // Reset form for create mode
      setFormData({
        name: '',
        slug: '',
        description: '',
        subject: '',
        body_html: '',
        body_text: '',
        available_variables: [],
      });
      setSlugManuallyEdited(false);
      setAutoGenerateText(true);
    }
  }, [isEditMode, isCustomizeMode, editingTemplate, isOpen]);

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      slug: slugManuallyEdited ? prev.slug : generateSlug(name),
    }));
  };

  // Handle slug change (marks as manually edited)
  const handleSlugChange = (slug: string) => {
    setSlugManuallyEdited(true);
    setFormData((prev) => ({
      ...prev,
      slug: generateSlug(slug),
    }));
  };

  // Handle HTML body change (auto-generate plain text if enabled)
  const handleBodyHtmlChange = (html: string) => {
    setFormData((prev) => ({
      ...prev,
      body_html: html,
      body_text: autoGenerateText ? htmlToPlainText(html) : prev.body_text,
    }));
  };

  // Insert variable at cursor in subject input
  const insertVariableInSubject = (variable: string) => {
    const input = subjectInputRef.current;
    if (!input) return;

    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const currentValue = formData.subject;
    const newValue =
      currentValue.substring(0, start) + variable + currentValue.substring(end);

    setFormData((prev) => ({ ...prev, subject: newValue }));

    // Restore focus and cursor position after variable insertion
    setTimeout(() => {
      input.focus();
      const newPos = start + variable.length;
      input.setSelectionRange(newPos, newPos);
    }, 0);
  };

  // Handle save
  const handleSave = async () => {
    // Validation
    if (!formData.name.trim()) {
      toast.error('Template name is required');
      return;
    }
    if (!formData.slug.trim()) {
      toast.error('Template slug is required');
      return;
    }
    if (!formData.subject.trim()) {
      toast.error('Subject line is required');
      return;
    }
    if (!formData.body_html.trim()) {
      toast.error('Email body is required');
      return;
    }

    // Filter out empty variables
    const cleanedVariables = formData.available_variables.filter(
      (v) => v.key.trim() !== ''
    );

    try {
      setLoading(true);
      await onSave({
        ...formData,
        available_variables: cleanedVariables,
      });
      onClose();
    } catch (error: any) {
      toast.error('Failed to save template', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    if (isCustomizeMode) return 'Customize Template';
    if (isEditMode) return 'Edit Template';
    return 'Create Template';
  };

  const getDescription = () => {
    if (isCustomizeMode)
      return 'Create your own version of this system template. Your customized version will be used instead of the default.';
    if (isEditMode) return 'Edit your email template.';
    return 'Create a new email template for your organization.';
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 py-4">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g., Weekly Progress Report"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">
                  Slug{' '}
                  <span className="text-muted-foreground text-xs">
                    (auto-generated)
                  </span>
                </Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="weekly_progress_report"
                  className="font-mono"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Brief description of when this template is used..."
                rows={2}
              />
            </div>
          </div>

          <Separator />

          {/* Subject Line */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="subject">Subject Line *</Label>
              <EmailVariableInserter
                variables={formData.available_variables}
                onInsert={insertVariableInSubject}
                size="sm"
              />
            </div>
            <Input
              ref={subjectInputRef}
              id="subject"
              value={formData.subject}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, subject: e.target.value }))
              }
              placeholder="e.g., Welcome to {{company_name}}, {{user_name}}!"
            />
          </div>

          <Separator />

          {/* Email Body */}
          <div className="space-y-2">
            <Label>Email Body *</Label>
            <Tabs value={bodyTab} onValueChange={(v) => setBodyTab(v as 'html' | 'text')}>
              <TabsList>
                <TabsTrigger value="html">Rich Text Editor</TabsTrigger>
                <TabsTrigger value="text">Plain Text</TabsTrigger>
              </TabsList>
              <TabsContent value="html" className="mt-2">
                <EmailRichTextEditor
                  content={formData.body_html}
                  onChange={handleBodyHtmlChange}
                  availableVariables={formData.available_variables}
                />
              </TabsContent>
              <TabsContent value="text" className="mt-2">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="autoGenerateText"
                      checked={autoGenerateText}
                      onChange={(e) => setAutoGenerateText(e.target.checked)}
                      className="rounded border-input"
                    />
                    <Label htmlFor="autoGenerateText" className="text-sm font-normal">
                      Auto-generate from HTML
                    </Label>
                  </div>
                  <Textarea
                    value={formData.body_text}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        body_text: e.target.value,
                      }))
                    }
                    placeholder="Plain text version of the email..."
                    rows={10}
                    disabled={autoGenerateText}
                    className="font-mono text-sm"
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <Separator />

          {/* Available Variables */}
          <EmailVariablesEditor
            variables={formData.available_variables}
            onChange={(variables) =>
              setFormData((prev) => ({ ...prev, available_variables: variables }))
            }
          />
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? (
              'Saving...'
            ) : (
              <>
                <Save className="h-4 w-4 mr-1" />
                {isCustomizeMode ? 'Save Customization' : 'Save Template'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
