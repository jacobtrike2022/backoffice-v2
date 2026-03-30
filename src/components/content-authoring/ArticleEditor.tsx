import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Separator } from '../ui/separator';
import { 
  ArrowLeft, 
  Save, 
  Eye,
  Upload,
  Image as ImageIcon,
  Bold,
  Italic,
  List,
  Link as LinkIcon,
  AlignLeft,
  AlignCenter,
  Send,
  X
} from 'lucide-react';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { toast } from 'sonner@2.0.3';

interface ArticleEditorProps {
  onClose: () => void;
  onSave: (content: any, publish: boolean) => void;
  onPublishAndAssign: (content: any) => void;
  initialData?: any;
}

export function ArticleEditor({ onClose, onSave, onPublishAndAssign, initialData }: ArticleEditorProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(initialData?.title || '');
  const [subtitle, setSubtitle] = useState('');
  const [headerImage, setHeaderImage] = useState<string>('');
  const [content, setContent] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [objectives, setObjectives] = useState<string[]>(['']);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // In a real app, upload to storage
      const reader = new FileReader();
      reader.onloadend = () => {
        setHeaderImage(reader.result as string);
      };
      reader.readAsDataURL(file);
      toast.success(t('contentAuthoring.imageUploadedSuccess'));
    }
  };

  const handleSaveDraft = () => {
    const articleData = {
      title,
      subtitle,
      headerImage,
      content,
      objectives: objectives.filter(o => o.trim() !== '')
    };
    onSave(articleData, false);
    toast.success(t('contentAuthoring.articleSavedAsDraft'));
  };

  const handlePublish = () => {
    if (!title.trim()) {
      toast.error(t('contentAuthoring.titleRequiredError'));
      return;
    }
    if (!content.trim()) {
      toast.error(t('contentAuthoring.contentRequiredError'));
      return;
    }

    const articleData = {
      title,
      subtitle,
      headerImage,
      content,
      objectives: objectives.filter(o => o.trim() !== '')
    };
    onSave(articleData, true);
    toast.success(t('contentAuthoring.articlePublishedSuccess'));
  };

  const handlePublishAndAssign = () => {
    if (!title.trim() || !content.trim()) {
      toast.error(t('contentAuthoring.completeRequiredFields'));
      return;
    }

    const articleData = {
      title,
      subtitle,
      headerImage,
      content,
      objectives: objectives.filter(o => o.trim() !== ''),
      type: 'article'
    };
    onPublishAndAssign(articleData);
    toast.success(t('contentAuthoring.articlePublishedRedirecting'));
  };

  const addObjective = () => {
    setObjectives([...objectives, '']);
  };

  const updateObjective = (index: number, value: string) => {
    const updated = [...objectives];
    updated[index] = value;
    setObjectives(updated);
  };

  const removeObjective = (index: number) => {
    setObjectives(objectives.filter((_, i) => i !== index));
  };

  // Simple text formatting helpers
  const insertFormatting = (before: string, after: string = '') => {
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const newText = content.substring(0, start) + before + selectedText + after + content.substring(end);
    
    setContent(newText);
  };

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
            <h1 className="text-foreground">{t('contentAuthoring.articlePreview')}</h1>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={handleSaveDraft}>
              <Save className="h-4 w-4 mr-2" />
              {t('contentAuthoring.saveDraft')}
            </Button>
            <Button className="bg-brand-gradient text-white shadow-brand" onClick={handlePublishAndAssign}>
              <Send className="h-4 w-4 mr-2" />
              {t('contentAuthoring.publishAndAssign')}
            </Button>
          </div>
        </div>

        {/* Preview Content */}
        <Card className="max-w-4xl mx-auto">
          <CardContent className="p-0">
            {headerImage && (
              <div className="w-full h-64 overflow-hidden rounded-t-lg">
                <ImageWithFallback 
                  src={headerImage} 
                  alt="Article header"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="p-8">
              <h1 className="text-3xl font-bold text-foreground mb-2">{title || 'Untitled Article'}</h1>
              {subtitle && (
                <h2 className="text-xl text-muted-foreground mb-6">{subtitle}</h2>
              )}
              <Separator className="my-6" />
              <div className="prose prose-sm max-w-none">
                <div className="whitespace-pre-wrap text-foreground">{content}</div>
              </div>
              {objectives.filter(o => o.trim()).length > 0 && (
                <>
                  <Separator className="my-6" />
                  <div>
                    <h3 className="font-semibold text-foreground mb-3">{t('contentAuthoring.keyFacts')}</h3>
                    <ul className="space-y-2">
                      {objectives.filter(o => o.trim()).map((obj, idx) => (
                        <li key={idx} className="text-sm text-muted-foreground flex items-start">
                          <span className="text-primary mr-2">•</span>
                          {obj}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" onClick={onClose}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('common.back')}
          </Button>
          <h1 className="text-foreground">{t('contentAuthoring.articleEditor')}</h1>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => setShowPreview(true)}>
            <Eye className="h-4 w-4 mr-2" />
            {t('contentAuthoring.preview')}
          </Button>
          <Button variant="outline" onClick={handleSaveDraft}>
            <Save className="h-4 w-4 mr-2" />
            {t('contentAuthoring.saveDraft')}
          </Button>
          <Button className="bg-brand-gradient text-white shadow-brand" onClick={handlePublishAndAssign}>
            <Send className="h-4 w-4 mr-2" />
            {t('contentAuthoring.publishAndAssign')}
          </Button>
        </div>
      </div>

      {/* Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Editor */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('contentAuthoring.articleContent')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Header Image */}
              <div>
                <Label>{t('contentAuthoring.headerImage')}</Label>
                <div className="mt-2">
                  {headerImage ? (
                    <div className="relative">
                      <ImageWithFallback 
                        src={headerImage}
                        alt="Header"
                        className="w-full h-48 object-cover rounded-lg"
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => setHeaderImage('')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-10 h-10 mb-3 text-muted-foreground" />
                        <p className="mb-2 text-sm text-muted-foreground">
                          <span className="font-semibold">{t('contentAuthoring.clickToUpload')}</span> {t('contentAuthoring.orDragAndDrop')}
                        </p>
                        <p className="text-xs text-muted-foreground">{t('contentAuthoring.imageFileTypes')}</p>
                      </div>
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*"
                        onChange={handleImageUpload}
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Title */}
              <div>
                <Label htmlFor="title">{t('contentAuthoring.titleLabel')}</Label>
                <Input
                  id="title"
                  placeholder={t('contentAuthoring.articleTitlePlaceholder')}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-2"
                />
              </div>

              {/* Subtitle */}
              <div>
                <Label htmlFor="subtitle">{t('contentAuthoring.subtitleLabel')}</Label>
                <Input
                  id="subtitle"
                  placeholder={t('contentAuthoring.subtitlePlaceholder')}
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  className="mt-2"
                />
              </div>

              <Separator />

              {/* Formatting Toolbar */}
              <div className="flex items-center space-x-1 p-2 bg-accent/50 rounded-lg">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => insertFormatting('**', '**')}
                  title="Bold"
                >
                  <Bold className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => insertFormatting('*', '*')}
                  title="Italic"
                >
                  <Italic className="h-4 w-4" />
                </Button>
                <Separator orientation="vertical" className="h-6 mx-1" />
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => insertFormatting('- ')}
                  title="List"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => insertFormatting('[Link Text](url)')}
                  title="Link"
                >
                  <LinkIcon className="h-4 w-4" />
                </Button>
                <Separator orientation="vertical" className="h-6 mx-1" />
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => insertFormatting('# ')}
                  title="Heading"
                >
                  <span className="text-xs font-semibold">H1</span>
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => insertFormatting('## ')}
                  title="Subheading"
                >
                  <span className="text-xs font-semibold">H2</span>
                </Button>
              </div>

              {/* Content */}
              <div>
                <Label htmlFor="content">{t('contentAuthoring.articleContentLabel')}</Label>
                <Textarea
                  id="content"
                  placeholder={t('contentAuthoring.articleContentPlaceholder')}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="mt-2 min-h-[400px] font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t('contentAuthoring.markdownHint')}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('contentAuthoring.keyFacts')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {objectives.map((objective, index) => (
                <div key={index} className="flex items-start space-x-2">
                  <Input
                    placeholder={t('contentAuthoring.objectivePlaceholder', { number: index + 1 })}
                    value={objective}
                    onChange={(e) => updateObjective(index, e.target.value)}
                    className="flex-1"
                  />
                  {objectives.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeObjective(index)}
                      className="flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={addObjective}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                Add Objective
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Publishing Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Status</p>
                <p className="font-medium text-foreground">Draft</p>
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground">Content Type</p>
                <p className="font-medium text-foreground">Article</p>
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground mb-2">Quick Actions</p>
                <div className="space-y-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={handlePublish}
                  >
                    Publish Now
                  </Button>
                  <Button 
                    size="sm" 
                    className="w-full bg-brand-gradient text-white shadow-brand"
                    onClick={handlePublishAndAssign}
                  >
                    Publish & Assign to Users
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}