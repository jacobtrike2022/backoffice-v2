// ============================================================================
// CERTIFICATIONS CRUD OPERATIONS
// ============================================================================

import { supabase, getCurrentUserOrgId } from '../supabase';
import { createNotification } from './notifications';
import { logActivity } from './activity';

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