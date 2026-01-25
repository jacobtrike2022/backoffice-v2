// ============================================================================
// CERTIFICATIONS CRUD OPERATIONS
// ============================================================================

import { supabase, getCurrentUserOrgId } from '../supabase';
import { createNotification } from './notifications';
import { logActivity } from './activity';
import { suppressAssignmentsForCertification } from './complianceAssignments';

/**
 * Check and auto-issue certification when user completes required tracks
 */
export async function checkAndIssueCertification(userId: string) {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) return;

  // Get all active certifications for org
  const { data: certifications } = await supabase
    .from('certifications')
    .select('*')
    .eq('organization_id', orgId)
    .eq('is_active', true);

  if (!certifications) return;

  for (const cert of certifications) {
    // Check if user already has valid certification
    const { data: existingCert } = await supabase
      .from('user_certifications')
      .select('*')
      .eq('user_id', userId)
      .eq('certification_id', cert.id)
      .in('status', ['valid', 'expiring-soon'])
      .single();

    if (existingCert) continue; // Already certified

    // Check if user completed all required tracks
    const requiredTrackIds = cert.required_tracks || [];
    if (requiredTrackIds.length === 0) continue;

    const { data: completedTracks } = await supabase
      .from('track_progress')
      .select('track_id')
      .eq('user_id', userId)
      .in('track_id', requiredTrackIds)
      .eq('status', 'completed');

    const completedTrackIds = completedTracks?.map(t => t.track_id) || [];

    // Check if all required tracks are completed
    const allCompleted = requiredTrackIds.every((trackId: string) => 
      completedTrackIds.includes(trackId)
    );

    if (allCompleted) {
      // Issue certification
      await issueCertification(userId, cert.id);
    }
  }
}

/**
 * Issue certification to user
 */
export async function issueCertification(
  userId: string,
  certificationId: string,
  score?: number
) {
  // Input validation
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid userId: must be a non-empty string');
  }
  if (!certificationId || typeof certificationId !== 'string') {
    throw new Error('Invalid certificationId: must be a non-empty string');
  }
  if (score !== undefined && (typeof score !== 'number' || score < 0 || score > 100)) {
    throw new Error('Invalid score: must be a number between 0 and 100');
  }
  // Get certification details
  const { data: cert } = await supabase
    .from('certifications')
    .select('*')
    .eq('id', certificationId)
    .single();

  if (!cert) throw new Error('Certification not found');

  const issueDate = new Date();
  const expirationDate = new Date(issueDate);
  expirationDate.setDate(expirationDate.getDate() + cert.validity_period_days);

  const { data: userCert, error } = await supabase
    .from('user_certifications')
    .insert({
      user_id: userId,
      certification_id: certificationId,
      issue_date: issueDate.toISOString().split('T')[0],
      expiration_date: expirationDate.toISOString().split('T')[0],
      status: 'valid',
      score,
      renewed_count: 0
    })
    .select()
    .single();

  if (error) throw error;

  // Create notification (non-critical - wrap in try-catch)
  try {
    await createNotification({
      user_id: userId,
      type: 'certification-issued',
      title: 'Certification Earned!',
      message: `You earned the "${cert.name}" certification`,
      link_url: `/certifications/${userCert.id}`
    });
  } catch (error) {
    // Log error but don't fail the certification issuance
    console.error('Failed to create certification notification:', error);
  }

  // Log activity (non-critical - wrap in try-catch)
  try {
    await logActivity({
      user_id: userId,
      action: 'certification',
      entity_type: 'certification',
      entity_id: certificationId,
      description: `Earned "${cert.name}" certification`
    });
  } catch (error) {
    // Log error but don't fail the certification issuance
    console.error('Failed to log certification activity:', error);
  }

  return userCert;
}

/**
 * Update certification statuses based on expiration dates
 * (Should be run periodically or on-demand)
 */
