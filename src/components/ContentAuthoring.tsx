import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { 
  FileText, 
  Video, 
  Image as ImageIcon, 
  CheckCircle,
  Plus,
  Eye,
  Edit,
  Trash2,
  Play
} from 'lucide-react';
import { ArticleEditor } from './content-authoring/ArticleEditor';
import { ArticleEditorNew } from './content-authoring/ArticleEditorNew';
import { VideoEditor } from './content-authoring/VideoEditor';
import { StoryEditor } from './content-authoring/StoryEditor';
import { CheckpointEditor } from './content-authoring/CheckpointEditor';

type ContentType = 'article' | 'video' | 'story' | 'checkpoint' | null;

interface SavedContent {
  id: string;
  type: 'article' | 'video' | 'story' | 'checkpoint';
  title: string;
  status: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
}

const contentTypes = [
  {
    id: 'article',
    name: 'Article',
    description: 'Create text-based content with rich formatting, images, and headers',
    icon: FileText,
    color: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
    borderColor: 'border-blue-200 dark:border-blue-800'
  },
  {
    id: 'video',
    name: 'Video',
    description: 'Upload or embed video content with learning objectives and metadata',
    icon: Video,
    color: 'bg-purple-100 dark:bg-purple-900/30',
    iconColor: 'text-purple-600 dark:text-purple-400',
    borderColor: 'border-purple-200 dark:border-purple-800'
  },
  {
    id: 'story',
    name: 'Story',
    description: 'Create engaging portrait-mode stories with image-video-image sequences',
    icon: ImageIcon,
    color: 'bg-pink-100 dark:bg-pink-900/30',
    iconColor: 'text-pink-600 dark:text-pink-400',
    borderColor: 'border-pink-200 dark:border-pink-800'
  },
  {
    id: 'checkpoint',
    name: 'Checkpoint',
    description: 'Build interactive quizzes with multiple choice questions and scoring',
    icon: CheckCircle,
    color: 'bg-green-100 dark:bg-green-900/30',
    iconColor: 'text-green-600 dark:text-green-400',
    borderColor: 'border-green-200 dark:border-green-800'
  }
];

// Mock saved content
const mockSavedContent: SavedContent[] = [
  {
    id: '1',
    type: 'article',
    title: 'Customer Service Best Practices',
    status: 'published',
    createdAt: '2024-06-15',
    updatedAt: '2024-06-20'
  },
  {
    id: '2',
    type: 'video',
    title: 'Product Safety Overview',
    status: 'published',
    createdAt: '2024-06-18',
    updatedAt: '2024-06-18'
  },
  {
    id: '3',
    type: 'checkpoint',
    title: 'Sales Techniques Assessment',
    status: 'draft',
    createdAt: '2024-06-22',
    updatedAt: '2024-06-25'
  }
];

interface ContentAuthoringProps {
  onNavigateToAssignment?: () => void;
  editingArticle?: any;
  onClearEditingArticle?: () => void;
}

export function ContentAuthoring({ onNavigateToAssignment, editingArticle, onClearEditingArticle }: ContentAuthoringProps) {
  const [selectedType, setSelectedType] = useState<ContentType>(null);
  const [savedContent, setSavedContent] = useState<SavedContent[]>(mockSavedContent);
  const [editingContent, setEditingContent] = useState<SavedContent | null>(null);

  // If editingArticle is passed from Knowledge Base, automatically open the editor
  useEffect(() => {
    if (editingArticle) {
      setSelectedType('article');
    }
  }, [editingArticle]);

  const handleCreateNew = (type: ContentType) => {
    setSelectedType(type);
    setEditingContent(null);
  };

  const handleClose = () => {
    setSelectedType(null);
    setEditingContent(null);
  };

  const handleSave = (content: any, publish: boolean) => {
    // In a real app, this would save to the backend
    const newContent: SavedContent = {
      id: Date.now().toString(),
      type: selectedType as any,
      title: content.title || 'Untitled',
      status: publish ? 'published' : 'draft',
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0]
    };
    
    setSavedContent(prev => [newContent, ...prev]);
    setSelectedType(null);
  };

  const handlePublishAndAssign = (content: any) => {
    handleSave(content, true);
    // Navigate to assignment flow
    if (onNavigateToAssignment) {
      onNavigateToAssignment();
    }
  };

  const getContentTypeInfo = (type: string) => {
    return contentTypes.find(ct => ct.id === type);
  };

  // If editing a specific content type
  if (selectedType) {
    const commonProps = {
      onClose: handleClose,
      onSave: handleSave,
      onPublishAndAssign: handlePublishAndAssign,
      initialData: editingArticle || editingContent
    };

    switch (selectedType) {
      case 'article':
        return <ArticleEditorNew {...commonProps} />;
      case 'video':
        return <VideoEditor {...commonProps} />;
      case 'story':
        return <StoryEditor {...commonProps} />;
      case 'checkpoint':
        return <CheckpointEditor {...commonProps} />;
      default:
        return null;
    }
  }

  // Main content authoring view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-foreground">Content Authoring</h1>
        <p className="text-muted-foreground mt-1">
          Create and manage learning content for your organization
        </p>
      </div>

      {/* Content Type Cards */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Create New Content</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {contentTypes.map((type) => {
            const Icon = type.icon;
            return (
              <Card 
                key={type.id}
                className={`cursor-pointer transition-all hover:shadow-lg hover:scale-105 border-2 ${type.borderColor} group`}
                onClick={() => handleCreateNew(type.id as ContentType)}
              >
                <CardContent className="p-6">
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className={`h-16 w-16 rounded-xl ${type.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                      <Icon className={`h-8 w-8 ${type.iconColor}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">{type.name}</h3>
                      <p className="text-xs text-muted-foreground">{type.description}</p>
                    </div>
                    <Button size="sm" className="w-full bg-brand-gradient text-white shadow-brand">
                      <Plus className="h-4 w-4 mr-2" />
                      Create {type.name}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Saved Content */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Recent Content</h2>
          <Button variant="outline" size="sm">
            View All
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {savedContent.length === 0 ? (
                <div className="p-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No content created yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Get started by creating your first piece of content above
                  </p>
                </div>
              ) : (
                savedContent.map((content) => {
                  const typeInfo = getContentTypeInfo(content.type);
                  if (!typeInfo) return null;
                  
                  const Icon = typeInfo.icon;
                  
                  return (
                    <div 
                      key={content.id}
                      className="p-4 hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className={`h-12 w-12 rounded-lg ${typeInfo.color} flex items-center justify-center`}>
                            <Icon className={`h-6 w-6 ${typeInfo.iconColor}`} />
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <h3 className="font-semibold text-foreground">{content.title}</h3>
                              <Badge 
                                variant="outline"
                                className={content.status === 'published' 
                                  ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400'
                                  : 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400'
                                }
                              >
                                {content.status}
                              </Badge>
                            </div>
                            <div className="flex items-center space-x-3 text-xs text-muted-foreground mt-1">
                              <span className="capitalize">{content.type}</span>
                              <span>•</span>
                              <span>Created {content.createdAt}</span>
                              <span>•</span>
                              <span>Updated {content.updatedAt}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4 mr-2" />
                            Preview
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setEditingContent(content);
                              setSelectedType(content.type);
                            }}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                          {content.status === 'published' && (
                            <Button 
                              size="sm" 
                              className="bg-brand-gradient text-white shadow-brand hover:opacity-90 border-0"
                              onClick={() => onNavigateToAssignment?.()}
                            >
                              <Play className="h-4 w-4 mr-2" />
                              Assign
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}