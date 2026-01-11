import { publicAnonKey, getServerUrl } from '../utils/supabase/info';

interface ServerHealthStatus {
  isHealthy: boolean;
  lastChecked: number;
  warningShown: boolean;
}

let healthStatus: ServerHealthStatus = {
  isHealthy: false,
  lastChecked: 0,
  warningShown: false,
};

const HEALTH_CHECK_INTERVAL = 30000; // Check every 30 seconds (faster recheck after deployment)

/**
 * Check if the server is deployed and healthy
 */
export async function checkServerHealth(): Promise<boolean> {
  const now = Date.now();
  
  // Return cached result if checked recently
  if (now - healthStatus.lastChecked < HEALTH_CHECK_INTERVAL) {
    return healthStatus.isHealthy;
  }
  
  try {
    const response = await fetch(`${getServerUrl()}/health`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'apikey': publicAnonKey,
      },
      // Allow more time for cold starts (Supabase Edge Functions can take 5-10s on cold start)
      signal: AbortSignal.timeout(10000),
    });
    
    healthStatus.isHealthy = response.ok;
    healthStatus.lastChecked = now;
    
    if (!healthStatus.isHealthy && !healthStatus.warningShown) {
      console.warn('⚠️ Server health check failed - server may not be deployed. Some features will be unavailable.');
      healthStatus.warningShown = true;
    }
    
    return healthStatus.isHealthy;
  } catch (error) {
    healthStatus.isHealthy = false;
    healthStatus.lastChecked = now;
    
    // Only show warning once
    if (!healthStatus.warningShown) {
      console.warn('⚠️ Server is not deployed. Attachments, facts, and version history will be unavailable until the server is deployed.');
      healthStatus.warningShown = true;
    }
    
    return false;
  }
}

/**
 * Get current health status without making a new request
 */
export function getHealthStatus(): boolean {
  return healthStatus.isHealthy;
}

/**
 * Reset health status (useful for forcing a recheck)
 */
export function resetHealthStatus(): void {
  healthStatus = {
    isHealthy: false,
    lastChecked: 0,
    warningShown: false,
  };
}

/**
 * Silently check if server is available (no warnings)
 */
export async function isServerAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${getServerUrl()}/health`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'apikey': publicAnonKey,
      },
      signal: AbortSignal.timeout(10000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
