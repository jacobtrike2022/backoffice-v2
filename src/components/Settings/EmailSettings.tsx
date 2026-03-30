import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Mail,
  Send,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  Edit,
  Trash2,
  Plus,
  Search,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  Lock,
  MoreHorizontal,
  Pencil,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { useTranslation } from 'react-i18next';
import {
  getEmailTemplates,
  getEmailLogs,
  previewEmailTemplate,
  deleteEmailTemplate,
  createEmailTemplate,
  updateEmailTemplate,
  customizeSystemTemplate,
  sendTestEmail,
  getSampleVariables,
  type EmailTemplate,
  type EmailLog,
  type OrgContext,
} from '../../lib/crud/email';
import { supabase, getCurrentUserOrgId } from '../../lib/supabase';
import { EmailTemplateEditorModal, type TemplateFormData } from './EmailTemplateEditorModal';

export function EmailSettings() {
  const { t } = useTranslation();
  const [activeSubTab, setActiveSubTab] = useState('templates');
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');
  const [logStatusFilter, setLogStatusFilter] = useState<string>('all');
  const [logSearch, setLogSearch] = useState('');
  const [orgContext, setOrgContext] = useState<OrgContext | undefined>(undefined);

  // Editor modal state
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit' | 'customize'>('create');
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<EmailTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  const LOGS_PER_PAGE = 20;

  // Load org context on mount
  useEffect(() => {
    async function loadOrgContext() {
      try {
        const orgId = await getCurrentUserOrgId();
        if (!orgId) return;

        // Fetch organization name
        const { data: org } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', orgId)
          .single();

        // Fetch admin user info (first admin we find)
        const { data: adminUser } = await supabase
          .from('users')
          .select('first_name, last_name, email')
          .eq('organization_id', orgId)
          .eq('role', 'admin')
          .limit(1)
          .single();

        if (org) {
          setOrgContext({
            name: org.name,
            adminName: adminUser ? `${adminUser.first_name} ${adminUser.last_name}` : undefined,
            adminEmail: adminUser?.email,
          });
        }
      } catch (error) {
        console.error('Error loading org context:', error);
      }
    }
    loadOrgContext();
  }, []);

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
  }, []);

  // Load logs when switching to logs tab
  useEffect(() => {
    if (activeSubTab === 'logs') {
      loadLogs();
    }
  }, [activeSubTab, logsPage, logStatusFilter]);

  async function loadTemplates() {
    try {
      setLoading(true);
      const data = await getEmailTemplates();
      setTemplates(data);
    } catch (error: any) {
      toast.error(t('emailSettings.failedLoadTemplates'), { description: error.message });
    } finally {
      setLoading(false);
    }
  }

  async function loadLogs() {
    try {
      setLogsLoading(true);
      const result = await getEmailLogs({
        limit: LOGS_PER_PAGE,
        offset: logsPage * LOGS_PER_PAGE,
        status: logStatusFilter !== 'all' ? logStatusFilter as any : undefined,
      });
      setLogs(result.logs);
      setLogsTotal(result.total);
    } catch (error: any) {
      toast.error(t('emailSettings.failedLoadLogs'), { description: error.message });
    } finally {
      setLogsLoading(false);
    }
  }

  async function handlePreviewTemplate(template: EmailTemplate) {
    try {
      // Pass org context to get dynamic preview data instead of dummy "Acme Corporation"
      const variables = getSampleVariables(template.slug, orgContext);
      const preview = await previewEmailTemplate({
        template_id: template.id,
        variables,
      });
      setPreviewSubject(preview.subject);
      setPreviewHtml(preview.body_html);
      setSelectedTemplate(template);
      setShowPreviewModal(true);
    } catch (error: any) {
      toast.error(t('emailSettings.failedPreviewTemplate'), { description: error.message });
    }
  }

  // Open editor for creating new template
  function handleCreateTemplate() {
    setEditingTemplate(null);
    setEditorMode('create');
    setShowEditorModal(true);
  }

  // Open editor for editing existing template
  function handleEditTemplate(template: EmailTemplate) {
    setEditingTemplate(template);
    setEditorMode('edit');
    setShowEditorModal(true);
  }

  // Open editor for customizing system template
  async function handleCustomizeTemplate(template: EmailTemplate) {
    try {
      // Create org copy of system template
      const customized = await customizeSystemTemplate(template.id);
      // Open editor with the new org template
      setEditingTemplate(customized);
      setEditorMode('edit'); // It's now an org template, so edit mode
      setShowEditorModal(true);
      // Reload templates list
      await loadTemplates();
      toast.success(t('emailSettings.templateCustomized'), {
        description: t('emailSettings.templateCustomizedDesc'),
      });
    } catch (error: any) {
      toast.error(t('emailSettings.failedCustomizeTemplate'), { description: error.message });
    }
  }

  // Save template (create or update)
  async function handleSaveTemplate(formData: TemplateFormData) {
    if (editorMode === 'create') {
      await createEmailTemplate({
        slug: formData.slug,
        name: formData.name,
        description: formData.description,
        subject: formData.subject,
        body_html: formData.body_html,
        body_text: formData.body_text,
        available_variables: formData.available_variables,
      });
      toast.success(t('emailSettings.templateCreated'));
    } else {
      if (!formData.id) {
        throw new Error('Template ID is required for update');
      }
      await updateEmailTemplate(formData.id, {
        name: formData.name,
        description: formData.description,
        subject: formData.subject,
        body_html: formData.body_html,
        body_text: formData.body_text,
        available_variables: formData.available_variables,
      });
      toast.success(t('emailSettings.templateUpdated'));
    }
    await loadTemplates();
  }

  // Confirm delete
  function handleDeleteClick(template: EmailTemplate) {
    setTemplateToDelete(template);
    setShowDeleteConfirm(true);
  }

  // Execute delete
  async function handleConfirmDelete() {
    if (!templateToDelete) return;
    try {
      setDeleting(true);
      await deleteEmailTemplate(templateToDelete.id);
      toast.success(t('emailSettings.templateDeleted'));
      await loadTemplates();
      setShowDeleteConfirm(false);
      setTemplateToDelete(null);
    } catch (error: any) {
      toast.error(t('emailSettings.failedDeleteTemplate'), { description: error.message });
    } finally {
      setDeleting(false);
    }
  }

  // Send test email
  async function handleSendTestEmail(template: EmailTemplate) {
    try {
      await sendTestEmail(template.id);
      toast.success(t('emailSettings.testEmailSent'), {
        description: t('emailSettings.testEmailSentDesc'),
      });
    } catch (error: any) {
      toast.error(t('emailSettings.failedSendTestEmail'), { description: error.message });
    }
  }

  function getStatusBadge(status: EmailLog['status']) {
    const config: Record<EmailLog['status'], { icon: React.ReactNode; color: string; label: string }> = {
      pending: { icon: <Clock className="h-3 w-3" />, color: 'bg-yellow-100 text-yellow-800', label: t('emailSettings.statusPending') },
      sent: { icon: <Send className="h-3 w-3" />, color: 'bg-blue-100 text-blue-800', label: t('emailSettings.statusSent') },
      delivered: { icon: <CheckCircle2 className="h-3 w-3" />, color: 'bg-green-100 text-green-800', label: t('emailSettings.statusDelivered') },
      opened: { icon: <Eye className="h-3 w-3" />, color: 'bg-purple-100 text-purple-800', label: t('emailSettings.statusOpened') },
      clicked: { icon: <ExternalLink className="h-3 w-3" />, color: 'bg-indigo-100 text-indigo-800', label: t('emailSettings.statusClicked') },
      bounced: { icon: <AlertCircle className="h-3 w-3" />, color: 'bg-orange-100 text-orange-800', label: t('emailSettings.statusBounced') },
      failed: { icon: <XCircle className="h-3 w-3" />, color: 'bg-red-100 text-red-800', label: t('emailSettings.statusFailed') },
    };
    const { icon, color, label } = config[status];
    return (
      <Badge className={`${color} flex items-center gap-1`}>
        {icon}
        {label}
      </Badge>
    );
  }

  const filteredLogs = logSearch
    ? logs.filter(log =>
        log.recipient_email.toLowerCase().includes(logSearch.toLowerCase()) ||
        log.subject.toLowerCase().includes(logSearch.toLowerCase()) ||
        log.template_slug.toLowerCase().includes(logSearch.toLowerCase())
      )
    : logs;

  return (
    <div className="space-y-6">
      {/* Email System Header */}
      <Card>
        <CardHeader className="pb-6">
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            {t('emailSettings.title')}
          </CardTitle>
          <CardDescription className="mt-1.5">
            {t('emailSettings.description')}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Sub-tabs for Templates and Logs */}
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {t('emailSettings.templatesTab')}
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {t('emailSettings.logsTab')}
          </TabsTrigger>
        </TabsList>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="py-12">
                <div className="flex items-center justify-center">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">{t('emailSettings.loadingTemplates')}</span>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Organization Templates (Custom) - moved above System */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{t('emailSettings.customTemplates')}</CardTitle>
                      <CardDescription>
                        {t('emailSettings.customTemplatesDesc')}
                      </CardDescription>
                    </div>
                    <Button size="sm" onClick={handleCreateTemplate}>
                      <Plus className="h-4 w-4 mr-1" />
                      {t('emailSettings.createTemplate')}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {templates.filter(t => t.template_type === 'organization').length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">{t('emailSettings.noCustomTemplates')}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {t('emailSettings.noCustomTemplatesDesc')}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {templates
                        .filter(t => t.template_type === 'organization')
                        .map(template => (
                          <div
                            key={template.id}
                            className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{template.name}</h4>
                                <Badge variant="outline" className="text-xs">
                                  {template.slug}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                {template.description}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePreviewTemplate(template)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditTemplate(template)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleSendTestEmail(template)}>
                                    <Send className="h-4 w-4 mr-2" />
                                    {t('emailSettings.sendTestEmail')}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleDeleteClick(template)}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    {t('emailSettings.deleteTemplateItem')}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* System Templates */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    {t('emailSettings.systemTemplates')}
                  </CardTitle>
                  <CardDescription>
                    {t('emailSettings.systemTemplatesDesc')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {templates
                      .filter(t => t.template_type === 'system' && t.slug !== 'welcome_admin')
                      .map(template => {
                        // Check if org has already customized this template
                        const hasCustomized = templates.some(
                          t => t.template_type === 'organization' && t.slug === template.slug
                        );
                        return (
                          <div
                            key={template.id}
                            className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{template.name}</h4>
                                <Badge variant="outline" className="text-xs">
                                  {template.slug}
                                </Badge>
                                {hasCustomized && (
                                  <Badge variant="secondary" className="text-xs">
                                    {t('emailSettings.customized')}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                {template.description}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePreviewTemplate(template)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                {t('emailSettings.preview')}
                              </Button>
                              {!hasCustomized && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCustomizeTemplate(template)}
                                >
                                  <Pencil className="h-4 w-4 mr-1" />
                                  {t('emailSettings.customize')}
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>

              {/* Available Variables Reference */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('emailSettings.templateVariables')}</CardTitle>
                  <CardDescription>
                    {t('emailSettings.templateVariablesDesc')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium mb-2">{t('emailSettings.welcomeEmails')}</h4>
                      <div className="space-y-1 text-sm">
                        <code className="text-primary">{`{{admin_name}}`}</code> - Admin's name<br />
                        <code className="text-primary">{`{{employee_name}}`}</code> - Employee's name<br />
                        <code className="text-primary">{`{{company_name}}`}</code> - Organization name<br />
                        <code className="text-primary">{`{{login_email}}`}</code> - Login email<br />
                        <code className="text-primary">{`{{temp_password}}`}</code> - Temporary password<br />
                        <code className="text-primary">{`{{login_url}}`}</code> - Login page URL
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">{t('emailSettings.passwordReset')}</h4>
                      <div className="space-y-1 text-sm">
                        <code className="text-primary">{`{{user_name}}`}</code> - User's name<br />
                        <code className="text-primary">{`{{reset_link}}`}</code> - Reset password URL<br />
                        <code className="text-primary">{`{{expires_in}}`}</code> - Link expiration time
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Email Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">{t('emailSettings.deliveryLogs')}</CardTitle>
                  <CardDescription>
                    {t('emailSettings.deliveryLogsDesc')}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t('emailSettings.searchEmails')}
                      value={logSearch}
                      onChange={(e) => setLogSearch(e.target.value)}
                      className="pl-9 w-[200px]"
                    />
                  </div>
                  <Select value={logStatusFilter} onValueChange={setLogStatusFilter}>
                    <SelectTrigger className="w-[130px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('emailSettings.allStatus')}</SelectItem>
                      <SelectItem value="sent">{t('emailSettings.statusSent')}</SelectItem>
                      <SelectItem value="delivered">{t('emailSettings.statusDelivered')}</SelectItem>
                      <SelectItem value="opened">{t('emailSettings.statusOpened')}</SelectItem>
                      <SelectItem value="failed">{t('emailSettings.statusFailed')}</SelectItem>
                      <SelectItem value="bounced">{t('emailSettings.statusBounced')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={loadLogs}>
                    <RefreshCw className={`h-4 w-4 ${logsLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {logsLoading && logs.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">{t('emailSettings.loadingLogs')}</span>
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="text-center py-12">
                  <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">{t('emailSettings.noLogsFound')}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('emailSettings.noLogsDesc')}
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {filteredLogs.map(log => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium truncate">{log.recipient_email}</span>
                            {getStatusBadge(log.status)}
                          </div>
                          <div className="text-sm text-muted-foreground truncate">
                            {log.subject}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {log.template_slug}
                            </span>
                            <span>
                              {new Date(log.created_at).toLocaleDateString()} at{' '}
                              {new Date(log.created_at).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                        {log.error_message && (
                          <div className="ml-4">
                            <Badge variant="destructive" className="text-xs">
                              {log.error_message.substring(0, 50)}...
                            </Badge>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {logsTotal > LOGS_PER_PAGE && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        {t('emailSettings.showing', {
                          from: logsPage * LOGS_PER_PAGE + 1,
                          to: Math.min((logsPage + 1) * LOGS_PER_PAGE, logsTotal),
                          total: logsTotal
                        })}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLogsPage(p => p - 1)}
                          disabled={logsPage === 0}
                        >
                          {t('common.previous')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLogsPage(p => p + 1)}
                          disabled={(logsPage + 1) * LOGS_PER_PAGE >= logsTotal}
                        >
                          {t('common.next')}
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Template Preview Modal */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              {t('emailSettings.previewTitle', { name: selectedTemplate?.name })}
            </DialogTitle>
          </DialogHeader>

          {/* Email Header Info - FROM/TO/SUBJECT */}
          <div className="bg-muted/50 border rounded-lg p-4 space-y-2 text-sm">
            <div className="flex">
              <span className="font-medium w-20 text-muted-foreground">{t('emailSettings.from')}</span>
              <span className="font-mono">Trike &lt;noreply@notifications.trike.co&gt;</span>
            </div>
            <div className="flex">
              <span className="font-medium w-20 text-muted-foreground">{t('emailSettings.to')}</span>
              <span className="font-mono text-muted-foreground">{'{{recipient_email}}'}</span>
            </div>
            <div className="flex">
              <span className="font-medium w-20 text-muted-foreground">{t('emailSettings.subject')}</span>
              <span>{previewSubject}</span>
            </div>
          </div>

          <div className="border rounded-lg overflow-auto max-h-[50vh] bg-white">
            <iframe
              srcDoc={previewHtml}
              className="w-full min-h-[400px] border-0"
              title="Email Preview"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreviewModal(false)}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Editor Modal */}
      <EmailTemplateEditorModal
        isOpen={showEditorModal}
        onClose={() => {
          setShowEditorModal(false);
          setEditingTemplate(null);
        }}
        onSave={handleSaveTemplate}
        editingTemplate={editingTemplate}
        mode={editorMode}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('emailSettings.deleteTemplate')}</DialogTitle>
            <DialogDescription>
              {t('emailSettings.deleteConfirm', { name: templateToDelete?.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={deleting}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleting}
            >
              {deleting ? t('common.deleting') : t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
