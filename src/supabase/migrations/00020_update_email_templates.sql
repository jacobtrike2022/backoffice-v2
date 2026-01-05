-- =====================================================
-- UPDATE SYSTEM EMAIL TEMPLATES
-- =====================================================
-- Run this to update all system templates with Trike brand colors
-- This will delete and re-insert all system templates
-- Brand colors: Primary #F64A05, Secondary #FF733C
-- =====================================================

-- Delete existing system templates (organization_id IS NULL)
DELETE FROM email_templates WHERE organization_id IS NULL AND template_type = 'system';

-- Welcome Admin Template
INSERT INTO email_templates (
    organization_id,
    slug,
    name,
    description,
    subject,
    body_html,
    body_text,
    template_type,
    is_locked,
    available_variables
) VALUES (
    NULL,
    'welcome_admin',
    'Welcome - Admin Account',
    'Sent when a new admin account is created during onboarding',
    'Welcome to Trike, {{admin_name}}!',
    E'<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Trike</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; line-height: 1.6; color: #333333; background-color: #f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #F64A05 0%, #FF733C 100%); padding: 40px 30px; border-radius: 8px 8px 0 0; text-align: center;">
              <!--[if mso]>
              <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:600px;height:120px;">
                <v:fill type="gradient" color="#FF733C" color2="#F64A05" angle="135"/>
                <v:textbox inset="0,0,0,0">
              <![endif]-->
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff;">Welcome to Trike!</h1>
              <p style="margin: 10px 0 0 0; font-size: 16px; color: rgba(255,255,255,0.9);">Your {{company_name}} account is ready</p>
              <!--[if mso]>
                </v:textbox>
              </v:rect>
              <![endif]-->
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="background-color: #ffffff; padding: 40px 30px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333;">Hi {{admin_name}},</p>
              <p style="margin: 0 0 24px 0; font-size: 16px; color: #333333;">Your administrator account for <strong>{{company_name}}</strong> has been created. You can now access the Trike training platform to manage your team''s learning and compliance.</p>

              <!-- Credentials Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding-bottom: 16px;">
                          <p style="margin: 0 0 4px 0; font-size: 12px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5px;">Email</p>
                          <p style="margin: 0; font-size: 16px; font-weight: 500; color: #111827; font-family: ''SF Mono'', Monaco, ''Cascadia Code'', monospace;">{{login_email}}</p>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <p style="margin: 0 0 4px 0; font-size: 12px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5px;">Temporary Password</p>
                          <p style="margin: 0; font-size: 16px; font-weight: 500; color: #111827; font-family: ''SF Mono'', Monaco, ''Cascadia Code'', monospace;">{{temp_password}}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="border-radius: 6px; background-color: #F64A05;">
                    <a href="{{login_url}}" target="_blank" style="display: inline-block; padding: 14px 28px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 6px;">Login to Dashboard</a>
                  </td>
                </tr>
              </table>

              <!-- Security Note -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top: 24px; background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px;">
                <tr>
                  <td style="padding: 12px 16px;">
                    <p style="margin: 0; font-size: 14px; color: #92400e;"><strong>Security Note:</strong> Please change your password after your first login.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0; font-size: 14px; color: #6b7280;">&copy; Trike Training Platform</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>',
    E'Welcome to Trike, {{admin_name}}!

Your {{company_name}} account is ready.

Login Details:
Email: {{login_email}}
Password: {{temp_password}}

Login to Dashboard: {{login_url}}

For security, please change your password after first login.

- Trike Training Platform',
    'system',
    true,
    '[
      {"key": "admin_name", "description": "Administrator''s name"},
      {"key": "company_name", "description": "Organization name"},
      {"key": "login_email", "description": "Login email address"},
      {"key": "temp_password", "description": "Temporary password"},
      {"key": "login_url", "description": "URL to login page"}
    ]'::jsonb
);

