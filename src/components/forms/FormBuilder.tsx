import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  createForm,
  updateForm,
  publishForm,
  getFormById,
  addFormBlock,
  updateFormBlock,
  deleteFormBlock
} from '@/lib/crud/forms';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';
import {
  Save,
  Eye,
  Settings,
  Plus,
  GripVertical,
  Type,
  CheckSquare,
  ChevronDown,
  Hash,
  Calendar,
  Clock,
  Mail,
  Phone,
  Upload,
  PenTool,
  Star,
  List,
  Grid3x3,
  ToggleLeft,
  Image as ImageIcon,
  Calculator,
  EyeOff,
  Send,
  GitBranch,
  MessageSquare,
  Divide,
  Smartphone,
  Monitor,
  X,
  Tag,
  Users,
  FileText,
  AlertCircle,
  Lock,
  Globe,
  ChevronRight,
  Loader2
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';

interface FormBlock {
  id: string;
  type: string;
  label: string;
  icon: any;
  category: 'question' | 'action' | 'content';
}

const formBlocks: FormBlock[] = [
  // Question Blocks
  { id: 'text', type: 'Text Input', label: 'Text Input (single line)', icon: Type, category: 'question' },
  { id: 'textarea', type: 'Text Area', label: 'Text Area (multiple lines)', icon: Type, category: 'question' },
  { id: 'multiple-choice', type: 'Multiple Choice', label: 'Multiple Choice', icon: CheckSquare, category: 'question' },
  { id: 'checkboxes', type: 'Checkboxes', label: 'Checkboxes', icon: CheckSquare, category: 'question' },
  { id: 'dropdown', type: 'Dropdown', label: 'Dropdown', icon: ChevronDown, category: 'question' },
  { id: 'number', type: 'Number Input', label: 'Number Input', icon: Hash, category: 'question' },
  { id: 'date', type: 'Date Picker', label: 'Date Picker', icon: Calendar, category: 'question' },
  { id: 'time', type: 'Time Picker', label: 'Time Picker', icon: Clock, category: 'question' },
  { id: 'email', type: 'Email Input', label: 'Email Input', icon: Mail, category: 'question' },
  { id: 'phone', type: 'Phone Input', label: 'Phone Input', icon: Phone, category: 'question' },
  { id: 'file', type: 'File Upload', label: 'File Upload', icon: Upload, category: 'question' },
  { id: 'signature', type: 'Signature', label: 'Signature', icon: PenTool, category: 'question' },
  { id: 'rating', type: 'Rating Scale', label: 'Rating Scale', icon: Star, category: 'question' },
  { id: 'ranking', type: 'Ranking', label: 'Ranking', icon: List, category: 'question' },
  { id: 'matrix', type: 'Matrix/Grid', label: 'Matrix/Grid', icon: Grid3x3, category: 'question' },
  { id: 'yes-no', type: 'Yes/No Toggle', label: 'Yes/No Toggle', icon: ToggleLeft, category: 'question' },
  { id: 'picture-choice', type: 'Picture Choice', label: 'Picture Choice', icon: ImageIcon, category: 'question' },
  
  // Action Blocks
  { id: 'calculator', type: 'Calculator', label: 'Calculator (for scores)', icon: Calculator, category: 'action' },
  { id: 'hidden', type: 'Hidden Field', label: 'Hidden Field', icon: EyeOff, category: 'action' },
  { id: 'email-notification', type: 'Email Notification', label: 'Email Notification', icon: Send, category: 'action' },
  { id: 'conditional', type: 'Conditional Logic', label: 'Conditional Logic', icon: GitBranch, category: 'action' },
  
  // Content Blocks
  { id: 'welcome', type: 'Welcome Message', label: 'Welcome Message', icon: MessageSquare, category: 'content' },
  { id: 'closing', type: 'Closing Message', label: 'Closing Message', icon: MessageSquare, category: 'content' },
  { id: 'divider', type: 'Section Divider', label: 'Section Divider', icon: Divide, category: 'content' },
  { id: 'statement', type: 'Statement/Info', label: 'Statement/Info Text', icon: MessageSquare, category: 'content' }
];

interface FormBuilderProps {
  formId?: string; // For editing existing forms
  currentRole?: 'admin' | 'district-manager' | 'store-manager';
  onSaveDraft?: () => void;
  onNavigateToAssignments?: () => void;
}

export function FormBuilder({ formId, currentRole = 'admin', onSaveDraft, onNavigateToAssignments }: FormBuilderProps) {
  const queryClient = useQueryClient();
  const [formTitle, setFormTitle] = useState('Untitled Form');
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [propertiesTab, setPropertiesTab] = useState<'preview' | 'properties'>('properties');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [canvasBlocks, setCanvasBlocks] = useState<any[]>([]);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  
  // Form metadata state
  const [formDescription, setFormDescription] = useState('');
  const [formType, setFormType] = useState('OJT Checklist');
  const [formStatus, setFormStatus] = useState<'Draft' | 'Published'>('Draft');
  const [formTags, setFormTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [assignedUnits, setAssignedUnits] = useState<string[]>([]);
  const [formCategory, setFormCategory] = useState('');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [allowAnonymous, setAllowAnonymous] = useState(false);
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [currentFormId, setCurrentFormId] = useState<string | null>(formId || null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Load existing form if formId is provided
  const { data: existingForm, isLoading: isLoadingForm } = useQuery({
    queryKey: ['form', currentFormId],
    queryFn: () => getFormById(currentFormId!),
    enabled: !!currentFormId
  });

  // Populate form state when existing form loads
  useEffect(() => {
    if (existingForm) {
      setFormTitle(existingForm.title || 'Untitled Form');
      setFormDescription(existingForm.description || '');
      setFormCategory(existingForm.category || '');
      setRequiresApproval(existingForm.requires_approval || false);
      setAllowAnonymous(existingForm.allow_anonymous || false);

      // Map database type to UI type
      const typeMap: Record<string, string> = {
        'ojt-checklist': 'OJT Checklist',
        'inspection': 'Inspection',
        'audit': 'Audit',
        'survey': 'Survey',
        'other': 'Other'
      };
      setFormType(typeMap[existingForm.type] || 'OJT Checklist');

      // Map database status to UI status
      const statusMap: Record<string, 'Draft' | 'Published'> = {
        'draft': 'Draft',
        'published': 'Published'
      };
      setFormStatus(statusMap[existingForm.status] || 'Draft');

      // Load form blocks if they exist
      if (existingForm.form_blocks && existingForm.form_blocks.length > 0) {
        const mappedBlocks = existingForm.form_blocks.map((block: any) => ({
          id: block.id,
          type: block.type,
          label: block.label,
          description: block.description,
          placeholder: block.placeholder,
          required: block.is_required,
          options: block.options,
          validation_rules: block.validation_rules
        }));
        setCanvasBlocks(mappedBlocks);
      }
    }
  }, [existingForm]);

  // Create form mutation
  const createFormMutation = useMutation({
    mutationFn: async () => {
      const typeMap: Record<string, 'ojt-checklist' | 'inspection' | 'audit' | 'survey'> = {
        'OJT Checklist': 'ojt-checklist',
        'Inspection': 'inspection',
        'Audit': 'audit',
        'Survey': 'survey',
        'Assessment': 'survey',
        'Incident Report': 'other' as 'survey' // Will need to add 'other' to type union
      };

      return createForm({
        title: formTitle,
        description: formDescription,
        type: typeMap[formType] || 'ojt-checklist',
        category: formCategory || undefined,
        requires_approval: requiresApproval,
        allow_anonymous: allowAnonymous
      });
    },
    onSuccess: (data) => {
      setCurrentFormId(data.id);
      setHasUnsavedChanges(false);
      setLastSavedAt(new Date());
      toast.success('Form created and saved as draft');
      queryClient.invalidateQueries({ queryKey: ['forms'] });
    },
    onError: (error: Error) => {
      toast.error(`Error creating form: ${error.message}`);
    }
  });

  // Update form mutation
  const updateFormMutation = useMutation({
    mutationFn: async (updates: any) => {
      if (!currentFormId) throw new Error('No form ID');

      const typeMap: Record<string, 'ojt-checklist' | 'inspection' | 'audit' | 'survey'> = {
        'OJT Checklist': 'ojt-checklist',
        'Inspection': 'inspection',
        'Audit': 'audit',
        'Survey': 'survey',
        'Assessment': 'survey',
        'Incident Report': 'other' as 'survey'
      };

      return updateForm(currentFormId, {
        title: formTitle,
        description: formDescription,
        type: typeMap[formType] || 'ojt-checklist',
        category: formCategory || undefined,
        requires_approval: requiresApproval,
        allow_anonymous: allowAnonymous,
        ...updates
      });
    },
    onSuccess: () => {
      setHasUnsavedChanges(false);
      setLastSavedAt(new Date());
      toast.success('Form saved successfully');
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      queryClient.invalidateQueries({ queryKey: ['form', currentFormId] });
    },
    onError: (error: Error) => {
      toast.error(`Error saving form: ${error.message}`);
    }
  });

  // Publish form mutation
  const publishFormMutation = useMutation({
    mutationFn: async () => {
      if (!currentFormId) throw new Error('No form ID - save the form first');
      return publishForm(currentFormId);
    },
    onSuccess: () => {
      setFormStatus('Published');
      toast.success('Form published successfully - now live for assigned users');
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      queryClient.invalidateQueries({ queryKey: ['form', currentFormId] });
    },
    onError: (error: Error) => {
      toast.error(`Error publishing form: ${error.message}`);
    }
  });

  // Auto-save effect (debounced)
  useEffect(() => {
    if (!hasUnsavedChanges || !currentFormId) return;

    const timeout = setTimeout(() => {
      updateFormMutation.mutate({});
    }, 30000); // 30 seconds

    return () => clearTimeout(timeout);
  }, [hasUnsavedChanges, formTitle, formDescription, formType, formCategory, requiresApproval, allowAnonymous]);

  // Mark as changed when form fields change
  useEffect(() => {
    if (currentFormId && existingForm) {
      setHasUnsavedChanges(true);
    }
  }, [currentFormId, existingForm, formTitle, formDescription, formType, formCategory, requiresApproval, allowAnonymous, canvasBlocks]);

  // Save handlers
  const handleSaveDraft = async () => {
    if (currentFormId) {
      await updateFormMutation.mutateAsync({ status: 'draft' });
    } else {
      await createFormMutation.mutateAsync();
    }
    onSaveDraft?.();
  };

  const handlePublish = async () => {
    // If form doesn't exist yet, create it first
    if (!currentFormId) {
      const newForm = await createFormMutation.mutateAsync();
      if (newForm) {
        await publishFormMutation.mutateAsync();
      }
    } else {
      // Save any pending changes first
      if (hasUnsavedChanges) {
        await updateFormMutation.mutateAsync({});
      }
      await publishFormMutation.mutateAsync();
    }
  };

  // Sample assignments and tags
  const sampleAssignments = [
    { id: '1', name: 'New Hires - All Locations', type: 'Group', count: 24, active: true },
    { id: '2', name: 'Store Managers', type: 'Role', count: 15, active: true },
    { id: '3', name: 'District 1 - All Stores', type: 'Unit', count: 8, active: false },
    { id: '4', name: 'Safety Compliance Team', type: 'Group', count: 12, active: true },
    { id: '5', name: 'Night Shift Workers', type: 'Shift', count: 32, active: false }
  ];

  const suggestedTags = [
    'Training',
    'Compliance',
    'Safety',
    'Quality',
    'Daily',
    'Weekly',
    'Monthly',
    'Recurring',
    'New Hire',
    'Operations',
    'Closing',
    'Opening',
    'Legal',
    'Admin',
    'Quarterly'
  ];

  const addBlockToCanvas = (block: FormBlock) => {
    const newBlock = {
      ...block,
      id: `${block.id}-${Date.now()}`,
      label: block.type,
      required: false,
      description: ''
    };
    setCanvasBlocks([...canvasBlocks, newBlock]);
    setSelectedBlock(newBlock.id);
  };

  const removeBlockFromCanvas = (blockId: string) => {
    setCanvasBlocks(canvasBlocks.filter(block => block.id !== blockId));
    if (selectedBlock === blockId) {
      setSelectedBlock(null);
    }
  };

  const updateBlockProperty = (blockId: string, property: string, value: any) => {
    setCanvasBlocks(canvasBlocks.map(block => 
      block.id === blockId ? { ...block, [property]: value } : block
    ));
  };

  const getSelectedBlockData = () => {
    return canvasBlocks.find(block => block.id === selectedBlock);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', index.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragIndex = parseInt(e.dataTransfer.getData('text/html'));
    
    if (dragIndex === dropIndex) return;
    
    const newBlocks = [...canvasBlocks];
    const [draggedBlock] = newBlocks.splice(dragIndex, 1);
    newBlocks.splice(dropIndex, 0, draggedBlock);
    
    setCanvasBlocks(newBlocks);
  };

  const renderFormField = (block: any) => {
    switch (block.id.split('-')[0]) {
      case 'text':
        return <Input placeholder={`Enter ${block.label.toLowerCase()}...`} />;
      
      case 'textarea':
        return <Textarea placeholder={`Enter ${block.label.toLowerCase()}...`} rows={4} />;
      
      case 'multiple':
        return (
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="h-4 w-4 rounded-full border-2 border-primary" />
              <label className="text-sm">Option 1</label>
            </div>
            <div className="flex items-center space-x-2">
              <div className="h-4 w-4 rounded-full border-2 border-muted-foreground" />
              <label className="text-sm">Option 2</label>
            </div>
            <div className="flex items-center space-x-2">
              <div className="h-4 w-4 rounded-full border-2 border-muted-foreground" />
              <label className="text-sm">Option 3</label>
            </div>
          </div>
        );
      
      case 'checkboxes':
        return (
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="h-4 w-4 rounded border-2 border-primary bg-primary" />
              <label className="text-sm">Option 1</label>
            </div>
            <div className="flex items-center space-x-2">
              <div className="h-4 w-4 rounded border-2 border-muted-foreground" />
              <label className="text-sm">Option 2</label>
            </div>
            <div className="flex items-center space-x-2">
              <div className="h-4 w-4 rounded border-2 border-muted-foreground" />
              <label className="text-sm">Option 3</label>
            </div>
          </div>
        );
      
      case 'dropdown':
        return (
          <Select>
            <SelectTrigger>
              <SelectValue placeholder="Select an option..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Option 1</SelectItem>
              <SelectItem value="2">Option 2</SelectItem>
              <SelectItem value="3">Option 3</SelectItem>
            </SelectContent>
          </Select>
        );
      
      case 'number':
        return <Input type="number" placeholder="Enter a number..." />;
      
      case 'date':
        return <Input type="date" />;
      
      case 'time':
        return <Input type="time" />;
      
      case 'email':
        return <Input type="email" placeholder="Enter email address..." />;
      
      case 'phone':
        return <Input type="tel" placeholder="Enter phone number..." />;
      
      case 'file':
        return (
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Click to upload or drag and drop</p>
          </div>
        );
      
      case 'signature':
        return (
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <PenTool className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Click to sign</p>
          </div>
        );
      
      case 'rating':
        return (
          <div className="flex items-center space-x-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star key={star} className="h-8 w-8 text-primary fill-primary cursor-pointer" />
            ))}
          </div>
        );
      
      case 'yes':
        return (
          <div className="flex items-center space-x-4">
            <Button variant="outline" className="flex-1">Yes</Button>
            <Button variant="outline" className="flex-1">No</Button>
          </div>
        );
      
      case 'welcome':
      case 'closing':
      case 'statement':
        return (
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <p className="text-sm">
                {block.description || 'This is a welcome message that will appear to users when they start the form.'}
              </p>
            </CardContent>
          </Card>
        );
      
      case 'divider':
        return <Separator className="my-4" />;
      
      default:
        return <Input placeholder={`Enter ${block.label.toLowerCase()}...`} />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex-1 max-w-xl">
          <Input
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            className="text-xl font-semibold border-0 px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            placeholder="Enter form title..."
          />
          {lastSavedAt && (
            <p className="text-xs text-muted-foreground mt-1">
              {hasUnsavedChanges ? 'Unsaved changes • ' : 'Saved • '}
              {lastSavedAt.toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => setShowPreviewModal(true)}>
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button
            variant="outline"
            onClick={handleSaveDraft}
            disabled={createFormMutation.isPending || updateFormMutation.isPending}
          >
            {(createFormMutation.isPending || updateFormMutation.isPending) ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {lastSavedAt ? 'Save Changes' : 'Save Draft'}
              </>
            )}
          </Button>
          <Button className="bg-brand-gradient text-white shadow-brand hover:opacity-90">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Form Details Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Form Details</CardTitle>
          <p className="text-sm text-muted-foreground">Configure form metadata and settings</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* First Row - Description and Type */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Enter a brief description of what this form is for..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Form Type</Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select form type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OJT Checklist">OJT Checklist</SelectItem>
                  <SelectItem value="Inspection">Inspection</SelectItem>
                  <SelectItem value="Audit">Audit</SelectItem>
                  <SelectItem value="Survey">Survey</SelectItem>
                  <SelectItem value="Assessment">Assessment</SelectItem>
                  <SelectItem value="Incident Report">Incident Report</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Second Row - Status, Category, and Tags */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Status */}
            <div className="space-y-2">
              <Label>Publication Status</Label>
              <div className="flex items-center space-x-4">
                <Button
                  variant={formStatus === 'Draft' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFormStatus('Draft')}
                  className={formStatus === 'Draft' ? 'bg-yellow-500 hover:bg-yellow-600' : ''}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Draft
                </Button>
                <Button
                  variant={formStatus === 'Published' ? 'default' : 'outline'}
                  size="sm"
                  onClick={handlePublish}
                  disabled={publishFormMutation.isPending || !formTitle.trim()}
                  className={formStatus === 'Published' ? 'bg-green-500 hover:bg-green-600' : ''}
                >
                  {publishFormMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Publishing...
                    </>
                  ) : (
                    <>
                      <Globe className="h-4 w-4 mr-2" />
                      {formStatus === 'Published' ? 'Published' : 'Publish'}
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {formStatus === 'Draft' 
                  ? 'Only visible to admins' 
                  : 'Visible to assigned users'}
              </p>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Training">Training</SelectItem>
                  <SelectItem value="Compliance">Compliance</SelectItem>
                  <SelectItem value="Operations">Operations</SelectItem>
                  <SelectItem value="Safety">Safety</SelectItem>
                  <SelectItem value="Quality">Quality</SelectItem>
                  <SelectItem value="HR">Human Resources</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex items-center space-x-2">
                <Input
                  placeholder="Add tag..."
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newTag.trim()) {
                      e.preventDefault();
                      setFormTags([...formTags, newTag.trim()]);
                      setNewTag('');
                    }
                  }}
                />
                <Popover open={tagPickerOpen} onOpenChange={setTagPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[250px] p-0" align="end">
                    <Command>
                      <CommandInput placeholder="Search tags..." />
                      <CommandList>
                        <CommandEmpty>No tags found.</CommandEmpty>
                        <CommandGroup heading="Suggested Tags">
                          {suggestedTags
                            .filter(tag => !formTags.includes(tag))
                            .map((tag) => (
                              <CommandItem
                                key={tag}
                                onSelect={() => {
                                  setFormTags([...formTags, tag]);
                                  setTagPickerOpen(false);
                                }}
                              >
                                <Tag className="h-4 w-4 mr-2" />
                                {tag}
                              </CommandItem>
                            ))}
                        </CommandGroup>
                        {newTag.trim() && !suggestedTags.includes(newTag.trim()) && (
                          <CommandGroup heading="Create New">
                            <CommandItem
                              onSelect={() => {
                                setFormTags([...formTags, newTag.trim()]);
                                setNewTag('');
                                setTagPickerOpen(false);
                              }}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Create &quot;{newTag.trim()}&quot;
                            </CommandItem>
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              {formTags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formTags.map((tag, index) => (
                    <Badge
                      key={index}
                      className="bg-brand-gradient text-white border-0"
                    >
                      {tag}
                      <button
                        onClick={() => setFormTags(formTags.filter((_, i) => i !== index))}
                        className="ml-2 hover:text-red-200"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Third Row - Assignments and Settings */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Assignments */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Assignments</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Assign this form to specific units or employees
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAssignmentDialog(true)}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Manage
                </Button>
              </div>
              {assignedUnits.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {assignedUnits.map((unit, index) => (
                    <Badge key={index} variant="outline">
                      {unit}
                    </Badge>
                  ))}
                </div>
              ) : (
                <div className="border border-dashed rounded-lg p-4 text-center">
                  <Users className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No assignments yet</p>
                  <p className="text-xs text-muted-foreground">Click Manage to assign</p>
                </div>
              )}
            </div>

            {/* Form Settings */}
            <div className="space-y-4">
              <Label>Form Settings</Label>
              
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <AlertCircle className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Requires Approval</p>
                    <p className="text-xs text-muted-foreground">Submissions need manager review</p>
                  </div>
                </div>
                <Switch
                  checked={requiresApproval}
                  onCheckedChange={setRequiresApproval}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Allow Anonymous</p>
                    <p className="text-xs text-muted-foreground">Users can submit without logging in</p>
                  </div>
                </div>
                <Switch
                  checked={allowAnonymous}
                  onCheckedChange={setAllowAnonymous}
                />
              </div>

              {formStatus === 'Published' && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div className="text-xs text-blue-700 dark:text-blue-300">
                      <p className="font-medium mb-1">Form is Live</p>
                      <p>This form is currently published and visible to assigned users.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Builder Interface */}
      <div className="grid grid-cols-12 gap-6 min-h-[600px]">
        {/* Left Sidebar - Block Palette */}
        <div className={`${sidebarCollapsed ? 'col-span-1' : 'col-span-2'} transition-all`}>
          <Card className="h-full">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                {!sidebarCollapsed && <CardTitle className="text-base">Block Palette</CardTitle>}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="h-8 w-8 p-0"
                >
                  {sidebarCollapsed ? <ChevronDown className="h-4 w-4" /> : <X className="h-4 w-4" />}
                </Button>
              </div>
            </CardHeader>
            {!sidebarCollapsed && (
              <CardContent className="p-0">
                <Accordion type="multiple" defaultValue={['questions', 'actions', 'content']} className="w-full">
                  {/* Question Blocks */}
                  <AccordionItem value="questions" className="border-0 px-4">
                    <AccordionTrigger className="hover:no-underline text-sm font-semibold">
                      Question Blocks
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-1">
                        {formBlocks.filter(b => b.category === 'question').map(block => (
                          <Button
                            key={block.id}
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start text-xs h-auto py-2"
                            onClick={() => addBlockToCanvas(block)}
                          >
                            <block.icon className="h-3 w-3 mr-2 flex-shrink-0" />
                            <span className="text-left">{block.label}</span>
                          </Button>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Action Blocks */}
                  <AccordionItem value="actions" className="border-0 px-4">
                    <AccordionTrigger className="hover:no-underline text-sm font-semibold">
                      Action Blocks
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-1">
                        {formBlocks.filter(b => b.category === 'action').map(block => (
                          <Button
                            key={block.id}
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start text-xs h-auto py-2"
                            onClick={() => addBlockToCanvas(block)}
                          >
                            <block.icon className="h-3 w-3 mr-2 flex-shrink-0" />
                            <span className="text-left">{block.label}</span>
                          </Button>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Content Blocks */}
                  <AccordionItem value="content" className="border-0 px-4">
                    <AccordionTrigger className="hover:no-underline text-sm font-semibold">
                      Content Blocks
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-1">
                        {formBlocks.filter(b => b.category === 'content').map(block => (
                          <Button
                            key={block.id}
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start text-xs h-auto py-2"
                            onClick={() => addBlockToCanvas(block)}
                          >
                            <block.icon className="h-3 w-3 mr-2 flex-shrink-0" />
                            <span className="text-left">{block.label}</span>
                          </Button>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            )}
          </Card>
        </div>

        {/* Center - Canvas Area */}
        <div className={`${sidebarCollapsed ? 'col-span-7' : 'col-span-6'} transition-all`}>
          <Card className="h-full">
            <CardContent className="p-6 h-full">
              <div className="flex flex-col h-full">
                {/* Start Node */}
                <div className="flex justify-center mb-4">
                  <div className="bg-green-500 text-white px-6 py-3 rounded-lg font-semibold text-sm">
                    START
                  </div>
                </div>

                {/* Canvas - Scrollable Area */}
                <div className="flex-1 overflow-y-auto space-y-4 px-4">
                  {canvasBlocks.length === 0 ? (
                    <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg">
                      <div className="text-center">
                        <Plus className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">
                          Click blocks from the palette to add them to your form
                        </p>
                      </div>
                    </div>
                  ) : (
                    canvasBlocks.map((block, index) => (
                      <div key={block.id}>
                        {/* Connection Line */}
                        <div className="flex justify-center">
                          <div className="w-0.5 h-4 bg-muted-foreground/30" />
                        </div>

                        {/* Block */}
                        <Card
                          className={`cursor-pointer transition-all ${
                            selectedBlock === block.id
                              ? 'ring-2 ring-primary shadow-md'
                              : 'hover:shadow-md'
                          }`}
                          onClick={() => setSelectedBlock(block.id)}
                          draggable
                          onDragStart={(e) => handleDragStart(e, index)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, index)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start space-x-3">
                              <GripVertical className="h-5 w-5 text-muted-foreground mt-1 cursor-grab" />
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-2">
                                  <block.icon className="h-4 w-4 text-primary" />
                                  <span className="font-semibold text-sm">{block.label}</span>
                                  {block.required && (
                                    <Badge variant="outline" className="text-xs">Required</Badge>
                                  )}
                                </div>
                                {block.required && (
                                  <p className="text-xs text-muted-foreground mb-1">Required</p>
                                )}
                                {block.description && (
                                  <p className="text-xs text-muted-foreground">{block.description}</p>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 hover:bg-destructive hover:text-destructive-foreground"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeBlockFromCanvas(block.id);
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    ))
                  )}
                </div>

                {/* End Node */}
                <div className="flex justify-center mt-4">
                  <div className="flex flex-col items-center">
                    <div className="w-0.5 h-4 bg-muted-foreground/30" />
                    <div className="bg-red-500 text-white px-6 py-3 rounded-lg font-semibold text-sm">
                      END
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Preview & Properties */}
        <div className="col-span-4">
          <Card className="h-full">
            <CardHeader className="pb-4">
              <Tabs value={propertiesTab} onValueChange={(v: any) => setPropertiesTab(v)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                  <TabsTrigger value="properties">Properties</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent className="h-[calc(100%-80px)] overflow-y-auto">
              {propertiesTab === 'preview' ? (
                <div className="space-y-4">
                  {/* Device Toggle */}
                  <div className="flex justify-center space-x-2">
                    <Button
                      variant={previewMode === 'desktop' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPreviewMode('desktop')}
                      className={previewMode === 'desktop' ? 'bg-brand-gradient' : ''}
                    >
                      <Monitor className="h-4 w-4 mr-2" />
                      Desktop
                    </Button>
                    <Button
                      variant={previewMode === 'mobile' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPreviewMode('mobile')}
                      className={previewMode === 'mobile' ? 'bg-brand-gradient' : ''}
                    >
                      <Smartphone className="h-4 w-4 mr-2" />
                      Mobile
                    </Button>
                  </div>

                  {/* Preview Area */}
                  <div className={`border rounded-lg p-4 bg-muted/30 ${previewMode === 'mobile' ? 'max-w-xs mx-auto' : ''}`}>
                    <h3 className="font-semibold mb-4">{formTitle}</h3>
                    <div className="space-y-4">
                      {canvasBlocks.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          No blocks to preview
                        </p>
                      ) : (
                        canvasBlocks.map((block) => (
                          <div key={block.id} className="space-y-2">
                            <Label className="text-sm">
                              {block.label}
                              {block.required && <span className="text-red-500 ml-1">*</span>}
                            </Label>
                            {renderFormField(block)}
                            {block.description && (
                              <p className="text-xs text-muted-foreground">{block.description}</p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedBlock ? (
                    <>
                      <div>
                        <h3 className="font-semibold mb-4">Block Properties</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Configure the selected block
                        </p>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Field Label</Label>
                          <Input placeholder="Enter field label..." />
                        </div>

                        <div className="space-y-2">
                          <Label>Placeholder Text</Label>
                          <Input placeholder="Enter placeholder text..." />
                        </div>

                        <div className="space-y-2">
                          <Label>Description / Help Text</Label>
                          <Textarea placeholder="Optional help text for users..." rows={2} />
                        </div>

                        <Separator />

                        <div className="flex items-center justify-between">
                          <Label>Required Field</Label>
                          <Switch 
                            checked={getSelectedBlockData()?.required || false}
                            onCheckedChange={(checked) => {
                              if (selectedBlock) {
                                updateBlockProperty(selectedBlock, 'required', checked);
                              }
                            }}
                          />
                        </div>

                        <Separator />

                        <Accordion type="single" collapsible>
                          <AccordionItem value="validation">
                            <AccordionTrigger className="text-sm">Validation Rules</AccordionTrigger>
                            <AccordionContent className="space-y-4">
                              <div className="space-y-2">
                                <Label className="text-sm">Validation Type</Label>
                                <Select>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select validation" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    <SelectItem value="email">Email</SelectItem>
                                    <SelectItem value="phone">Phone</SelectItem>
                                    <SelectItem value="number">Number</SelectItem>
                                    <SelectItem value="custom">Custom Regex</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label className="text-sm">Error Message</Label>
                                <Input placeholder="Custom error message..." className="text-sm" />
                              </div>
                            </AccordionContent>
                          </AccordionItem>

                          <AccordionItem value="conditional">
                            <AccordionTrigger className="text-sm">Conditional Logic</AccordionTrigger>
                            <AccordionContent className="space-y-4">
                              <div className="flex items-center justify-between">
                                <Label className="text-sm">Show/Hide based on answer</Label>
                                <Switch />
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Configure visibility rules based on previous answers
                              </p>
                            </AccordionContent>
                          </AccordionItem>

                          <AccordionItem value="scoring">
                            <AccordionTrigger className="text-sm">Scoring Options</AccordionTrigger>
                            <AccordionContent className="space-y-4">
                              <div className="flex items-center justify-between">
                                <Label className="text-sm">Include in score</Label>
                                <Switch />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-sm">Point Value</Label>
                                <Input type="number" placeholder="0" className="text-sm" />
                              </div>
                            </AccordionContent>
                          </AccordionItem>

                          <AccordionItem value="advanced">
                            <AccordionTrigger className="text-sm">Advanced Options</AccordionTrigger>
                            <AccordionContent className="space-y-4">
                              <div className="flex items-center justify-between">
                                <Label className="text-sm">Exportable</Label>
                                <Switch defaultChecked />
                              </div>
                              <div className="flex items-center justify-between">
                                <Label className="text-sm">Include in analytics</Label>
                                <Switch defaultChecked />
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-64 text-center">
                      <div>
                        <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">
                          Select a block to configure its properties
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Full Preview Modal */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Form Preview</DialogTitle>
                <DialogDescription>
                  This is how your form will appear to end users
                </DialogDescription>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant={previewDevice === 'desktop' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPreviewDevice('desktop')}
                  className={previewDevice === 'desktop' ? 'bg-brand-gradient' : ''}
                >
                  <Monitor className="h-4 w-4 mr-2" />
                  Desktop
                </Button>
                <Button
                  variant={previewDevice === 'mobile' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPreviewDevice('mobile')}
                  className={previewDevice === 'mobile' ? 'bg-brand-gradient' : ''}
                >
                  <Smartphone className="h-4 w-4 mr-2" />
                  Mobile
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="mt-6">
            <div className={`mx-auto transition-all ${previewDevice === 'mobile' ? 'max-w-md' : 'max-w-3xl'}`}>
              <Card className="shadow-lg">
                <CardHeader className="bg-brand-gradient text-white">
                  <CardTitle className="text-2xl">{formTitle}</CardTitle>
                  <p className="text-white/80 text-sm">Please complete all required fields marked with *</p>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {canvasBlocks.length === 0 ? (
                    <div className="text-center py-12">
                      <Eye className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">
                        No form blocks added yet. Add blocks from the palette to see them in the preview.
                      </p>
                    </div>
                  ) : (
                    canvasBlocks.map((block) => (
                      <div key={block.id} className="space-y-2">
                        {block.id.split('-')[0] !== 'divider' && block.category !== 'action' && (
                          <Label className="text-base">
                            {block.label}
                            {block.required && <span className="text-red-500 ml-1">*</span>}
                          </Label>
                        )}
                        {renderFormField(block)}
                        {block.description && (
                          <p className="text-sm text-muted-foreground">{block.description}</p>
                        )}
                      </div>
                    ))
                  )}

                  {canvasBlocks.length > 0 && (
                    <>
                      <Separator className="my-6" />
                      <div className="flex justify-end space-x-2">
                        <Button variant="outline">Cancel</Button>
                        <Button className="bg-brand-gradient text-white shadow-brand hover:opacity-90">
                          Submit Form
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assignment Management Dialog */}
      <Dialog open={showAssignmentDialog} onOpenChange={setShowAssignmentDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Form Assignments</DialogTitle>
            <DialogDescription>
              Select existing assignments or create a new one
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Quick Actions */}
            <div className="flex items-center justify-between">
              <Input placeholder="Search assignments..." className="max-w-sm" />
              <Button 
                className="bg-brand-gradient text-white shadow-brand hover:opacity-90"
                onClick={() => {
                  setShowAssignmentDialog(false);
                  onNavigateToAssignments?.();
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New Assignment
              </Button>
            </div>

            {/* Sample Assignments List */}
            <div className="space-y-3">
              <Label>Available Assignments</Label>
              {sampleAssignments.map((assignment) => (
                <Card
                  key={assignment.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => {
                    if (!assignedUnits.includes(assignment.name)) {
                      setAssignedUnits([...assignedUnits, assignment.name]);
                    }
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                          <Users className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2 mb-1">
                            <p className="font-semibold">{assignment.name}</p>
                            <Badge variant="outline" className="text-xs">
                              {assignment.type}
                            </Badge>
                            {assignment.active && (
                              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-0 text-xs">
                                Active
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {assignment.count} {assignment.count === 1 ? 'person' : 'people'}
                          </p>
                        </div>
                      </div>
                      <div>
                        {assignedUnits.includes(assignment.name) ? (
                          <Badge className="bg-brand-gradient text-white border-0">
                            <CheckSquare className="h-3 w-3 mr-1" />
                            Assigned
                          </Badge>
                        ) : (
                          <Button size="sm" variant="outline">
                            Select
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Currently Assigned */}
            {assignedUnits.length > 0 && (
              <div className="space-y-3">
                <Separator />
                <div>
                  <Label>Currently Assigned ({assignedUnits.length})</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    These assignments will receive this form
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {assignedUnits.map((unit, index) => (
                    <Badge key={index} variant="outline" className="px-3 py-2">
                      {unit}
                      <button
                        onClick={() => setAssignedUnits(assignedUnits.filter((_, i) => i !== index))}
                        className="ml-2 hover:text-red-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Dialog Actions */}
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowAssignmentDialog(false)}>
                Cancel
              </Button>
              <Button 
                className="bg-brand-gradient text-white shadow-brand hover:opacity-90"
                onClick={() => setShowAssignmentDialog(false)}
              >
                Save Assignments
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}