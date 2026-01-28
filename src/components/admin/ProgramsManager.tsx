import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
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
import { Switch } from '../ui/switch';
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Package,
  Search,
  ExternalLink,
  AlertTriangle,
  Filter
} from 'lucide-react';
import {
  getPrograms,
  getProgramCategories,
  createProgram,
  updateProgram,
  deleteProgram,
  generateSlug,
  type Program,
  type ProgramCategory
} from '../../lib/crud/programs';

export function ProgramsManager() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [categories, setCategories] = useState<ProgramCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Dialog state
  const [showDialog, setShowDialog] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [formData, setFormData] = useState({
    category_id: '',
    name: '',
    slug: '',
    display_name: '',
    description: '',
    vendor_name: '',
    website_url: '',
    sort_order: 0,
    is_active: true
  });
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deletingProgram, setDeletingProgram] = useState<Program | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchPrograms();
  }, [filterCategory, searchTerm]);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const [programsData, categoriesData] = await Promise.all([
        getPrograms(),
        getProgramCategories()
      ]);
      setPrograms(programsData);
      setCategories(categoriesData);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  async function fetchPrograms() {
    try {
      const data = await getPrograms({
        categoryId: filterCategory !== 'all' ? filterCategory : undefined,
        search: searchTerm || undefined
      });
      setPrograms(data);
    } catch (err: any) {
      console.error('Error fetching programs:', err);
    }
  }

  function openCreateDialog() {
    setEditingProgram(null);
    setFormData({
      category_id: categories[0]?.id || '',
      name: '',
      slug: '',
      display_name: '',
      description: '',
      vendor_name: '',
      website_url: '',
      sort_order: programs.length,
      is_active: true
    });
    setShowDialog(true);
  }

  function openEditDialog(program: Program) {
    setEditingProgram(program);
    setFormData({
      category_id: program.category_id,
      name: program.name,
      slug: program.slug,
      display_name: program.display_name || '',
      description: program.description || '',
      vendor_name: program.vendor_name || '',
      website_url: program.website_url || '',
      sort_order: program.sort_order || 0,
      is_active: program.is_active
    });
    setShowDialog(true);
  }

  function handleNameChange(name: string) {
    const category = categories.find(c => c.id === formData.category_id);
    const categoryPrefix = category?.name ? `${category.name}: ` : '';

    setFormData({
      ...formData,
      name,
      slug: !editingProgram ? generateSlug(name) : formData.slug,
      display_name: !editingProgram ? `${categoryPrefix}${name}` : formData.display_name
    });
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      setError('Program name is required');
      return;
    }
    if (!formData.slug.trim()) {
      setError('Slug is required');
      return;
    }
    if (!formData.category_id) {
      setError('Category is required');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (editingProgram) {
        await updateProgram(editingProgram.id, {
          category_id: formData.category_id,
          name: formData.name.trim(),
          slug: formData.slug.trim(),
          display_name: formData.display_name.trim() || null,
          description: formData.description.trim() || null,
          vendor_name: formData.vendor_name.trim() || null,
          website_url: formData.website_url.trim() || null,
          sort_order: formData.sort_order,
          is_active: formData.is_active
        });
      } else {
        await createProgram({
          category_id: formData.category_id,
          name: formData.name.trim(),
          slug: formData.slug.trim(),
          display_name: formData.display_name.trim() || undefined,
          description: formData.description.trim() || undefined,
          vendor_name: formData.vendor_name.trim() || undefined,
          website_url: formData.website_url.trim() || undefined,
          sort_order: formData.sort_order,
          is_active: formData.is_active
        });
      }
      setShowDialog(false);
      await fetchPrograms();
    } catch (err: any) {
      console.error('Error saving program:', err);
      setError(err.message || 'Failed to save program');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingProgram) return;

    setDeleting(true);
    try {
      await deleteProgram(deletingProgram.id);
      setDeletingProgram(null);
      await fetchPrograms();
    } catch (err: any) {
      console.error('Error deleting program:', err);
      setError(err.message || 'Failed to delete program');
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
                <Package className="h-5 w-5 text-primary" />
                Programs
              </CardTitle>
              <CardDescription>
                Manage vendors, equipment, and technology programs
              </CardDescription>
            </div>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Program
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search programs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Program</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Display Name</TableHead>
                <TableHead className="w-20">Status</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {programs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No programs found
                  </TableCell>
                </TableRow>
              ) : (
                programs.map((program) => (
                  <TableRow key={program.id}>
                    <TableCell className="font-medium">
                      <div>
                        <div>{program.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {program.slug}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {program.category?.name}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {program.vendor_name || '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">
                      {program.display_name || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={program.is_active ? 'default' : 'secondary'}>
                        {program.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {program.website_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                          >
                            <a href={program.website_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(program)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingProgram(program)}
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingProgram ? 'Edit Program' : 'Create Program'}
            </DialogTitle>
            <DialogDescription>
              {editingProgram
                ? 'Update the program details'
                : 'Add a new program (vendor, equipment, technology)'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="category_id">Category *</Label>
              <Select
                value={formData.category_id}
                onValueChange={(value) => setFormData({ ...formData, category_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g., NCR Aloha, Core-Mark"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug *</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="e.g., ncr-aloha"
                  className="font-mono"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="display_name">Display Name</Label>
              <Input
                id="display_name"
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                placeholder="e.g., POS: NCR Aloha"
              />
              <p className="text-xs text-muted-foreground">
                How the program appears in lists (e.g., "POS: NCR Aloha")
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendor_name">Vendor/Company Name</Label>
              <Input
                id="vendor_name"
                value={formData.vendor_name}
                onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                placeholder="e.g., NCR Corporation"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of this program"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="website_url">Website URL</Label>
              <Input
                id="website_url"
                type="url"
                value={formData.website_url}
                onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
                placeholder="https://..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sort_order">Sort Order</Label>
                <Input
                  id="sort_order"
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="flex items-center justify-between pt-6">
                <Label htmlFor="is_active">Active</Label>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
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
                editingProgram ? 'Update' : 'Create'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingProgram} onOpenChange={() => setDeletingProgram(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Program</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingProgram?.name}"? This action cannot be undone
              and will remove all industry associations.
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
