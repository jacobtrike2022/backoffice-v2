/**
 * Relay.app Location Scraper Webhook
 *
 * Accepts POST from Relay when location scraping completes.
 * No JWT required (verify_jwt: false) — Relay can't send Supabase auth.
 *
 * Callback URL: https://<project-id>.supabase.co/functions/v1/relay-location-callback
 *
 * Configure Relay playbook to add an HTTP step at the end that POSTs:
 * - URL: ^ above
 * - Body: { org_id, company_name?, company_domain?, stores: [...] }
 * - Optional: set RELAY_WEBHOOK_SECRET and add header X-Relay-Secret for verification
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RELAY_WEBHOOK_SECRET = Deno.env.get("RELAY_WEBHOOK_SECRET");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-relay-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function decodeHtmlEntities(str: string): string {
  if (!str || typeof str !== "string") return str;
  return str
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function jsonResponse(data: object, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (RELAY_WEBHOOK_SECRET) {
    const secret = req.headers.get("X-Relay-Secret");
    if (secret !== RELAY_WEBHOOK_SECRET) {
      console.error("[Relay] Callback: invalid or missing X-Relay-Secret");
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
  }

  try {
    const body = await req.json().catch(() => ({}));
    // Relay returns "locations"; we also accept "stores" for compatibility
    const { org_id, company_name, company_domain, store_count, total_scraped, totalLocationCount, stores, locations } = body;
    const storeList = Array.isArray(stores) ? stores : (Array.isArray(locations) ? locations : []);
    const toNum = (v: unknown) => (typeof v === "number" && !isNaN(v) ? v : (typeof v === "string" ? parseInt(v, 10) : NaN));
    const scrapedTotal =
      (() => {
        const n = toNum(total_scraped) || toNum(totalLocationCount);
        if (!isNaN(n) && n > 0) return n;
        const sc = toNum(store_count);
        return !isNaN(sc) && sc > storeList.length ? sc : null;
      })();

    console.log("[Relay] Callback received:", {
      org_id,
      company_domain: company_domain?.slice?.(0, 50),
      storesCount: storeList.length,
      scrapedTotal: scrapedTotal ?? "(not provided)",
      hasLocations: !!locations,
      hasStores: !!stores,
    });

    let orgId = org_id;
    if (!orgId && company_domain) {
      const { data: org } = await supabase
        .from("organizations")
        .select("id")
        .ilike("website", `%${company_domain}%`)
        .limit(1)
        .maybeSingle();
      orgId = org?.id;
    }

    if (!orgId) {
      console.error("[Relay] Callback: missing org_id and could not resolve from company_domain");
      return jsonResponse({ error: "org_id or company_domain required" }, 400);
    }

    const hasLocations = storeList.length > 0;

    if (!hasLocations) {
      // No locations from Relay. If we have no stores (DemoCreate skipped them), create seed fallback so demo isn't broken.
      const { data: existingStores } = await supabase.from("stores").select("id").eq("organization_id", orgId);
      if (!existingStores || existingStores.length === 0) {
        console.log(`[Relay] Callback: no locations for org ${orgId} — creating seed fallback (5 stores)`);
        // Create seed stores as fallback (same as seedDemoOrgData)
        const { data: districts } = await supabase.from("districts").select("id").eq("organization_id", orgId).limit(2);
        const districtIds = districts?.map((d: any) => d.id) || [];
        const SEED_UNITS = [
          { name: "Downtown Store", code: "DT01", city: "Atlanta", state: "GA" },
          { name: "Airport Location", code: "AP02", city: "Atlanta", state: "GA" },
          { name: "Highway Stop", code: "HW03", city: "Marietta", state: "GA" },
          { name: "Campus Store", code: "CP04", city: "Athens", state: "GA" },
          { name: "Mall Kiosk", code: "MK05", city: "Atlanta", state: "GA" },
        ];
        const storesToInsert = SEED_UNITS.map((u, i) => ({
          organization_id: orgId,
          district_id: districtIds[i % 2] || null,
          name: u.name,
          code: u.code,
          city: u.city,
          state: u.state,
          is_active: true,
          is_seed: true,
        }));
        const { data: inserted } = await supabase.from("stores").insert(storesToInsert).select("id");
        const storeIds = (inserted || []).map((s: any) => s.id);
        const { data: seedPeople } = await supabase.from("users").select("id").eq("organization_id", orgId).eq("is_seed", true).is("store_id", null);
        if (seedPeople && seedPeople.length > 0 && storeIds.length > 0) {
          for (let i = 0; i < seedPeople.length; i++) {
            const storeId = storeIds[i % storeIds.length];
            await supabase.from("users").update({ store_id: storeId }).eq("id", seedPeople[i].id);
          }
        }
        return jsonResponse({ success: true, action: "no_locations_seed_fallback", org_id: orgId, stores_created: 5 });
      }
      console.log(`[Relay] Callback: no locations for org ${orgId} — keeping existing seed stores`);
      return jsonResponse({ success: true, action: "no_locations_kept_seed", org_id: orgId });
    }

    const mapStore = (s: any, index: number) => {
      const addr = s.address || s.street_address || [s.street, s.city, s.state, s.zip].filter(Boolean).join(", ") || null;
      const zip = s.zip || s.postal_code || null;
      const lat = s.latitude ?? s.lat ?? null;
      const lng = s.longitude ?? s.lng ?? null;
      const storeName = s.name ? decodeHtmlEntities(String(s.name)) : `Location ${index + 1}`;
      return {
        organization_id: orgId,
        name: storeName,
        code: s.code || `S${(index + 1).toString().padStart(2, "0")}`,
        address: addr,
        city: s.city || null,
        state: s.state || null,
        zip,
        phone: s.phone || null,
        latitude: typeof lat === "number" ? lat : (typeof lat === "string" ? parseFloat(lat) : null),
        longitude: typeof lng === "number" ? lng : (typeof lng === "string" ? parseFloat(lng) : null),
        is_active: true,
        is_seed: false,
      };
    };

    const storesToInsert = storeList.slice(0, 500).map(mapStore); // Support 5–500 stores

    const { data: districts } = await supabase
      .from("districts")
      .select("id")
      .eq("organization_id", orgId)
      .limit(2);

    const districtIds = districts?.map((d: any) => d.id) || [];

    const { data: deletedStores } = await supabase
      .from("stores")
      .select("id")
      .eq("organization_id", orgId)
      .eq("is_seed", true);

    const deletedStoreIds = new Set((deletedStores || []).map((s: any) => s.id));

    await supabase.from("stores").delete().eq("organization_id", orgId).eq("is_seed", true);

    const storesWithDistrict = storesToInsert.map((s, i) => ({
      ...s,
      district_id: districtIds[i % districtIds.length] || null,
    }));

    const { data: insertedStores, error: insertErr } = await supabase
      .from("stores")
      .insert(storesWithDistrict)
      .select("id");

    if (insertErr) {
      console.error("[Relay] Callback: failed to insert stores:", insertErr);
      // Fallback: create seed stores so demo isn't broken
      const { data: existingStores } = await supabase.from("stores").select("id").eq("organization_id", orgId);
      if (!existingStores || existingStores.length === 0) {
        console.log("[Relay] Callback: creating seed fallback after insert error");
        const { data: districts } = await supabase.from("districts").select("id").eq("organization_id", orgId).limit(2);
        const districtIds = districts?.map((d: any) => d.id) || [];
        const SEED_UNITS = [
          { name: "Downtown Store", code: "DT01", city: "Atlanta", state: "GA" },
          { name: "Airport Location", code: "AP02", city: "Atlanta", state: "GA" },
          { name: "Highway Stop", code: "HW03", city: "Marietta", state: "GA" },
          { name: "Campus Store", code: "CP04", city: "Athens", state: "GA" },
          { name: "Mall Kiosk", code: "MK05", city: "Atlanta", state: "GA" },
        ];
        const storesToInsert = SEED_UNITS.map((u, i) => ({
          organization_id: orgId,
          district_id: districtIds[i % 2] || null,
          name: u.name,
          code: u.code,
          city: u.city,
          state: u.state,
          is_active: true,
          is_seed: true,
        }));
        const { data: inserted } = await supabase.from("stores").insert(storesToInsert).select("id");
        const storeIds = (inserted || []).map((s: any) => s.id);
        const { data: seedPeople } = await supabase.from("users").select("id").eq("organization_id", orgId).eq("is_seed", true).is("store_id", null);
        if (seedPeople && seedPeople.length > 0 && storeIds.length > 0) {
          for (let i = 0; i < seedPeople.length; i++) {
            const storeId = storeIds[i % storeIds.length];
            await supabase.from("users").update({ store_id: storeId }).eq("id", seedPeople[i].id);
          }
        }
        return jsonResponse({ success: true, action: "insert_error_seed_fallback", org_id: orgId, stores_created: 5 });
      }
      return jsonResponse({ error: insertErr.message }, 500);
    }

    const newStoreIds = (insertedStores || []).map((s: any) => s.id);
    // Distribute seed people across first N stores (N = min(5, storeCount)) — scales to 5 or 500 stores
    const storesForAssignment = newStoreIds.slice(0, 5);
    let peopleQuery = supabase.from("users").select("id").eq("organization_id", orgId).eq("is_seed", true);
    peopleQuery = deletedStoreIds.size > 0 ? peopleQuery.in("store_id", Array.from(deletedStoreIds)) : peopleQuery.is("store_id", null);
    const { data: seedPeople } = await peopleQuery;
    if (seedPeople && seedPeople.length > 0 && storesForAssignment.length > 0) {
      for (let i = 0; i < seedPeople.length; i++) {
        const storeId = storesForAssignment[i % storesForAssignment.length];
        await supabase.from("users").update({ store_id: storeId }).eq("id", seedPeople[i].id);
      }
      console.log(`[Relay] Callback: assigned ${seedPeople.length} people to first ${storesForAssignment.length} stores`);
    }

    const { data: org } = await supabase
      .from("organizations")
      .select("scraped_data")
      .eq("id", orgId)
      .single();
    const existing = (org as any)?.scraped_data || {};
    const scrapedDataUpdate: Record<string, unknown> = {
      ...existing,
      store_count: newStoreIds.length,
      relay_locations_imported_at: new Date().toISOString(),
    };
    if (scrapedTotal != null) {
      scrapedDataUpdate.relay_locations_total = scrapedTotal;
    }
    await supabase
      .from("organizations")
      .update({ scraped_data: scrapedDataUpdate })
      .eq("id", orgId);

    console.log(`[Relay] Callback: imported ${newStoreIds.length} stores for org ${orgId}`);
    return jsonResponse({
      success: true,
      action: "imported_locations",
      org_id: orgId,
      stores_imported: newStoreIds.length,
    });
  } catch (e: any) {
    console.error("[Relay] Callback error:", e);
    return jsonResponse({ error: e.message || "Callback failed" }, 500);
  }
});
