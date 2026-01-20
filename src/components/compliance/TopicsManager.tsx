import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Tag,
  GripVertical,
  AlertTriangle
} from 'lucide-react';
import {
  getComplianceTopics,
  createComplianceTopic,
  updateComplianceTopic,
  deleteComplianceTopic,
  type ComplianceTopic
} from '../../lib/crud/compliance';

export function TopicsManager() {
  const [topics, setTopics] = useState<ComplianceTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [showDialog, setShowDialog] = useState(false);
  const [editingTopic, setEditingTopic] = useState<ComplianceTopic | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: '',
    sort_order: 0
  });
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deletingTopic, setDeletingTopic] = useState<ComplianceTopic | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchTopics();
  }, []);

  async function fetchTopics() {
    setLoading(true);
    setError(null);
    try {
      const data = await getComplianceTopics();
      setTopics(data);
    } catch (err: any) {
      console.error('Error fetching topics:', err);
      setError(err.message || 'Failed to load topics');
    } finally {
      setLoading(false);
    }
  }

  function openCreateDialog() {
    setEditingTopic(null);
    setFormData({
      name: '',
      description: '',
      icon: '',
      sort_order: topics.length
    });
    setShowDialog(true);
  }

  function openEditDialog(topic: ComplianceTopic) {
    setEditingTopic(topic);
    setFormData({
      name: topic.name,
      description: topic.description || '',
      icon: topic.icon || '',
      sort_order: topic.sort_order || 0
    });
    setShowDialog(true);
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      setError('Topic name is required');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (editingTopic) {
        await updateComplianceTopic(editingTopic.id, {
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          icon: formData.icon.trim() || null,
          sort_order: formData.sort_order
        });
      } else {
        await createComplianceTopic({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          icon: formData.icon.trim() || null,
          sort_order: formData.sort_order
        });
      }
      setShowDialog(false);
      await fetchTopics();
    } catch (err: any) {
      console.error('Error saving topic:', err);
      setError(err.message || 'Failed to save topic');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingTopic) return;

    setDeleting(true);
    try {
      await deleteComplianceTopic(deletingTopic.id);
      setDeletingTopic(null);
      await fetchTopics();
    } catch (err: any) {
      console.error('Error deleting topic:', err);
      setError(err.message || 'Failed to delete topic');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5 text-primary" />
                Compliance Topics
              </CardTitle>
              <CardDescription>
                Define categories for grouping compliance requirements
              </CardDescription>
            </div>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Topic
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Icon</TableHead>
                <TableHead className="w-24">Order</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topics.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No compliance topics defined yet
                  </TableCell>
                </TableRow>
              ) : (
                topics.map((topic) => (
                  <TableRow key={topic.id}>
                    <TableCell>
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                    </TableCell>
                    <TableCell className="font-medium">{topic.name}</TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">
                      {topic.description || '-'}
                    </TableCell>
                    <TableCell>{topic.icon || '-'}</TableCell>
                    <TableCell>{topic.sort_order}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(topic)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingTopic(topic)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTopic ? 'Edit Topic' : 'Create Topic'}
            </DialogTitle>
            <DialogDescription>
              {editingTopic
                ? 'Update the compliance topic details'
                : 'Add a new compliance topic category'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Food Safety, Alcohol Service"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of this compliance category"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="icon">Icon (Lucide name)</Label>
                <Input
                  id="icon"
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  placeholder="e.g., Shield, FileCheck"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sort_order">Sort Order</Label>
                <Input
                  id="sort_order"
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                editingTopic ? 'Update' : 'Create'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingTopic} onOpenChange={() => setDeletingTopic(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Topic</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingTopic?.name}"? This action cannot be undone
              and may affect existing compliance requirements.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