export async function updateCertificationStatuses() {
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const thirtyDaysDate = thirtyDaysFromNow.toISOString().split('T')[0];

  // Mark expired certifications
  const { data: expiredCerts } = await supabase
    .from('user_certifications')
    .update({ status: 'expired' })
    .lt('expiration_date', today)
    .neq('status', 'expired')
    .select('id, user_id, certification_id, certifications(name)');

  // Notify users of expired certifications
  if (expiredCerts) {
    for (const cert of expiredCerts) {
      try {
        await createNotification({
          user_id: cert.user_id,
          type: 'certification-expired',
          title: 'Certification Expired',
          message: `Your "${(cert as any).certifications.name}" certification has expired`,
          link_url: `/certifications/${cert.id}`
        });
      } catch (error) {
        // Log error but continue processing other certifications
        console.error(`Failed to create expired notification for user ${cert.user_id}:`, error);
      }
    }
  }

  // Mark expiring-soon certifications
  const { data: expiringSoon } = await supabase
    .from('user_certifications')
    .update({ status: 'expiring-soon' })
    .gte('expiration_date', today)
    .lte('expiration_date', thirtyDaysDate)
    .eq('status', 'valid')
    .select('id, user_id, certification_id, certifications(name), expiration_date');

  // Notify users of expiring certifications
  if (expiringSoon) {
    for (const cert of expiringSoon) {
      const daysUntilExpiration = Math.ceil(
        (new Date(cert.expiration_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );

      try {
        await createNotification({
          user_id: cert.user_id,
          type: 'certification-expiry',
          title: 'Certification Expiring Soon',
          message: `Your "${(cert as any).certifications.name}" certification expires in ${daysUntilExpiration} days`,
          link_url: `/certifications/${cert.id}`
        });
      } catch (error) {
        // Log error but continue processing other certifications
        console.error(`Failed to create expiry notification for user ${cert.user_id}:`, error);
      }
    }
  }
}

/**
 * Get user certifications
 */
export async function getUserCertifications(userId: string) {
  const { data, error } = await supabase
    .from('user_certifications')
    .select(`
      *,
      certification:certifications(*)
    `)
    .eq('user_id', userId)
    .order('issued_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Get expiring certifications for organization
 */
export async function getExpiringCertifications(daysThreshold: number = 30) {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  const today = new Date();
  const futureDate = new Date(today);
  futureDate.setDate(futureDate.getDate() + daysThreshold);

  const { data, error } = await supabase
    .from('user_certifications')
    .select(`
      *,
      user:users!inner(organization_id, name, email, store:stores(name)),
      certification:certifications(name, description)
    `)
    .eq('user.organization_id', orgId)
    .gte('expiration_date', today.toISOString().split('T')[0])
    .lte('expiration_date', futureDate.toISOString().split('T')[0])
    .order('expiration_date', { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Renew certification (admin only for now)
 */
export async function renewCertification(
  userCertificationId: string,
  renewedById: string
) {
  // Get existing certification
  const { data: existingCert } = await supabase
    .from('user_certifications')
    .select(`
      *,
      certification:certifications(validity_period_days)
    `)
    .eq('id', userCertificationId)
    .single();

  if (!existingCert) throw new Error('Certification not found');

  const newIssueDate = new Date();
  const newExpirationDate = new Date(newIssueDate);
  newExpirationDate.setDate(
    newExpirationDate.getDate() + (existingCert.certification as any).validity_period_days
  );

  const { data, error } = await supabase
    .from('user_certifications')
    .update({
      issue_date: newIssueDate.toISOString().split('T')[0],
      expiration_date: newExpirationDate.toISOString().split('T')[0],
      status: 'valid',
      renewed_count: existingCert.renewed_count + 1
    })
    .eq('id', userCertificationId)
    .select()
    .single();

  if (error) throw error;

  // Notify user (non-critical - wrap in try-catch)
  try {
    await createNotification({
      user_id: existingCert.user_id,
      type: 'certification-issued',
      title: 'Certification Renewed',
      message: `Your certification has been renewed`,
      link_url: `/certifications/${userCertificationId}`
    });
  } catch (error) {
    // Log error but don't fail the renewal
    console.error('Failed to create renewal notification:', error);
  }

  return data;
}

// ============================================================================
// ORGANIZATION-LEVEL QUERIES
// ============================================================================

/**
 * Get all certifications for an organization
 */
export async function getCertificationsByOrganization() {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('user_certifications')
    .select(`
      *,
      user:users!inner(
        id,
        name,
        email,
        organization_id,
        store:stores(id, name)
      ),
      certification:certifications(id, name, description, validity_period_days)
    `)
    .eq('user.organization_id', orgId)
    .order('expiration_date', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Get user certifications with full details (for CertificationTracker)
 */
export async function getUserCertificationsWithDetails(userId: string) {
  const { data, error } = await supabase
    .from('user_certifications')
    .select(`
      id,
      user_id,
      certification_id,
      issue_date,
      expiration_date,
      status,
      score,
      renewed_count,
      created_at,
      user:users(
        id,
        name,
        email,
        store:stores(id, name)
      ),
      certification:certifications(
        id,
        name,
        description,
        validity_period_days
      )
    `)
    .eq('user_id', userId)
    .order('expiration_date', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Get certification statistics for the organization
 */
export async function getCertificationStats() {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  // Get all certifications for org users
  const { data: allCerts, error: allError } = await supabase
    .from('user_certifications')
    .select(`
      id,
      status,
      user:users!inner(organization_id)
    `)
    .eq('user.organization_id', orgId);

  if (allError) throw allError;

  const certs = allCerts || [];
  const total = certs.length;
  const valid = certs.filter(c => c.status === 'valid').length;
  const expiringSoon = certs.filter(c => c.status === 'expiring-soon').length;
  const expired = certs.filter(c => c.status === 'expired').length;
  const revoked = certs.filter(c => c.status === 'revoked').length;

  return {
    total,
    valid,
    expiringSoon,
    expired,
    revoked,
    active: valid + expiringSoon // Valid or expiring soon = still active
  };
}

/**
 * Get all certifications for the tracker view with user details
 */
export async function getCertificationsForTracker() {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('user_certifications')
    .select(`
      id,
      user_id,
      certification_id,
      issue_date,
      expiration_date,
      status,
      score,
      renewed_count,
      created_at,
      user:users!inner(
        id,
        name,
        email,
        organization_id,
        store:stores(id, name),
        role:roles(id, name)
      ),
      certification:certifications(
        id,
        name,
        description,
        validity_period_days
      )
    `)
    .eq('user.organization_id', orgId)
    .order('expiration_date', { ascending: true });

  if (error) throw error;

  // Transform data for the tracker component
  return (data || []).map((cert: any) => {
    const today = new Date();
    const expirationDate = new Date(cert.expiration_date);
    const daysUntilExpiration = Math.ceil(
      (expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      id: cert.id,
      name: cert.certification?.name || 'Unknown Certification',
      employee: cert.user?.name || 'Unknown Employee',
      employeeId: cert.user_id,
      employeeEmail: cert.user?.email || '',
      store: cert.user?.store?.name || 'No Store',
      storeId: cert.user?.store?.id || null,
      role: cert.user?.role?.name || 'No Role',
      expirationDate: cert.expiration_date,
      issueDate: cert.issue_date,
      status: cert.status,
      daysUntilExpiration,
      score: cert.score,
      renewedCount: cert.renewed_count
    };
  });
}

// ============================================================================
// EXTERNAL CERTIFICATION UPLOADS
// ============================================================================

export interface ExternalCertificationUploadInput {
  certificate_type: string;
  certificate_number?: string;
  name_on_certificate: string;
  issuing_authority: string;
  training_provider?: string;
  state_issued?: string;
  issue_date: string;
  expiry_date?: string;
  document_url: string;
  document_storage_path: string;
}

/**
 * Create an external certification upload (submit for approval)
 */
export async function createExternalCertificationUpload(
  input: ExternalCertificationUploadInput
) {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  // Get current user ID
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) throw new Error('User not authenticated');

  const { data: currentUser } = await supabase
    .from('users')
    .select('id')
    .eq('auth_user_id', authUser.id)
    .single();

  if (!currentUser) throw new Error('User profile not found');

  const { data, error } = await supabase
    .from('external_certification_uploads')
    .insert({
      organization_id: orgId,
      user_id: currentUser.id,
      ...input,
      status: 'pending'
    })
    .select()
    .single();

  if (error) throw error;

  // Notify admins of new upload (non-critical)
  try {
    await notifyAdminsOfPendingUpload(orgId, data.id, input.certificate_type);
  } catch (err) {
    console.error('Failed to notify admins of pending upload:', err);
  }

  return data;
}

/**
 * Notify admins when a new certification upload is pending
 */
async function notifyAdminsOfPendingUpload(
  orgId: string,
  uploadId: string,
  certificateType: string
) {
  // Get all admins for the organization by joining with roles table
  const { data: admins } = await supabase
    .from('users')
    .select('id, role:roles(name)')
    .eq('organization_id', orgId)
    .eq('status', 'active');

  // Filter for admin roles in JavaScript since we need to match role names from the joined table
  const adminUsers = admins?.filter(user => {
    const roleName = (user.role as any)?.name?.toLowerCase() || '';
    return roleName.includes('admin') || roleName === 'trike super admin';
  }) || [];

  if (adminUsers.length === 0) return;

  // Create notifications for each admin
  for (const admin of adminUsers) {
    try {
      await createNotification({
        user_id: admin.id,
        type: 'cert-upload-pending',
        title: 'New Certification Upload',
        message: `A new ${certificateType} certification has been uploaded and requires approval`,
        link_url: `/compliance?tab=approvals&upload=${uploadId}`
      });
    } catch (err) {
      console.error(`Failed to notify admin ${admin.id}:`, err);
    }
  }
}

/**
 * Get pending certification uploads for admin review
 */
export async function getPendingCertificationUploads() {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('external_certification_uploads')
    .select(`
      *,
      user:users(
        id,
        name,
        email,
        store:stores(id, name)
      )
    `)
    .eq('organization_id', orgId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Get all certification uploads (with optional status filter)
 */
export async function getCertificationUploads(status?: 'pending' | 'approved' | 'rejected') {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  let query = supabase
    .from('external_certification_uploads')
    .select(`
      *,
      user:users(
        id,
        name,
        email,
        store:stores(id, name)
      ),
      reviewer:users!external_certification_uploads_reviewed_by_fkey(
        id,
        name
      )
    `)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

/**
 * Get a user's own certification uploads
 */
export async function getUserCertificationUploads(userId: string) {
  const { data, error } = await supabase
    .from('external_certification_uploads')
    .select(`
      *,
      reviewer:users!external_certification_uploads_reviewed_by_fkey(
        id,
        name
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Find a compliance requirement that matches a certificate type
 * Matches by topic name (case-insensitive, partial match)
 */
async function findMatchingRequirement(
  certificateType: string,
  userState: string | null
): Promise<{ id: string; requirement_name: string } | null> {
  // Normalize the certificate type for matching
  const normalizedType = certificateType.toLowerCase().trim();

  // Build the query - prioritize state-specific requirements, then any state
  let query = supabase
    .from('compliance_requirements')
    .select(`
      id,
      requirement_name,
      state_code,
      topic:compliance_topics!inner(name)
    `)
    .eq('status', 'active');

  const { data: requirements, error } = await query;
  if (error || !requirements) return null;

  // Score each requirement based on match quality
  type ScoredReq = { id: string; requirement_name: string; score: number };
  const scored: ScoredReq[] = requirements.map(req => {
    let score = 0;
    const topicName = (req.topic as { name: string })?.name?.toLowerCase() || '';
    const reqName = req.requirement_name?.toLowerCase() || '';

    // Exact topic match (highest priority)
    if (normalizedType === topicName) score += 100;
    // Topic contains certificate type
    else if (topicName.includes(normalizedType)) score += 50;
    // Certificate type contains topic
    else if (normalizedType.includes(topicName)) score += 40;
    // Requirement name match
    if (reqName.includes(normalizedType) || normalizedType.includes(reqName)) score += 20;

    // State match bonus
    if (userState && req.state_code === userState.toUpperCase()) score += 30;

    return { id: req.id, requirement_name: req.requirement_name, score };
  });

  // Return the best match above threshold
  const best = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score)[0];
  return best ? { id: best.id, requirement_name: best.requirement_name } : null;
}

/**
 * Approve an external certification upload
 */
export async function approveExternalCertification(
  uploadId: string,
  reviewerId: string
) {
  // Get the upload details
  const { data: upload, error: fetchError } = await supabase
    .from('external_certification_uploads')
    .select('*')
    .eq('id', uploadId)
    .single();

  if (fetchError) throw fetchError;
  if (!upload) throw new Error('Upload not found');
  if (upload.status !== 'pending') throw new Error('Upload is not pending approval');

  // Find or create the certification type in certifications table
  let certificationId: string | null = null;

  // Try to find existing certification matching the type
  const { data: existingCert } = await supabase
    .from('certifications')
    .select('id')
    .eq('organization_id', upload.organization_id)
    .ilike('name', upload.certificate_type)
    .single();

  if (existingCert) {
    certificationId = existingCert.id;
  } else {
    // Create a new certification type for this external cert
    const { data: newCert, error: createError } = await supabase
      .from('certifications')
      .insert({
        organization_id: upload.organization_id,
        name: upload.certificate_type,
        description: `External certification: ${upload.certificate_type}`,
        is_external: true,
        validity_period_days: upload.expiry_date
          ? Math.ceil((new Date(upload.expiry_date).getTime() - new Date(upload.issue_date).getTime()) / (1000 * 60 * 60 * 24))
          : 365, // Default 1 year if no expiry
        is_active: true
      })
      .select('id')
      .single();

    if (createError) throw createError;
    certificationId = newCert.id;
  }

  // Create the user_certification record
  const { data: userCert, error: userCertError } = await supabase
    .from('user_certifications')
    .insert({
      user_id: upload.user_id,
      certification_id: certificationId,
      issue_date: upload.issue_date,
      expiration_date: upload.expiry_date,
      status: upload.expiry_date && new Date(upload.expiry_date) < new Date() ? 'expired' : 'valid',
      certificate_number: upload.certificate_number,
      document_url: upload.document_url
    })
    .select()
    .single();

  if (userCertError) throw userCertError;

  // Update the upload record
  const { data: updatedUpload, error: updateError } = await supabase
    .from('external_certification_uploads')
    .update({
      status: 'approved',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      user_certification_id: userCert.id
    })
    .eq('id', uploadId)
    .select()
    .single();

  if (updateError) throw updateError;

  // Try to find and link a matching compliance requirement, then suppress pending assignments
  let suppressedCount = 0;
  try {
    // Get the user's state from their store
    const { data: userData } = await supabase
      .from('users')
      .select('store:stores(state)')
      .eq('id', upload.user_id)
      .single();

    const userState = (userData?.store as { state?: string })?.state || null;

    // Find matching compliance requirement
    const matchingRequirement = await findMatchingRequirement(upload.certificate_type, userState);

    if (matchingRequirement) {
      // Update user_certification with the requirement_id
      await supabase
        .from('user_certifications')
        .update({ requirement_id: matchingRequirement.id })
        .eq('id', userCert.id);

      // Suppress any pending compliance assignments for this user + requirement
      suppressedCount = await suppressAssignmentsForCertification(
        upload.user_id,
        matchingRequirement.id
      );

      if (suppressedCount > 0) {
        console.log(`Suppressed ${suppressedCount} pending compliance assignment(s) for ${upload.certificate_type}`);
      }
    }
  } catch (err) {
    // Non-critical - log but don't fail the approval
    console.error('Failed to suppress compliance assignments:', err);
  }

  // Notify the user (non-critical)
  try {
    await createNotification({
      user_id: upload.user_id,
      type: 'cert-upload-approved',
      title: 'Certification Approved',
      message: `Your ${upload.certificate_type} certification has been approved`,
      link_url: `/certifications/${userCert.id}`
    });
  } catch (err) {
    console.error('Failed to notify user of approval:', err);
  }

  // Log activity (non-critical)
  try {
    await logActivity({
      user_id: reviewerId,
      action: 'approve_certification',
      entity_type: 'external_certification_upload',
      entity_id: uploadId,
      description: `Approved ${upload.certificate_type} certification for user${suppressedCount > 0 ? ` (suppressed ${suppressedCount} pending assignment${suppressedCount > 1 ? 's' : ''})` : ''}`
    });
  } catch (err) {
    console.error('Failed to log approval activity:', err);
  }

  return { upload: updatedUpload, userCertification: userCert, suppressedAssignments: suppressedCount };
}

/**
 * Reject an external certification upload
 */
export async function rejectExternalCertification(
  uploadId: string,
  reviewerId: string,
  rejectionReason: string
) {
  // Get the upload details
  const { data: upload, error: fetchError } = await supabase
    .from('external_certification_uploads')
    .select('*')
    .eq('id', uploadId)
    .single();

  if (fetchError) throw fetchError;
  if (!upload) throw new Error('Upload not found');
  if (upload.status !== 'pending') throw new Error('Upload is not pending approval');

  // Update the upload record
  const { data: updatedUpload, error: updateError } = await supabase
    .from('external_certification_uploads')
    .update({
      status: 'rejected',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: rejectionReason
    })
    .eq('id', uploadId)
    .select()
    .single();

  if (updateError) throw updateError;

  // Notify the user (non-critical)
  try {
    await createNotification({
      user_id: upload.user_id,
      type: 'cert-upload-rejected',
      title: 'Certification Rejected',
      message: `Your ${upload.certificate_type} certification was rejected: ${rejectionReason}`,
      link_url: `/compliance/uploads`
    });
  } catch (err) {
    console.error('Failed to notify user of rejection:', err);
  }

  // Log activity (non-critical)
  try {
    await logActivity({
      user_id: reviewerId,
      action: 'reject_certification',
      entity_type: 'external_certification_upload',
      entity_id: uploadId,
      description: `Rejected ${upload.certificate_type} certification: ${rejectionReason}`
    });
  } catch (err) {
    console.error('Failed to log rejection activity:', err);
  }

  return updatedUpload;
}

/**
 * Get pending uploads count for badge display
 */
export async function getPendingUploadsCount() {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) return 0;

  const { count, error } = await supabase
    .from('external_certification_uploads')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('status', 'pending');

  if (error) {
    console.error('Error getting pending uploads count:', error);
    return 0;
  }

  return count || 0;
}

// ============================================================================
// BULK CERTIFICATE IMPORT
// ============================================================================

export interface BulkImportRow {
  employee_email: string;
  certificate_type: string;
  issue_date: string;
  expiry_date?: string;
  certificate_number?: string;
}

export interface BulkImportResult {
  total: number;
  successful: number;
  failed: number;
  suppressedAssignments: number;
  errors: Array<{ row: number; email: string; error: string }>;
  importId: string;
}

/**
 * Process a bulk certificate import from parsed CSV data
 */
export async function processBulkCertImport(
  rows: BulkImportRow[],
  fileName: string,
  onProgress?: (current: number, total: number) => void
): Promise<BulkImportResult> {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const result: BulkImportResult = {
    total: rows.length,
    successful: 0,
    failed: 0,
    suppressedAssignments: 0,
    errors: [],
    importId: ''
  };

  // Create the import record
  const { data: importRecord, error: importError } = await supabase
    .from('certification_imports')
    .insert({
      organization_id: orgId,
      imported_by: user.id,
      file_name: fileName,
      total_rows: rows.length,
      successful_rows: 0,
      failed_rows: 0,
      status: 'processing'
    })
    .select()
    .single();

  if (importError) throw importError;
  result.importId = importRecord.id;

  // Pre-fetch all users in org by email for faster lookup
  const { data: orgUsers } = await supabase
    .from('users')
    .select('id, email, store:stores(state)')
    .eq('organization_id', orgId);

  const usersByEmail = new Map<string, { id: string; state: string | null }>();
  (orgUsers || []).forEach(u => {
    if (u.email) {
      usersByEmail.set(u.email.toLowerCase(), {
        id: u.id,
        state: (u.store as { state?: string })?.state || null
      });
    }
  });

  // Process each row
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // +2 for 1-based index and header row

    try {
      // Find user by email
      const userData = usersByEmail.get(row.employee_email.toLowerCase());
      if (!userData) {
        result.errors.push({ row: rowNum, email: row.employee_email, error: 'Employee not found' });
        result.failed++;
        continue;
      }

      // Parse dates
      const issueDate = new Date(row.issue_date);
      if (isNaN(issueDate.getTime())) {
        result.errors.push({ row: rowNum, email: row.employee_email, error: 'Invalid issue date' });
        result.failed++;
        continue;
      }

      let expiryDate: Date | null = null;
      if (row.expiry_date) {
        expiryDate = new Date(row.expiry_date);
        if (isNaN(expiryDate.getTime())) {
          result.errors.push({ row: rowNum, email: row.employee_email, error: 'Invalid expiry date' });
          result.failed++;
          continue;
        }
      }

      // Find or create certification type
      let certificationId: string;
      const { data: existingCert } = await supabase
        .from('certifications')
        .select('id')
        .eq('organization_id', orgId)
        .ilike('name', row.certificate_type)
        .single();

      if (existingCert) {
        certificationId = existingCert.id;
      } else {
        const { data: newCert, error: createError } = await supabase
          .from('certifications')
          .insert({
            organization_id: orgId,
            name: row.certificate_type,
            description: `Imported certification: ${row.certificate_type}`,
            is_external: true,
            validity_period_days: expiryDate
              ? Math.ceil((expiryDate.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24))
              : 365,
            is_active: true
          })
          .select('id')
          .single();

        if (createError) {
          result.errors.push({ row: rowNum, email: row.employee_email, error: `Failed to create cert type: ${createError.message}` });
          result.failed++;
          continue;
        }
        certificationId = newCert.id;
      }

      // Find matching compliance requirement
      const matchingRequirement = await findMatchingRequirement(row.certificate_type, userData.state);

      // Create user_certification
      const { data: userCert, error: certError } = await supabase
        .from('user_certifications')
        .insert({
          user_id: userData.id,
          certification_id: certificationId,
          issue_date: issueDate.toISOString(),
          expiration_date: expiryDate?.toISOString() || null,
          status: expiryDate && expiryDate < new Date() ? 'expired' : 'valid',
          certificate_number: row.certificate_number || null,
          source_type: 'legacy_import',
          requirement_id: matchingRequirement?.id || null,
          import_batch_id: importRecord.id
        })
        .select()
        .single();

      if (certError) {
        result.errors.push({ row: rowNum, email: row.employee_email, error: `Failed to create cert: ${certError.message}` });
        result.failed++;
        continue;
      }

      // Suppress pending assignments if we have a matching requirement
      if (matchingRequirement) {
        try {
          const suppressedCount = await suppressAssignmentsForCertification(userData.id, matchingRequirement.id);
          result.suppressedAssignments += suppressedCount;
        } catch {
          // Non-critical, continue
        }
      }

      result.successful++;
    } catch (err) {
      result.errors.push({ row: rowNum, email: row.employee_email, error: err instanceof Error ? err.message : 'Unknown error' });
      result.failed++;
    }

    // Report progress
    if (onProgress) {
      onProgress(i + 1, rows.length);
    }
  }

  // Update the import record with final stats
  const errorLog = result.errors.length > 0 ? result.errors : null;
  await supabase
    .from('certification_imports')
    .update({
      successful_rows: result.successful,
      failed_rows: result.failed,
      error_log: errorLog,
      status: 'completed',
      completed_at: new Date().toISOString()
    })
    .eq('id', importRecord.id);

  // Log activity
  try {
    await logActivity({
      user_id: user.id,
      action: 'bulk_import_certifications',
      entity_type: 'certification_import',
      entity_id: importRecord.id,
      description: `Bulk imported ${result.successful} certifications (${result.failed} failed)${result.suppressedAssignments > 0 ? `, suppressed ${result.suppressedAssignments} assignments` : ''}`
    });
  } catch {
    // Non-critical
  }

  return result;
}