// ============================================================================
// EMAIL CRUD OPERATIONS
// ============================================================================

import { supabase } from '../supabase';
import { projectId } from '../../utils/supabase/info';

const TRIKE_SERVER_URL = `https://${projectId}.supabase.co/functions/v1/trike-server`;

// ============================================================================
// TYPES
// ============================================================================

export interface EmailTemplate {
  id: string;
  organization_id: string | null;
  slug: string;
  name: string;
  description: string | null;
  subject: string;
  body_html: string;
  body_text: string | null;
  template_type: 'system' | 'organization';
  is_locked: boolean;
  is_active: boolean;
  available_variables: { key: string; description: string }[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailLog {
  id: string;
  organization_id: string;
  recipient_user_id: string | null;
  recipient_email: string;
  template_id: string | null;
  template_slug: string;
  subject: string;
  body_html: string | null;
  trigger_type: string;
  triggered_by: string | null;
  status: 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed';
  resend_id: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  created_at: string;
  recipient?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

export interface CreateTemplateInput {
  slug: string;
  name: string;
  description?: string;
  subject: string;
  body_html: string;
  body_text?: string;
  available_variables?: { key: string; description: string }[];
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  subject?: string;
  body_html?: string;
  body_text?: string;
  available_variables?: { key: string; description: string }[];
  is_active?: boolean;
}

export interface SendEmailInput {
  template_slug: string;
  recipient_email: string;
  recipient_user_id?: string;
  organization_id: string;
  variables: Record<string, string>;
}

export interface PreviewEmailInput {
  template_id?: string;
  template_slug?: string;
  variables: Record<string, string>;
}

// ============================================================================
// HELPER: Get auth headers
// ============================================================================

async function getAuthHeaders(): Promise<Headers> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers({
    'Content-Type': 'application/json',
  });
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }
  return headers;
}

// ============================================================================
// TEMPLATES
// ============================================================================

/**
 * Get all email templates (system + organization)
 */
export async function getEmailTemplates(): Promise<EmailTemplate[]> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${TRIKE_SERVER_URL}/email/templates`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch templates');
  }

  const data = await response.json();
  return data.templates;
}

/**
 * Get a single email template by ID
 */
export async function getEmailTemplate(templateId: string): Promise<EmailTemplate> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${TRIKE_SERVER_URL}/email/templates/${templateId}`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch template');
  }

  const data = await response.json();
  return data.template;
}

/**
 * Create a new organization email template
 */
export async function createEmailTemplate(input: CreateTemplateInput): Promise<EmailTemplate> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${TRIKE_SERVER_URL}/email/templates`, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create template');
  }

  const data = await response.json();
  return data.template;
}

/**
 * Update an email template
 */
export async function updateEmailTemplate(
  templateId: string,
  input: UpdateTemplateInput
): Promise<EmailTemplate> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${TRIKE_SERVER_URL}/email/templates/${templateId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update template');
  }

  const data = await response.json();
  return data.template;
}

/**
 * Delete an email template
 */
export async function deleteEmailTemplate(templateId: string): Promise<void> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${TRIKE_SERVER_URL}/email/templates/${templateId}`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete template');
  }
}

/**
 * Customize a system template by creating an org-level copy
 */
export async function customizeSystemTemplate(templateId: string): Promise<EmailTemplate> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${TRIKE_SERVER_URL}/email/templates/${templateId}/customize`, {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to customize template');
  }

  const data = await response.json();
  return data.template;
}

/**
 * Send a test email for a template to the current user
 */
export async function sendTestEmail(templateId: string): Promise<{ success: boolean; message?: string }> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${TRIKE_SERVER_URL}/email/templates/${templateId}/test`, {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to send test email');
  }

  return response.json();
}

// ============================================================================
// EMAIL LOGS
// ============================================================================

interface GetEmailLogsOptions {
  limit?: number;
  offset?: number;
  status?: EmailLog['status'];
  trigger_type?: string;
}

interface GetEmailLogsResult {
  logs: EmailLog[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Get email logs for the organization
 */
export async function getEmailLogs(options: GetEmailLogsOptions = {}): Promise<GetEmailLogsResult> {
  const headers = await getAuthHeaders();

  const params = new URLSearchParams();
  if (options.limit) params.set('limit', options.limit.toString());
  if (options.offset) params.set('offset', options.offset.toString());
  if (options.status) params.set('status', options.status);
  if (options.trigger_type) params.set('trigger_type', options.trigger_type);

  const url = `${TRIKE_SERVER_URL}/email/logs${params.toString() ? '?' + params.toString() : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch email logs');
  }

  return response.json();
}

// ============================================================================
// SEND & PREVIEW
// ============================================================================

/**
 * Send an email using a template
 */
export async function sendEmail(input: SendEmailInput): Promise<{ success: boolean; message_id?: string }> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${TRIKE_SERVER_URL}/email/send`, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to send email');
  }

  return response.json();
}

/**
 * Preview an email template with variables
 */
export async function previewEmailTemplate(input: PreviewEmailInput): Promise<{
  subject: string;
  body_html: string;
  body_text: string | null;
  available_variables: { key: string; description: string }[];
}> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${TRIKE_SERVER_URL}/email/preview`, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to preview template');
  }

  return response.json();
}

// ============================================================================
// TEMPLATE HELPERS
// ============================================================================

export interface OrgContext {
  name: string;
  adminName?: string;
  adminEmail?: string;
}

/**
 * Get sample variables for a template slug
 * If orgContext is provided, uses real org data instead of dummy data
 */
export function getSampleVariables(slug: string, orgContext?: OrgContext): Record<string, string> {
  const companyName = orgContext?.name || 'Acme Corporation';
  const adminName = orgContext?.adminName || 'John Smith';
  const adminEmail = orgContext?.adminEmail || 'john@company.com';

  const samples: Record<string, Record<string, string>> = {
    welcome_admin: {
      admin_name: adminName,
      company_name: companyName,
      login_email: adminEmail,
      temp_password: 'TempPass123!',
      login_url: 'https://app.trike.app',
    },
    welcome_employee: {
      employee_name: 'Jane Doe',
      company_name: companyName,
      login_email: `jane@${companyName.toLowerCase().replace(/\s+/g, '')}.com`,
      temp_password: 'TempPass123!',
      login_url: 'https://app.trike.app',
    },
    password_reset: {
      user_name: adminName,
      reset_link: 'https://app.trike.app/reset?token=abc123',
      expires_in: '1 hour',
    },
    password_changed: {
      user_name: adminName,
    },
  };

  return samples[slug] || {};
}

/**
 * Get status badge color for email log status
 */
export function getStatusColor(status: EmailLog['status']): string {
  const colors: Record<EmailLog['status'], string> = {
    pending: 'yellow',
    sent: 'blue',
    delivered: 'green',
    opened: 'purple',
    clicked: 'indigo',
    bounced: 'red',
    failed: 'red',
  };
  return colors[status] || 'gray';
}
