/**
 * Relay Fallback Cron - Runs every 10 min via pg_cron.
 * Creates seed stores for orgs where Relay was triggered but never returned.
 * verify_jwt = false (called by pg_cron). Optional: set RELAY_CRON_SECRET env and pass X-Cron-Secret header.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RELAY_CRON_SECRET = Deno.env.get("RELAY_CRON_SECRET");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const SEED_UNITS = [
  { name: "Downtown Store", code: "DT01", city: "Atlanta", state: "GA" },
  { name: "Airport Location", code: "AP02", city: "Atlanta", state: "GA" },
  { name: "Highway Stop", code: "HW03", city: "Marietta", state: "GA" },
  { name: "Campus Store", code: "CP04", city: "Athens", state: "GA" },
  { name: "Mall Kiosk", code: "MK05", city: "Atlanta", state: "GA" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }
  if (RELAY_CRON_SECRET) {
    const secret = req.headers.get("X-Cron-Secret");
    if (secret !== RELAY_CRON_SECRET) {
      console.error("[RelayFallbackCron] Invalid or missing X-Cron-Secret");
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const body = await req.json().catch(() => ({}));
    const minutesAgo = body.minutesAgo ?? 10;
    const cutoff = new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();

    const { data: orgs, error: orgsError } = await supabase
      .from("organizations")
      .select("id, name, scraped_data, created_at")
      .lt("created_at", cutoff);

    if (orgsError || !orgs) {
      return Response.json({ error: "Failed to list organizations" }, { status: 500 });
    }

    const candidates = orgs.filter(
      (o: any) => o.scraped_data?.relay_run_id && !o.scraped_data?.relay_locations_imported_at && !o.scraped_data?.relay_fallback_seed_at
    );

    const results: Array<{ org_id: string; org_name: string; status: string; stores_created?: number }> = [];

    for (const org of candidates) {
      const { count } = await supabase.from("stores").select("id", { count: "exact", head: true }).eq("organization_id", org.id);
      if ((count ?? 0) > 0) continue;

      try {
        const { data: districts } = await supabase.from("districts").select("id").eq("organization_id", org.id).limit(2);
        const districtIds = (districts || []).map((d: any) => d.id);

        const storesToInsert = SEED_UNITS.map((u: any, i: number) => ({
          organization_id: org.id,
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

        const { data: seedPeople } = await supabase.from("users").select("id").eq("organization_id", org.id).eq("is_seed", true).is("store_id", null);
        const storesForAssignment = storeIds.slice(0, 5);
        if (seedPeople && seedPeople.length > 0 && storesForAssignment.length > 0) {
          for (let i = 0; i < seedPeople.length; i++) {
            const storeId = storesForAssignment[i % storesForAssignment.length];
            await supabase.from("users").update({ store_id: storeId }).eq("id", seedPeople[i].id);
          }
        }

        await supabase
          .from("organizations")
          .update({ scraped_data: { ...(org.scraped_data || {}), relay_fallback_seed_at: new Date().toISOString() } })
          .eq("id", org.id);

        results.push({ org_id: org.id, org_name: org.name, status: "seeded", stores_created: 5 });
        console.log(`[RelayFallbackCron] ${org.name}: created 5 seed stores`);
      } catch (err: any) {
        results.push({ org_id: org.id, org_name: org.name, status: "error" });
        console.error(`[RelayFallbackCron] ${org.name} failed:`, err.message);
      }
    }

    return Response.json({
      success: true,
      message: `Checked ${candidates.length} orgs, seeded ${results.filter((r) => r.status === "seeded").length}`,
      results,
    });
  } catch (error: any) {
    console.error("[RelayFallbackCron] Error:", error);
    return Response.json({ error: error.message || "Cron failed" }, { status: 500 });
  }
});
