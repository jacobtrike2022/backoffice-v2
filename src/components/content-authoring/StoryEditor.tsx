import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Separator } from '../ui/separator';
import { Badge } from '../ui/badge';
import { 
  ArrowLeft, 
  Save, 
  Eye,
  Upload,
  Image as ImageIcon,
  Video as VideoIcon,
  Send,
  X,
  Smartphone,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';

interface StoryEditorProps {
  onClose: () => void;
  onSave: (content: any, publish: boolean) => void;
  onPublishAndAssign: (content: any) => void;
  initialData?: any;
}

export function StoryEditor({ onClose, onSave, onPublishAndAssign, initialData }: StoryEditorProps) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [image1, setImage1] = useState<string>('');
  const [video, setVideo] = useState<string>('');
  const [image2, setImage2] = useState<string>('');
  const [objectives, setObjectives] = useState<string[]>(['']);
  const [notes, setNotes] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const handleImageUpload = (position: 1 | 2) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (position === 1) {
          setImage1(reader.result as string);
        } else {
          setImage2(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
      toast.success(`Image ${position} uploaded successfully`);
    }
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setVideo(reader.result as string);
      };
      reader.readAsDataURL(file);
      toast.success('Video uploaded successfully');
    }
  };

  const handleSaveDraft = () => {
    const storyData = {
      title,
      image1,
      video,
      image2,
      objectives: objectives.filter(o => o.trim() !== ''),
      notes
    };
    onSave(storyData, false);
    toast.success('Story saved as draft');
  };

  const handlePublishAndAssign = () => {
    if (!title.trim()) {
      toast.error('Please add a title before publishing');
      return;
    }
    if (!image1 || !video || !image2) {
      toast.error('Please upload all required content (Image → Video → Image)');
      return;
    }

    const storyData = {
      title,
      image1,
      video,
      image2,
      objectives: objectives.filter(o => o.trim() !== ''),
      notes,
      type: 'story'
    };
    onPublishAndAssign(storyData);
    toast.success('Story published! Redirecting to assignment...');
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

  if (showPreview) {
    return (
      <div className="space-y-6">
        {/* Preview Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" onClick={() => setShowPreview(false)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Editor
            </Button>
            <h1 className="text-foreground">Story Preview</h1>
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

        {/* Mobile Preview */}
        <div className="flex justify-center">
          <div className="w-full max-w-sm">
            <Card className="overflow-hidden">
              <CardHeader className="bg-accent/50">
                <div className="flex items-center justify-center space-x-2">
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Portrait Mode Preview</p>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-0">
                  {/* Slide 1 - Image */}
                  {image1 && (
                    <div className="relative aspect-[9/16] bg-black">
                      <img src={image1} alt="Slide 1" className="w-full h-full object-cover" />
                      <div className="absolute bottom-4 left-4 right-4">
                        <div className="bg-black/60 backdrop-blur-sm rounded-lg p-3">
                          <h3 className="text-white font-semibold">{title}</h3>
                          <p className="text-white/80 text-xs mt-1">Tap to continue</p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Divider */}
                  <div className="flex items-center justify-center py-2 bg-accent">
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>

                  {/* Slide 2 - Video */}
                  {video && (
                    <div className="relative aspect-[9/16] bg-black flex items-center justify-center">
                      <VideoIcon className="h-16 w-16 text-white/80" />
                      <div className="absolute bottom-4 left-4 right-4">
                        <div className="bg-black/60 backdrop-blur-sm rounded-lg p-2 text-center">
                          <p className="text-white text-xs">Video Content</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Divider */}
                  <div className="flex items-center justify-center py-2 bg-accent">
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>

                  {/* Slide 3 - Image */}
                  {image2 && (
                    <div className="relative aspect-[9/16] bg-black">
                      <img src={image2} alt="Slide 3" className="w-full h-full object-cover" />
                      <div className="absolute bottom-4 left-4 right-4">
                        <div className="bg-black/60 backdrop-blur-sm rounded-lg p-3">
                          <p className="text-white text-sm font-medium">Story Complete!</p>
                        </div>
                      </div>
                    </div>
                  )}
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
            <h1 className="text-foreground">Story Editor</h1>
            <p className="text-sm text-muted-foreground">Portrait mode: Image → Video → Image</p>
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
              <CardTitle>Story Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Title */}
              <div>
                <Label htmlFor="title">Story Title *</Label>
                <Input
                  id="title"
                  placeholder="Enter story title..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-2"
                />
              </div>
            </CardContent>
          </Card>

          {/* Story Sequence */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Smartphone className="h-5 w-5 mr-2 text-primary" />
                Story Sequence (Portrait Mode)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Slide 1 - Image */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Slide 1: Opening Image *</Label>
                  <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400">
                    Portrait 9:16
                  </Badge>
                </div>
                {image1 ? (
                  <div className="relative">
                    <div className="aspect-[9/16] max-h-96 mx-auto rounded-lg overflow-hidden">
                      <img src={image1} alt="Slide 1" className="w-full h-full object-cover" />
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => setImage1('')}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full aspect-[9/16] max-h-96 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors">
                    <div className="flex flex-col items-center justify-center">
                      <ImageIcon className="w-12 h-12 mb-3 text-muted-foreground" />
                      <p className="mb-2 text-sm text-muted-foreground font-semibold">Upload Opening Image</p>
                      <p className="text-xs text-muted-foreground">Portrait format (9:16 ratio recommended)</p>
                    </div>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*"
                      onChange={handleImageUpload(1)}
                    />
                  </label>
                )}
              </div>

              <div className="flex items-center justify-center">
                <ChevronRight className="h-6 w-6 text-muted-foreground" />
              </div>

              {/* Slide 2 - Video */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Slide 2: Video Content *</Label>
                  <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400">
                    Portrait 9:16
                  </Badge>
                </div>
                {video ? (
                  <div className="relative">
                    <div className="aspect-[9/16] max-h-96 mx-auto rounded-lg overflow-hidden bg-black flex items-center justify-center">
                      <VideoIcon className="h-16 w-16 text-white/80" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-4 left-4 right-4">
                        <p className="text-white text-sm">Video uploaded</p>
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => setVideo('')}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full aspect-[9/16] max-h-96 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors">
                    <div className="flex flex-col items-center justify-center">
                      <VideoIcon className="w-12 h-12 mb-3 text-muted-foreground" />
                      <p className="mb-2 text-sm text-muted-foreground font-semibold">Upload Video</p>
                      <p className="text-xs text-muted-foreground">Portrait format (9:16 ratio recommended)</p>
                      <p className="text-xs text-muted-foreground mt-1">MP4, MOV (MAX. 100MB)</p>
                    </div>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="video/*"
                      onChange={handleVideoUpload}
                    />
                  </label>
                )}
              </div>

              <div className="flex items-center justify-center">
                <ChevronRight className="h-6 w-6 text-muted-foreground" />
              </div>

              {/* Slide 3 - Image */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Slide 3: Closing Image *</Label>
                  <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400">
                    Portrait 9:16
                  </Badge>
                </div>
                {image2 ? (
                  <div className="relative">
                    <div className="aspect-[9/16] max-h-96 mx-auto rounded-lg overflow-hidden">
                      <img src={image2} alt="Slide 3" className="w-full h-full object-cover" />
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => setImage2('')}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full aspect-[9/16] max-h-96 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors">
                    <div className="flex flex-col items-center justify-center">
                      <ImageIcon className="w-12 h-12 mb-3 text-muted-foreground" />
                      <p className="mb-2 text-sm text-muted-foreground font-semibold">Upload Closing Image</p>
                      <p className="text-xs text-muted-foreground">Portrait format (9:16 ratio recommended)</p>
                    </div>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*"
                      onChange={handleImageUpload(2)}
                    />
                  </label>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Add any additional notes or instructions for learners..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Learning Objectives</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {objectives.map((objective, index) => (
                <div key={index} className="flex items-start space-x-2">
                  <Input
                    placeholder={`Objective ${index + 1}`}
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
                <p className="font-medium text-foreground">Story (Portrait)</p>
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground">Format</p>
                <p className="font-medium text-foreground">Image → Video → Image</p>
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground mb-2">Quick Actions</p>
                <div className="space-y-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => onSave({ title, image1, video, image2, objectives, notes }, true)}
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