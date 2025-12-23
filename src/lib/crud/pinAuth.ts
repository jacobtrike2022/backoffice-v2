// ============================================================================
// PIN AUTHENTICATION - Quick Login for QR Codes & Learner App
// ============================================================================

import { supabase } from '../supabase';

export interface PinLoginResult {
  success: boolean;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    organizationId: string;
    roleId: string | null;
    storeId: string | null;
  };
  error?: string;
}

/**
 * Authenticate user with 4-digit PIN
 * Used for: KB public viewer, QR code access, learner app
 */
export async function loginWithPin(
  pin: string,
  organizationId: string
): Promise<PinLoginResult> {
  // Validate PIN format
  if (!/^\d{4}$/.test(pin)) {
    return {
      success: false,
      error: 'PIN must be 4 digits'
    };
  }

  try {
    // Call Supabase function to lookup user
    const { data, error } = await supabase
      .rpc('get_user_by_pin', {
        pin_input: pin,
        org_id: organizationId
      });

    if (error) {
      console.error('PIN login error:', error);
      return {
        success: false,
        error: 'Invalid PIN'
      };
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        error: 'Invalid PIN'
      };
    }

    const user = data[0];

    // Store session in localStorage (not real auth, just tracking)
    const session = {
      userId: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      organizationId: user.organization_id,
      roleId: user.role_id,
      storeId: user.store_id,
      loginMethod: 'pin',
      loginAt: new Date().toISOString()
    };

    localStorage.setItem('trike_pin_session', JSON.stringify(session));

    return {
      success: true,
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        organizationId: user.organization_id,
        roleId: user.role_id,
        storeId: user.store_id
      }
    };
  } catch (error) {
    console.error('PIN login exception:', error);
    return {
      success: false,
      error: 'Login failed'
    };
  }
}

/**
 * Get current PIN session from localStorage
 */
export function getPinSession() {
  try {
    const session = localStorage.getItem('trike_pin_session');
    if (!session) return null;
    
    const parsed = JSON.parse(session);
    
    // Check if session is expired (24 hours)
    const loginAt = new Date(parsed.loginAt);
    const now = new Date();
    const hoursSinceLogin = (now.getTime() - loginAt.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceLogin > 24) {
      clearPinSession();
      return null;
    }
    
    return parsed;
  } catch (error) {
    console.error('Error reading PIN session:', error);
    return null;
  }
}

/**
 * Clear PIN session (logout)
 */
export function clearPinSession() {
  localStorage.removeItem('trike_pin_session');
}

/**
 * Generate a new PIN for a user (admin function)
 * Ensures uniqueness within the user's organization
 */
export async function generateUserPin(userId: string): Promise<string | null> {
  try {
    // First, get the user's organization_id
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('Failed to get user organization:', userError);
      return null;
    }

    const organizationId = user.organization_id;
    if (!organizationId) {
      console.error('User has no organization_id');
      return null;
    }

    // Generate a unique PIN within the organization
    let attempts = 0;
    const maxAttempts = 100;
    let newPin: string | null = null;

    while (attempts < maxAttempts) {
      // Generate random 4-digit PIN
      const randomPin = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      
      // Check uniqueness within organization
      const isUnique = await checkPinUniqueness(randomPin, organizationId, userId);
      if (isUnique) {
        newPin = randomPin;
        break;
      }
      
      attempts++;
    }

    if (!newPin) {
      console.error('Failed to generate unique PIN after', maxAttempts, 'attempts');
      return null;
    }

    // Update user record
    const { error } = await supabase
      .from('users')
      .update({
        pin: newPin,
        pin_set_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      console.error('Failed to set PIN:', error);
      return null;
    }

    return newPin;
  } catch (error) {
    console.error('Error generating PIN:', error);
    return null;
  }
}

/**
 * Get user PIN (admin function)
 */
export async function getUserPin(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('pin')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Failed to get PIN:', error);
      return null;
    }

    return data?.pin || null;
  } catch (error) {
    console.error('Error getting PIN:', error);
    return null;
  }
}

/**
 * Check if PIN is unique within organization
 */
export async function checkPinUniqueness(pin: string, organizationId: string, excludeUserId?: string): Promise<boolean> {
  try {
    let query = supabase
      .from('users')
      .select('id')
      .eq('pin', pin)
      .eq('organization_id', organizationId)
      .not('pin', 'is', null);

    if (excludeUserId) {
      query = query.neq('id', excludeUserId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to check PIN uniqueness:', error);
      return false;
    }

    return !data || data.length === 0;
  } catch (error) {
    console.error('Error checking PIN uniqueness:', error);
    return false;
  }
}

/**
 * Set custom PIN for a user (admin or self-service)
 */
export async function setUserPin(userId: string, pin: string, organizationId?: string): Promise<boolean> {
  // Validate PIN format
  if (!/^\d{4}$/.test(pin)) {
    throw new Error('PIN must be 4 digits');
  }

  try {
    // If organizationId is provided, check uniqueness
    if (organizationId) {
      const isUnique = await checkPinUniqueness(pin, organizationId, userId);
      if (!isUnique) {
        throw new Error('This PIN is already in use by another employee in your organization');
      }
    }

    const { error } = await supabase
      .from('users')
      .update({
        pin: pin,
        pin_set_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      console.error('Failed to set PIN:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error setting PIN:', error);
    throw error;
  }
}

/**
 * Reset PIN via phone number (SMS flow would go here)
 */
export async function resetPinViaPhone(phone: string, organizationId: string): Promise<boolean> {
  try {
    // Find user by phone
    const { data: user, error: findError } = await supabase
      .from('users')
      .select('id, first_name, email')
      .eq('phone', phone)
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .single();

    if (findError || !user) {
      console.error('User not found with phone:', phone);
      return false;
    }

    // Generate new PIN
    const newPin = await generateUserPin(user.id);

    if (!newPin) {
      return false;
    }

    // TODO: Send SMS with new PIN
    // For now, just log it (in production, integrate Twilio)
    console.log(`New PIN for ${user.first_name} (${user.email}): ${newPin}`);
    
    // In production, you'd call:
    // await sendSMS(phone, `Your new Trike PIN is ${newPin}`);

    return true;
  } catch (error) {
    console.error('Error resetting PIN:', error);
    return false;
  }
}
