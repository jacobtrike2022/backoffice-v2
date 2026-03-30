import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Separator } from '../ui/separator';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { 
  ArrowLeft, 
  Save, 
  Eye,
  Upload,
  Bold,
  Italic,
  List,
  Link as LinkIcon,
  Send,
  X,
  Tag as TagIcon,
  Plus,
  History,
  CheckCircle,
  User,
  Briefcase,
  Users,
  Utensils,
  Shield,
  Home,
  BookOpen
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';

interface ArticleEditorProps {
  onClose: () => void;
  onSave: (content: any, publish: boolean) => void;
  onPublishAndAssign: (content: any) => void;
  initialData?: any;
}

const categories = [
  { id: 'operations', name: 'Operations', icon: Briefcase, color: 'bg-blue-100 text-blue-700' },
  { id: 'hr', name: 'HR Policies', icon: Users, color: 'bg-purple-100 text-purple-700' },
  { id: 'food-safety', name: 'Food Safety', icon: Utensils, color: 'bg-green-100 text-green-700' },
  { id: 'manager-tools', name: 'Manager Tools', icon: Shield, color: 'bg-orange-100 text-orange-700' },
  { id: 'store-procedures', name: 'Store Procedures', icon: Home, color: 'bg-pink-100 text-pink-700' }
];

const subcategoriesByCategory: Record<string, string[]> = {
  'operations': ['Opening Procedures', 'Closing Procedures', 'Daily Tasks', 'Inventory Management'],
  'hr': ['Onboarding', 'Time Off', 'Benefits', 'Performance Reviews'],
  'food-safety': ['Food Handling', 'Sanitation', 'Temperature Logs', 'Allergen Management'],
  'manager-tools': ['Coaching', 'Scheduling', 'Conflict Resolution', 'Performance Management'],
  'store-procedures': ['Customer Service', 'Cash Handling', 'Merchandising', 'Loss Prevention']
};

export function ArticleEditorNew({ onClose, onSave, onPublishAndAssign, initialData }: ArticleEditorProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [category, setCategory] = useState(initialData?.category || '');
  const [subcategory, setSubcategory] = useState(initialData?.subcategory || '');
  const [content, setContent] = useState(initialData?.content || '');
  const [tags, setTags] = useState<string[]>(initialData?.tags || []);
  const [newTag, setNewTag] = useState('');
  const [type, setType] = useState<'Required' | 'Optional' | 'Manager-Only'>(initialData?.type || 'Optional');
  const [readingTime, setReadingTime] = useState(initialData?.readingTime?.toString() || '5');
  const [author, setAuthor] = useState(initialData?.author || 'Current User');
  const [version, setVersion] = useState(initialData?.version || '1.0');
  const [showPreview, setShowPreview] = useState(false);

  // Version history (mock data for now)
  const versionHistory = [
    { version: version, date: new Date().toLocaleDateString(), isCurrent: true },
    { version: '0.9', date: 'Dec 10, 2023', isCurrent: false },
    { version: '0.8', date: 'Nov 22, 2023', isCurrent: false }
  ];

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleSaveDraft = () => {
    const articleData = {
      id: initialData?.id || `article-${Date.now()}`,
      title,
      description,
      category,
      subcategory,
      content,
      tags,
      type,
      readingTime: parseInt(readingTime),
      author,
      version,
      lastUpdated: new Date().toISOString().split('T')[0],
      viewCount: initialData?.viewCount || 0,
      linkedAssignments: initialData?.linkedAssignments || 0
    };
    onSave(articleData, false);
    toast.success(t('contentAuthoring.articleSavedDraft'));
  };

  const handlePublish = () => {
    if (!title.trim()) {
      toast.error(t('contentAuthoring.articleNeedsTitle'));
      return;
    }
    if (!content.trim()) {
      toast.error(t('contentAuthoring.articleNeedsContent'));
      return;
    }
    if (!category) {
      toast.error(t('contentAuthoring.articleNeedsCategory'));
      return;
    }

    const articleData = {
      id: initialData?.id || `article-${Date.now()}`,
      title,
      description,
      category,
      subcategory,
      content,
      tags,
      type,
      readingTime: parseInt(readingTime),
      author,
      version,
      lastUpdated: new Date().toISOString().split('T')[0],
      viewCount: initialData?.viewCount || 0,
      linkedAssignments: initialData?.linkedAssignments || 0
    };
    onSave(articleData, true);
    toast.success(t('contentAuthoring.articlePublished'));
  };

  const handlePublishAndAssign = () => {
    if (!title.trim() || !content.trim() || !category) {
      toast.error(t('contentAuthoring.completeRequiredFields'));
      return;
    }

    const articleData = {
      id: initialData?.id || `article-${Date.now()}`,
      title,
      description,
      category,
      subcategory,
      content,
      tags,
      type,
      readingTime: parseInt(readingTime),
      author,
      version,
      lastUpdated: new Date().toISOString().split('T')[0],
      viewCount: initialData?.viewCount || 0,
      linkedAssignments: initialData?.linkedAssignments || 0,
      contentType: 'article'
    };
    onPublishAndAssign(articleData);
    toast.success(t('contentAuthoring.articlePublishedRedirecting'));
  };

  const insertFormatting = (before: string, after: string = '') => {
    const textarea = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement;
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
            <h1 className="text-foreground">{t('contentAuthoring.articlePreviewTitle')}</h1>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={handleSaveDraft}>
              <Save className="h-4 w-4 mr-2" />
              Save Draft
            </Button>
            <Button className="bg-brand-gradient text-white shadow-brand" onClick={handlePublishAndAssign}>
              <Send className="h-4 w-4 mr-2" />
              Publish & Assign
            </Button>
          </div>
        </div>

        {/* Preview Content - Matches KB Article View */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-8">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-3">
                      <Badge 
                        variant="outline"
                        className={
                          type === 'Required' 
                            ? 'bg-red-100 text-red-700 border-red-200'
                            : type === 'Manager-Only'
                            ? 'bg-purple-100 text-purple-700 border-purple-200'
                            : 'bg-blue-100 text-blue-700 border-blue-200'
                        }
                      >
                        {type}
                      </Badge>
                    </div>
                    <h1 className="text-foreground mb-4">{title || 'Untitled Article'}</h1>
                    <p className="text-muted-foreground text-lg">{description}</p>
                  </div>
                </div>

                <div className="flex items-center flex-wrap gap-4 pb-6 border-b border-border">
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <BookOpen className="h-4 w-4" />
                    <span>{readingTime} min read</span>
                  </div>
                  <div className="flex flex-wrap gap-2 ml-auto">
                    {tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        <TagIcon className="h-3 w-3 mr-1" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="pt-6 prose prose-sm max-w-none">
                  {content.split('\n\n').map((block, index) => {
                    if (block.startsWith('# ')) {
                      return <h1 key={index} className="text-foreground">{block.substring(2)}</h1>;
                    } else if (block.startsWith('## ')) {
                      return <h2 key={index} className="text-foreground mt-8 mb-4">{block.substring(3)}</h2>;
                    } else if (block.startsWith('### ')) {
                      return <h3 key={index} className="text-foreground mt-6 mb-3">{block.substring(4)}</h3>;
                    } else if (block.startsWith('- ')) {
                      const items = block.split('\n').filter(line => line.startsWith('- '));
                      return (
                        <ul key={index} className="space-y-2 ml-4 list-disc list-inside">
                          {items.map((item, i) => (
                            <li key={i} className="text-foreground">{item.substring(2)}</li>
                          ))}
                        </ul>
                      );
                    } else {
                      return <p key={index} className="text-foreground leading-relaxed">{block}</p>;
                    }
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Info Panel */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Article Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Category</Label>
                  <p className="text-sm font-medium mt-1">
                    {categories.find(c => c.id === category)?.name || 'Not set'}
                  </p>
                </div>
                {subcategory && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Subcategory</Label>
                    <p className="text-sm font-medium mt-1">{subcategory}</p>
                  </div>
                )}
                <Separator />
                <div>
                  <Label className="text-xs text-muted-foreground">Author</Label>
                  <div className="flex items-center space-x-2 mt-1">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {author.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{author}</span>
                  </div>
                </div>
                <Separator />
                <div>
                  <Label className="text-xs text-muted-foreground">Version</Label>
                  <p className="text-sm font-medium mt-1">v{version}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
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
            Back
          </Button>
          <div>
            <h1 className="text-foreground">{initialData ? 'Edit Article' : 'New Article'}</h1>
            <p className="text-sm text-muted-foreground">Knowledge Base Article</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => setShowPreview(true)}>
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button variant="outline" onClick={handleSaveDraft}>
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>
          <Button className="bg-brand-gradient text-white shadow-brand" onClick={handlePublishAndAssign}>
            <Send className="h-4 w-4 mr-2" />
            Publish & Assign
          </Button>
        </div>
      </div>

      {/* Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Editor */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Article Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Title */}
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="Enter article title..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-2"
                />
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="description">Description *</Label>
                <Input
                  id="description"
                  placeholder="Brief description of the article..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-2"
                />
              </div>

              <Separator />

              {/* Category & Subcategory */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category">Category *</Label>
                  <Select value={category} onValueChange={(value) => {
                    setCategory(value);
                    setSubcategory(''); // Reset subcategory when category changes
                  }}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select category..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="subcategory">Subcategory</Label>
                  <Select 
                    value={subcategory} 
                    onValueChange={setSubcategory}
                    disabled={!category}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select subcategory..." />
                    </SelectTrigger>
                    <SelectContent>
                      {category && subcategoriesByCategory[category]?.map((sub) => (
                        <SelectItem key={sub} value={sub}>
                          {sub}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Type & Reading Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="type">Article Type *</Label>
                  <Select value={type} onValueChange={(value: any) => setType(value)}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Required">Required</SelectItem>
                      <SelectItem value="Optional">Optional</SelectItem>
                      <SelectItem value="Manager-Only">Manager-Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="readingTime">Reading Time (minutes)</Label>
                  <Input
                    id="readingTime"
                    type="number"
                    min="1"
                    value={readingTime}
                    onChange={(e) => setReadingTime(e.target.value)}
                    className="mt-2"
                  />
                </div>
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
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => insertFormatting('### ')}
                  title="Subheading"
                >
                  <span className="text-xs font-semibold">H3</span>
                </Button>
              </div>

              {/* Content */}
              <div>
                <Label htmlFor="content">Article Content *</Label>
                <Textarea
                  id="content"
                  name="content"
                  placeholder="Write your article content here... You can use markdown formatting."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="mt-2 min-h-[500px] font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Supports markdown formatting: **bold**, *italic*, # headings, - lists
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Tags */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tags</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2 mb-3">
                {tags.map((tag) => (
                  <Badge 
                    key={tag} 
                    variant="secondary"
                    className="flex items-center gap-1 pl-2 pr-1"
                  >
                    <span>{tag}</span>
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 hover:bg-accent rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex space-x-2">
                <Input
                  placeholder="Add tag..."
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={handleAddTag}
                  disabled={!newTag.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Article Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Article Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="author">Author</Label>
                <Input
                  id="author"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="mt-2"
                />
              </div>
              
              <Separator />

              <div>
                <Label htmlFor="version">Version</Label>
                <Input
                  id="version"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  className="mt-2"
                />
              </div>

              <Separator />

              <div>
                <p className="text-xs text-muted-foreground">Last Updated</p>
                <p className="text-sm font-medium mt-1">
                  {new Date().toLocaleDateString('en-US', { 
                    month: 'long', 
                    day: 'numeric', 
                    year: 'numeric' 
                  })}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Version History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center space-x-2">
                <History className="h-4 w-4 text-primary" />
                <span>Version History</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                {versionHistory.map((v, idx) => (
                  <div 
                    key={idx}
                    className={`flex items-start space-x-3 p-2 rounded-lg ${v.isCurrent ? 'bg-accent' : ''}`}
                  >
                    {v.isCurrent ? (
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2 border-muted-foreground mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className={`text-sm ${v.isCurrent ? 'font-medium' : 'font-medium text-muted-foreground'}`}>
                        v{v.version} {v.isCurrent && '(Current)'}
                      </p>
                      <p className="text-xs text-muted-foreground">{v.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Publishing Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Publishing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
