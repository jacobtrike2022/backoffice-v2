import { APP_CONFIG } from "../config";
import { getServerUrl, publicAnonKey } from "../../utils/supabase/info";

const VISITOR_KEY = "demo_tracking_visitor_id";
const SESSION_KEY = "demo_tracking_session_id";
const SESSION_LAST_SEEN_KEY = "demo_tracking_session_last_seen";
const SUPER_ADMIN_AUTH_KEY = "trike_super_admin_auth";
const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

type TrackRole = "admin" | "district-manager" | "store-manager" | "trike-super-admin" | string | null | undefined;

export type DemoTrackingEvent = {
  eventType: string;
  path: string;
  fromPath?: string;
  referrer?: string;
  trackId?: string;
  trackTitle?: string;
  metadata?: Record<string, unknown>;
};

export type DemoTrackingContext = {
  organizationId?: string | null;
  organizationName?: string | null;
  currentRole?: TrackRole;
};

function nowIso(): string {
  return new Date().toISOString();
}

function safeStorageGet(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(storage: Storage, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    // Non-blocking by design.
  }
}

export function isDemoTrackingEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return (import.meta.env.VITE_DEMO_TRACKING_ENABLED ?? "false") === "true";
}

export function getOrCreateVisitorId(): string {
  if (typeof window === "undefined") return "server";
  const existing = safeStorageGet(window.localStorage, VISITOR_KEY);
  if (existing) return existing;
  const generated = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `visitor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  safeStorageSet(window.localStorage, VISITOR_KEY, generated);
  return generated;
}

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "server-session";

  const existing = safeStorageGet(window.sessionStorage, SESSION_KEY);
  const lastSeenRaw = safeStorageGet(window.sessionStorage, SESSION_LAST_SEEN_KEY);
  const lastSeen = lastSeenRaw ? Number(lastSeenRaw) : 0;
  const idleExpired = !lastSeen || Number.isNaN(lastSeen) || (Date.now() - lastSeen > SESSION_IDLE_TIMEOUT_MS);

  if (existing && !idleExpired) {
    safeStorageSet(window.sessionStorage, SESSION_LAST_SEEN_KEY, String(Date.now()));
    return existing;
  }

  const generated = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  safeStorageSet(window.sessionStorage, SESSION_KEY, generated);
  safeStorageSet(window.sessionStorage, SESSION_LAST_SEEN_KEY, String(Date.now()));
  return generated;
}

export function shouldTrackDemoActivity(context: DemoTrackingContext): boolean {
  if (!isDemoTrackingEnabled()) return false;

  const superAdminUnlocked =
    typeof window !== "undefined" &&
    safeStorageGet(window.localStorage, SUPER_ADMIN_AUTH_KEY) === "true";
  if (superAdminUnlocked) return false;

  if (context.currentRole === "trike-super-admin") return false;

  if (context.organizationId && context.organizationId === APP_CONFIG.TRIKE_CO_ORG_ID) {
    return false;
  }

  return true;
}

function buildPayload(event: DemoTrackingEvent, context: DemoTrackingContext) {
  return {
    organizationId: context.organizationId ?? null,
    organizationName: context.organizationName ?? null,
    visitorId: getOrCreateVisitorId(),
    sessionId: getOrCreateSessionId(),
    eventType: event.eventType,
    path: event.path,
    fromPath: event.fromPath ?? null,
    referrer: event.referrer ?? null,
    trackId: event.trackId ?? null,
    trackTitle: event.trackTitle ?? null,
    metadata: event.metadata ?? {},
    occurredAt: nowIso(),
  };
}

export async function trackDemoActivityEvent(
  event: DemoTrackingEvent,
  context: DemoTrackingContext
): Promise<void> {
  try {
    if (typeof window === "undefined") return;
    if (!shouldTrackDemoActivity(context)) return;

    const payload = buildPayload(event, context);
    const body = JSON.stringify(payload);
    const url = `${getServerUrl()}/demo/activity`;

    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      const beaconSent = navigator.sendBeacon(url, blob);
      if (beaconSent) return;
    }

    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${publicAnonKey}`,
      },
      body,
      keepalive: true,
    });
  } catch {
    // Never break UX for tracking failures.
  }
}