-- Welcome Employee Template
INSERT INTO email_templates (
    organization_id,
    slug,
    name,
    description,
    subject,
    body_html,
    body_text,
    template_type,
    is_locked,
    available_variables
) VALUES (
    NULL,
    'welcome_employee',
    'Welcome - Employee Account',
    'Sent when a new employee/learner account is created',
    'Welcome to {{company_name}} Training!',
    E'<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Training</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; line-height: 1.6; color: #333333; background-color: #f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #F64A05 0%, #FF733C 100%); padding: 40px 30px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff;">Welcome!</h1>
              <p style="margin: 10px 0 0 0; font-size: 16px; color: rgba(255,255,255,0.9);">You''ve been added to {{company_name}}''s training platform</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="background-color: #ffffff; padding: 40px 30px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333;">Hi {{employee_name}},</p>
              <p style="margin: 0 0 24px 0; font-size: 16px; color: #333333;">You''ve been added to <strong>{{company_name}}</strong>''s training platform. Complete your assigned training to stay compliant and up-to-date.</p>

              <!-- Credentials Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding-bottom: 16px;">
                          <p style="margin: 0 0 4px 0; font-size: 12px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5px;">Email</p>
                          <p style="margin: 0; font-size: 16px; font-weight: 500; color: #111827; font-family: ''SF Mono'', Monaco, ''Cascadia Code'', monospace;">{{login_email}}</p>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <p style="margin: 0 0 4px 0; font-size: 12px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5px;">Temporary Password</p>
                          <p style="margin: 0; font-size: 16px; font-weight: 500; color: #111827; font-family: ''SF Mono'', Monaco, ''Cascadia Code'', monospace;">{{temp_password}}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="border-radius: 6px; background-color: #F64A05;">
                    <a href="{{login_url}}" target="_blank" style="display: inline-block; padding: 14px 28px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 6px;">Start Training</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0; font-size: 14px; color: #6b7280;">&copy; {{company_name}} via Trike</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>',
    E'Welcome to {{company_name}} Training!

Hi {{employee_name}},

You''ve been added to {{company_name}}''s training platform.

Login Details:
Email: {{login_email}}
Password: {{temp_password}}

Start Training: {{login_url}}

- {{company_name}}',
    'system',
    true,
    '[
      {"key": "employee_name", "description": "Employee''s name"},
      {"key": "company_name", "description": "Organization name"},
      {"key": "login_email", "description": "Login email address"},
      {"key": "temp_password", "description": "Temporary password"},
      {"key": "login_url", "description": "URL to login page"}
    ]'::jsonb
);

-- Password Reset Template
INSERT INTO email_templates (
    organization_id,
    slug,
    name,
    description,
    subject,
    body_html,
    body_text,
    template_type,
    is_locked,
    available_variables
) VALUES (
    NULL,
    'password_reset',
    'Password Reset',
    'Sent when a user requests a password reset',
    'Reset Your Trike Password',
    E'<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; line-height: 1.6; color: #333333; background-color: #f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%;">
          <!-- Header -->
          <tr>
            <td style="background-color: #18181b; padding: 40px 30px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff;">Password Reset</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="background-color: #ffffff; padding: 40px 30px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333;">Hi {{user_name}},</p>
              <p style="margin: 0 0 24px 0; font-size: 16px; color: #333333;">We received a request to reset your password. Click the button below to set a new password:</p>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="border-radius: 6px; background-color: #F64A05;">
                    <a href="{{reset_link}}" target="_blank" style="display: inline-block; padding: 14px 28px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 6px;">Reset Password</a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 24px 0; font-size: 16px; color: #333333;">This link will expire in <strong>{{expires_in}}</strong>.</p>

              <!-- Note -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f3f4f6; border-radius: 6px;">
                <tr>
                  <td style="padding: 12px 16px;">
                    <p style="margin: 0; font-size: 14px; color: #6b7280;">If you didn''t request this password reset, you can safely ignore this email. Your password will remain unchanged.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0; font-size: 14px; color: #6b7280;">&copy; Trike Training Platform</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>',
    E'Reset Your Trike Password

Hi {{user_name}},

We received a request to reset your password. Click the link below to set a new password:

{{reset_link}}

This link expires in {{expires_in}}.

If you didn''t request this, ignore this email.

- Trike Training Platform',
    'system',
    true,
    '[
      {"key": "user_name", "description": "User''s name"},
      {"key": "reset_link", "description": "Password reset URL"},
      {"key": "expires_in", "description": "Link expiration time (e.g., 1 hour)"}
    ]'::jsonb
);

-- Password Changed Confirmation Template
INSERT INTO email_templates (
    organization_id,
    slug,
    name,
    description,
    subject,
    body_html,
    body_text,
    template_type,
    is_locked,
    available_variables
) VALUES (
    NULL,
    'password_changed',
    'Password Changed Confirmation',
    'Sent when a user successfully changes their password',
    'Your Password Has Been Changed',
    E'<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Changed</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; line-height: 1.6; color: #333333; background-color: #f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%;">
          <!-- Header -->
          <tr>
            <td style="background-color: #16a34a; padding: 40px 30px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff;">Password Changed</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="background-color: #ffffff; padding: 40px 30px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333;">Hi {{user_name}},</p>
              <p style="margin: 0 0 24px 0; font-size: 16px; color: #333333;">Your password has been successfully changed.</p>

              <!-- Warning -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 6px;">
                <tr>
                  <td style="padding: 12px 16px;">
                    <p style="margin: 0; font-size: 14px; color: #b91c1c;"><strong>Didn''t make this change?</strong><br>If you didn''t change your password, please contact support immediately as your account may be compromised.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0; font-size: 14px; color: #6b7280;">&copy; Trike Training Platform</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>',
    E'Your Password Has Been Changed

Hi {{user_name}},

Your password has been successfully changed.

If you didn''t make this change, please contact support immediately.

- Trike Training Platform',
    'system',
    true,
    '[
      {"key": "user_name", "description": "User''s name"}
    ]'::jsonb
);
