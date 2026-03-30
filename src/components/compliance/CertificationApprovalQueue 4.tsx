import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
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
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Search,
  Filter,
  Eye,
  Loader2,
  AlertTriangle,
  User,
  Calendar,
  Building2,
  MapPin,
  ExternalLink
} from 'lucide-react';
import {
  getPendingCertificationUploads,
  getCertificationUploads,
  approveExternalCertification,
  rejectExternalCertification
} from '../../lib/crud/certifications';
import { supabase } from '../../lib/supabase';

interface CertificationUpload {
  id: string;
  certificate_type: string;
  certificate_number: string | null;
  name_on_certificate: string;
  issuing_authority: string;
  training_provider: string | null;
  state_issued: string | null;
  issue_date: string;
  expiry_date: string | null;
  document_url: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
  user: {
    id: string;
    name: string;
    email: string;
    store?: { id: string; name: string } | null;
  };
  reviewer?: {
    id: string;
    name: string;
  } | null;
}

interface CertificationApprovalQueueProps {
  canApprove?: boolean; // Only Org Admin and Trike Super Admin can approve
  showAllStatuses?: boolean; // Whether to show approved/rejected too
  onCountChange?: (count: number) => void;
}

export function CertificationApprovalQueue({
  canApprove = false,
  showAllStatuses = false,
  onCountChange
}: CertificationApprovalQueueProps) {
  const [uploads, setUploads] = useState<CertificationUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(showAllStatuses ? 'all' : 'pending');

  // Action state
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // View document dialog
  const [viewingDocument, setViewingDocument] = useState<string | null>(null);

  // Rejection dialog
  const [rejectingUpload, setRejectingUpload] = useState<CertificationUpload | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Current user for reviewer ID
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    async function getCurrentUser() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data: currentUser } = await supabase
          .from('users')
          .select('id')
          .eq('auth_user_id', authUser.id)
          .single();
        if (currentUser) {
          setCurrentUserId(currentUser.id);
        }
      }
    }
    getCurrentUser();
  }, []);

  useEffect(() => {
    fetchUploads();
  }, [statusFilter]);

  async function fetchUploads() {
    setLoading(true);
    setError(null);
    try {
      let data: CertificationUpload[];
      if (statusFilter === 'pending') {
        data = await getPendingCertificationUploads() as CertificationUpload[];
      } else if (statusFilter === 'all') {
        data = await getCertificationUploads() as CertificationUpload[];
      } else {
        data = await getCertificationUploads(statusFilter as 'approved' | 'rejected') as CertificationUpload[];
      }
      setUploads(data);

      // Report pending count
      const pendingCount = statusFilter === 'pending'
        ? data.length
        : data.filter(u => u.status === 'pending').length;
      onCountChange?.(pendingCount);
    } catch (err: any) {
      console.error('Error fetching uploads:', err);
      setError(err.message || 'Failed to load certification uploads');
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(upload: CertificationUpload) {
    if (!currentUserId) {
      setError('Unable to identify current user');
      return;
    }

    setActionLoading(upload.id);
    setError(null);
    try {
      await approveExternalCertification(upload.id, currentUserId);
      await fetchUploads();
    } catch (err: any) {
      console.error('Error approving:', err);
      setError(err.message || 'Failed to approve certification');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject() {
    if (!rejectingUpload || !currentUserId) return;

    if (!rejectionReason.trim()) {
      setError('Please provide a reason for rejection');
      return;
    }

    setActionLoading(rejectingUpload.id);
    setError(null);
    try {
      await rejectExternalCertification(rejectingUpload.id, currentUserId, rejectionReason);
      setRejectingUpload(null);
      setRejectionReason('');
      await fetchUploads();
    } catch (err: any) {
      console.error('Error rejecting:', err);
      setError(err.message || 'Failed to reject certification');
    } finally {
      setActionLoading(null);
    }
  }

  const filteredUploads = uploads.filter(upload => {
    const searchLower = searchTerm.toLowerCase();
    return (
      upload.certificate_type.toLowerCase().includes(searchLower) ||
      upload.name_on_certificate.toLowerCase().includes(searchLower) ||
      upload.user.name.toLowerCase().includes(searchLower) ||
      upload.user.email.toLowerCase().includes(searchLower) ||
      upload.issuing_authority.toLowerCase().includes(searchLower)
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case 'approved':
        return (
          <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

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

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, type, employee, or authority..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            {showAllStatuses && (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Certification Uploads ({filteredUploads.length})
          </CardTitle>
          <CardDescription>
            Review and approve external certification uploads
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Certificate Type</TableHead>
                  <TableHead>Issuing Authority</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUploads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {statusFilter === 'pending'
                        ? 'No pending certification uploads'
                        : 'No certification uploads found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUploads.map((upload) => (
                    <TableRow key={upload.id}>
                      {/* Employee */}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{upload.user.name}</p>
                            <p className="text-xs text-muted-foreground">{upload.user.email}</p>
                            {upload.user.store && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {upload.user.store.name}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Certificate Type */}
                      <TableCell>
                        <div>
                          <p className="font-medium">{upload.certificate_type}</p>
                          <p className="text-xs text-muted-foreground">
                            {upload.name_on_certificate}
                          </p>
                          {upload.certificate_number && (
                            <p className="text-xs text-muted-foreground">
                              #{upload.certificate_number}
                            </p>
                          )}
                        </div>
                      </TableCell>

                      {/* Issuing Authority */}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm">{upload.issuing_authority}</p>
                            {upload.state_issued && (
                              <p className="text-xs text-muted-foreground">
                                {upload.state_issued}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Issue Date */}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {new Date(upload.issue_date).toLocaleDateString()}
                          </span>
                        </div>
                      </TableCell>

                      {/* Expiry Date */}
                      <TableCell>
                        {upload.expiry_date ? (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              {new Date(upload.expiry_date).toLocaleDateString()}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">No expiry</span>
                        )}
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <div>
                          {getStatusBadge(upload.status)}
                          {upload.rejection_reason && (
                            <p className="text-xs text-red-600 mt-1" title={upload.rejection_reason}>
                              {upload.rejection_reason.length > 30
                                ? upload.rejection_reason.substring(0, 30) + '...'
                                : upload.rejection_reason}
                            </p>
                          )}
                        </div>
                      </TableCell>

                      {/* Actions */}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewingDocument(upload.document_url)}
                            title="View Document"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          {canApprove && upload.status === 'pending' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleApprove(upload)}
                                disabled={actionLoading === upload.id}
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              >
                                {actionLoading === upload.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <CheckCircle className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setRejectingUpload(upload)}
                                disabled={actionLoading === upload.id}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Document Viewer Dialog */}
      <Dialog open={!!viewingDocument} onOpenChange={() => setViewingDocument(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Certificate Document
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {viewingDocument && (
              viewingDocument.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={viewingDocument}
                  className="w-full h-[70vh] border rounded"
                  title="Certificate Document"
                />
              ) : (
                <img
                  src={viewingDocument}
                  alt="Certificate Document"
                  className="max-w-full h-auto mx-auto"
                />
              )
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" asChild>
              <a href={viewingDocument || ''} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in New Tab
              </a>
            </Button>
            <Button onClick={() => setViewingDocument(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection Dialog */}
      <Dialog open={!!rejectingUpload} onOpenChange={() => setRejectingUpload(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Certification</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this certification upload.
              The employee will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {rejectingUpload && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{rejectingUpload.certificate_type}</p>
                <p className="text-sm text-muted-foreground">
                  Submitted by {rejectingUpload.user.name}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="rejectionReason">Rejection Reason *</Label>
              <Textarea
                id="rejectionReason"
                placeholder="e.g., Document is illegible, certificate has expired, name does not match employee record..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectingUpload(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectionReason.trim() || actionLoading === rejectingUpload?.id}
            >
              {actionLoading === rejectingUpload?.id ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Rejecting...
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
