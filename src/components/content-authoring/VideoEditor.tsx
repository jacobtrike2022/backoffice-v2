import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      toast.success(t('contentAuthoring.videoUploadedSuccess'));
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
      toast.success(t('contentAuthoring.thumbnailUploadedSuccess'));
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
    toast.success(t('contentAuthoring.videoSavedAsDraft'));
  };

  const handlePublishAndAssign = () => {
    if (!title.trim()) {
      toast.error(t('contentAuthoring.titleRequiredError'));
      return;
    }
    if (!videoFile && !videoUrl) {
      toast.error(t('contentAuthoring.videoSourceRequired'));
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
    toast.success(t('contentAuthoring.videoPublishedRedirecting'));
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
            {t('common.back')}
          </Button>
          <h1 className="text-foreground">{t('contentAuthoring.videoEditor')}</h1>
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

      {/* Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Editor */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('contentAuthoring.videoDetails')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Title */}
              <div>
                <Label htmlFor="title">{t('contentAuthoring.titleLabel')}</Label>
                <Input
                  id="title"
                  placeholder={t('contentAuthoring.videoTitlePlaceholder')}
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
                  placeholder={t('contentAuthoring.videoDescriptionPlaceholder')}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-2"
                  rows={3}
                />
              </div>

              <Separator />

              {/* Video Source */}
              <div>
                <Label>{t('contentAuthoring.videoSourceLabel')}</Label>
                <Tabs value={videoSource} onValueChange={(v) => setVideoSource(v as any)} className="mt-2">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="upload">
                      <Upload className="h-4 w-4 mr-2" />
                      {t('contentAuthoring.upload')}
                    </TabsTrigger>
                    <TabsTrigger value="url">
                      <LinkIcon className="h-4 w-4 mr-2" />
                      {t('contentAuthoring.url')}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="upload" className="mt-4">
                    {videoFile ? (
                      <div className="relative">
                        <div className="w-full aspect-video bg-accent rounded-lg flex items-center justify-center">
                          <div className="text-center">
                            <VideoIcon className="h-16 w-16 text-primary mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">{t('contentAuthoring.videoUploaded')}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {t('contentAuthoring.clickToReplaceOrRemove')}
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
                            <span className="font-semibold">{t('contentAuthoring.clickToUploadVideo')}</span> {t('contentAuthoring.orDragAndDrop')}
                          </p>
                          <p className="text-xs text-muted-foreground">{t('contentAuthoring.videoFileTypes')}</p>
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
                            <p className="text-sm text-muted-foreground">{t('contentAuthoring.videoUrlSet')}</p>
                            <p className="text-xs text-muted-foreground mt-1 px-4 truncate max-w-md">
                              {videoUrl}
                            </p>
                          </div>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {t('contentAuthoring.videoUrlSupports')}
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              <Separator />

              {/* Thumbnail */}
              <div>
                <Label>{t('contentAuthoring.customThumbnailOptional')}</Label>
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
                        <p className="text-xs text-muted-foreground">{t('contentAuthoring.uploadThumbnailImage')}</p>
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
                <Label htmlFor="duration">{t('contentAuthoring.durationOptional')}</Label>
                <Input
                  id="duration"
                  placeholder={t('contentAuthoring.durationPlaceholder')}
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
              <CardTitle>{t('contentAuthoring.additionalNotes')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder={t('contentAuthoring.notesForLearnersPlaceholder')}
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
              <CardTitle>{t('contentAuthoring.learningObjectives')}</CardTitle>
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
                {t('contentAuthoring.addObjective')}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('contentAuthoring.publishingInfo')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">{t('common.status')}</p>
                <p className="font-medium text-foreground">{t('common.draft')}</p>
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground">{t('contentAuthoring.contentType')}</p>
                <p className="font-medium text-foreground">{t('contentAuthoring.typeVideoName')}</p>
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground mb-2">{t('contentAuthoring.quickActions')}</p>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => onSave({ title, description, videoFile, videoUrl, thumbnail, duration, objectives, notes }, true)}
                  >
                    {t('contentAuthoring.publishNow')}
                  </Button>
                  <Button
                    size="sm"
                    className="w-full bg-brand-gradient text-white shadow-brand"
                    onClick={handlePublishAndAssign}
                  >
                    {t('contentAuthoring.publishAndAssignToUsers')}
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