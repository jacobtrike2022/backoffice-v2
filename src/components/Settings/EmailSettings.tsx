import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
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
  Copy,
  ExternalLink,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import {
  getEmailTemplates,
  getEmailLogs,
  previewEmailTemplate,
  deleteEmailTemplate,
  getSampleVariables,
  getStatusColor,
  type EmailTemplate,
  type EmailLog,
} from '../../lib/crud/email';

export function EmailSettings() {
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

  const LOGS_PER_PAGE = 20;

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
      toast.error('Failed to load templates', { description: error.message });
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
      toast.error('Failed to load email logs', { description: error.message });
    } finally {
      setLogsLoading(false);
    }
  }

  async function handlePreviewTemplate(template: EmailTemplate) {
    try {
      const variables = getSampleVariables(template.slug);
      const preview = await previewEmailTemplate({
        template_id: template.id,
        variables,
      });
      setPreviewSubject(preview.subject);
      setPreviewHtml(preview.body_html);
      setSelectedTemplate(template);
      setShowPreviewModal(true);
    } catch (error: any) {
      toast.error('Failed to preview template', { description: error.message });
    }
  }

  function getStatusBadge(status: EmailLog['status']) {
    const config: Record<EmailLog['status'], { icon: React.ReactNode; color: string; label: string }> = {
      pending: { icon: <Clock className="h-3 w-3" />, color: 'bg-yellow-100 text-yellow-800', label: 'Pending' },
      sent: { icon: <Send className="h-3 w-3" />, color: 'bg-blue-100 text-blue-800', label: 'Sent' },
      delivered: { icon: <CheckCircle2 className="h-3 w-3" />, color: 'bg-green-100 text-green-800', label: 'Delivered' },
      opened: { icon: <Eye className="h-3 w-3" />, color: 'bg-purple-100 text-purple-800', label: 'Opened' },
      clicked: { icon: <ExternalLink className="h-3 w-3" />, color: 'bg-indigo-100 text-indigo-800', label: 'Clicked' },
      bounced: { icon: <AlertCircle className="h-3 w-3" />, color: 'bg-orange-100 text-orange-800', label: 'Bounced' },
      failed: { icon: <XCircle className="h-3 w-3" />, color: 'bg-red-100 text-red-800', label: 'Failed' },
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Email Communication
          </CardTitle>
          <CardDescription>
            Manage email templates and view email delivery logs
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Sub-tabs for Templates and Logs */}
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Email Logs
          </TabsTrigger>
        </TabsList>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="py-12">
                <div className="flex items-center justify-center">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Loading templates...</span>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* System Templates */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    System Templates
                  </CardTitle>
                  <CardDescription>
                    These templates are managed by Trike and cannot be modified
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {templates
                      .filter(t => t.template_type === 'system')
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
                              <Eye className="h-4 w-4 mr-1" />
                              Preview
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>

              {/* Organization Templates */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Custom Templates</CardTitle>
                      <CardDescription>
                        Create custom email templates for your organization
                      </CardDescription>
                    </div>
                    <Button size="sm" disabled>
                      <Plus className="h-4 w-4 mr-1" />
                      Create Template
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {templates.filter(t => t.template_type === 'organization').length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No custom templates yet</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Custom templates allow you to override system templates with your branding
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
                              <Button variant="ghost" size="sm" disabled>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" disabled>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Available Variables Reference */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Template Variables</CardTitle>
                  <CardDescription>
                    Use these variables in your templates with double curly braces: {`{{variable_name}}`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium mb-2">Welcome Emails</h4>
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
                      <h4 className="font-medium mb-2">Password Reset</h4>
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
                  <CardTitle className="text-lg">Email Delivery Logs</CardTitle>
                  <CardDescription>
                    Track email delivery status and troubleshoot issues
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search emails..."
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
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="opened">Opened</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="bounced">Bounced</SelectItem>
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
                  <span className="ml-2 text-muted-foreground">Loading logs...</span>
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="text-center py-12">
                  <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No email logs found</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Emails will appear here once they are sent
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
                        Showing {logsPage * LOGS_PER_PAGE + 1} -{' '}
                        {Math.min((logsPage + 1) * LOGS_PER_PAGE, logsTotal)} of {logsTotal}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLogsPage(p => p - 1)}
                          disabled={logsPage === 0}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLogsPage(p => p + 1)}
                          disabled={(logsPage + 1) * LOGS_PER_PAGE >= logsTotal}
                        >
                          Next
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
              Preview: {selectedTemplate?.name}
            </DialogTitle>
            <DialogDescription>
              Subject: {previewSubject}
            </DialogDescription>
          </DialogHeader>
          <div className="border rounded-lg overflow-auto max-h-[60vh] bg-white">
            <iframe
              srcDoc={previewHtml}
              className="w-full min-h-[400px] border-0"
              title="Email Preview"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreviewModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
