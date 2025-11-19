import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Separator } from '../ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
  ArrowLeft, 
  Save, 
  Eye,
  Upload,
  Video as VideoIcon,
  Link as LinkIcon,
  Send,
  X,
  Play
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';

interface VideoEditorProps {
  onClose: () => void;
  onSave: (content: any, publish: boolean) => void;
  onPublishAndAssign: (content: any) => void;
  initialData?: any;
}

export function VideoEditor({ onClose, onSave, onPublishAndAssign, initialData }: VideoEditorProps) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState('');
  const [videoSource, setVideoSource] = useState<'upload' | 'url'>('upload');
  const [videoFile, setVideoFile] = useState<string>('');
  const [videoUrl, setVideoUrl] = useState('');
  const [thumbnail, setThumbnail] = useState<string>('');
  const [duration, setDuration] = useState('');
  const [objectives, setObjectives] = useState<string[]>(['']);
  const [notes, setNotes] = useState('');

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // In a real app, upload to storage
      const reader = new FileReader();
      reader.onloadend = () => {
        setVideoFile(reader.result as string);
      };
      reader.readAsDataURL(file);
      toast.success('Video uploaded successfully');
    }
  };

  const handleThumbnailUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setThumbnail(reader.result as string);
      };
      reader.readAsDataURL(file);
      toast.success('Thumbnail uploaded successfully');
    }
  };

  const handleSaveDraft = () => {
    const videoData = {
      title,
      description,
      videoSource,
      videoFile,
      videoUrl,
      thumbnail,
      duration,
      objectives: objectives.filter(o => o.trim() !== ''),
      notes
    };
    onSave(videoData, false);
    toast.success('Video saved as draft');
  };

  const handlePublishAndAssign = () => {
    if (!title.trim()) {
      toast.error('Please add a title before publishing');
      return;
    }
    if (!videoFile && !videoUrl) {
      toast.error('Please upload a video or provide a URL');
      return;
    }

    const videoData = {
      title,
      description,
      videoSource,
      videoFile,
      videoUrl,
      thumbnail,
      duration,
      objectives: objectives.filter(o => o.trim() !== ''),
      notes,
      type: 'video'
    };
    onPublishAndAssign(videoData);
    toast.success('Video published! Redirecting to assignment...');
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" onClick={onClose}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-foreground">Video Editor</h1>
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

      {/* Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Editor */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Video Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Title */}
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="Enter video title..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-2"
                />
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Enter video description..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-2"
                  rows={3}
                />
              </div>

              <Separator />

              {/* Video Source */}
              <div>
                <Label>Video Source *</Label>
                <Tabs value={videoSource} onValueChange={(v) => setVideoSource(v as any)} className="mt-2">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="upload">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                    </TabsTrigger>
                    <TabsTrigger value="url">
                      <LinkIcon className="h-4 w-4 mr-2" />
                      URL
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="upload" className="mt-4">
                    {videoFile ? (
                      <div className="relative">
                        <div className="w-full aspect-video bg-accent rounded-lg flex items-center justify-center">
                          <div className="text-center">
                            <VideoIcon className="h-16 w-16 text-primary mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">Video uploaded</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Click to replace or remove
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={() => setVideoFile('')}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full aspect-video border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <Upload className="w-12 h-12 mb-3 text-muted-foreground" />
                          <p className="mb-2 text-sm text-muted-foreground">
                            <span className="font-semibold">Click to upload video</span> or drag and drop
                          </p>
                          <p className="text-xs text-muted-foreground">MP4, MOV, or AVI (MAX. 500MB)</p>
                        </div>
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="video/*"
                          onChange={handleVideoUpload}
                        />
                      </label>
                    )}
                  </TabsContent>

                  <TabsContent value="url" className="mt-4">
                    <div className="space-y-3">
                      <Input
                        placeholder="https://www.youtube.com/watch?v=... or Vimeo URL"
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                      />
                      {videoUrl && (
                        <div className="w-full aspect-video bg-accent rounded-lg flex items-center justify-center">
                          <div className="text-center">
                            <Play className="h-16 w-16 text-primary mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">Video URL set</p>
                            <p className="text-xs text-muted-foreground mt-1 px-4 truncate max-w-md">
                              {videoUrl}
                            </p>
                          </div>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Supports YouTube, Vimeo, and direct video URLs
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              <Separator />

              {/* Thumbnail */}
              <div>
                <Label>Custom Thumbnail (Optional)</Label>
                <div className="mt-2">
                  {thumbnail ? (
                    <div className="relative">
                      <img 
                        src={thumbnail}
                        alt="Thumbnail"
                        className="w-full aspect-video object-cover rounded-lg"
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => setThumbnail('')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors">
                      <div className="flex flex-col items-center justify-center">
                        <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">Upload thumbnail image</p>
                      </div>
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*"
                        onChange={handleThumbnailUpload}
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Duration */}
              <div>
                <Label htmlFor="duration">Duration (Optional)</Label>
                <Input
                  id="duration"
                  placeholder="e.g., 5:30 or 5 minutes"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="mt-2"
                />
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
                <p className="font-medium text-foreground">Video</p>
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground mb-2">Quick Actions</p>
                <div className="space-y-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => onSave({ title, description, videoFile, videoUrl, thumbnail, duration, objectives, notes }, true)}
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
