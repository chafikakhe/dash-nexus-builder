import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const dev = Deno.env.get("ENVIRONMENT") === "development";

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fail(status: number, code: string, message: string) {
  if (dev) console.error("[create-dashboard]", code, message);
  return json(status, { error: { code, message } });
}

function getEnv() {
  return {
    supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
    anonKey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    serviceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail(405, "METHOD_NOT_ALLOWED", "Use POST.");

  const env = getEnv();
  if (!env.supabaseUrl) return fail(500, "ENV_MISSING", "Missing SUPABASE_URL");
  if (!env.anonKey) return fail(500, "ENV_MISSING", "Missing SUPABASE_ANON_KEY");
  if (!env.serviceRoleKey) return fail(500, "ENV_MISSING", "Missing SUPABASE_SERVICE_ROLE_KEY");

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return fail(401, "UNAUTHENTICATED", "Missing authorization header.");

  const userClient = createClient(env.supabaseUrl, env.anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(env.supabaseUrl, env.serviceRoleKey);

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return fail(401, "UNAUTHENTICATED", "Sign in before creating a dashboard.");
  }

  let payload: { orgId?: string; name?: string; description?: string | null; layout?: unknown };
  try {
    payload = await req.json();
  } catch (_error) {
    return fail(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const orgId = String(payload.orgId ?? "");
  const name = String(payload.name ?? "").trim();
  const description =
    payload.description == null ? null : String(payload.description).trim() || null;
  const layout = Array.isArray(payload.layout) ? payload.layout : [];

  if (!orgId) return fail(400, "MISSING_INPUT", "orgId is required.");
  if (name.length < 1 || name.length > 120) {
    return fail(400, "INVALID_NAME", "Dashboard name must be between 1 and 120 characters.");
  }

  const { data: membership, error: membershipError } = await userClient
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (membershipError) return fail(500, "MEMBERSHIP_CHECK_FAILED", membershipError.message);
  if (!membership) return fail(403, "UNAUTHORIZED", "You do not have access to this workspace.");
  if (!["owner", "admin"].includes(membership.role)) {
    return fail(403, "UNAUTHORIZED", "Only workspace owners or admins can create dashboards.");
  }

  const { data: dashboard, error: insertError } = await adminClient
    .from("dashboards")
    .insert({
      org_id: orgId,
      name,
      description,
      layout,
      created_by: userData.user.id,
    })
    .select("*")
    .single();

  if (insertError) return fail(500, "DASHBOARD_CREATE_FAILED", insertError.message);

  const baseActivityPayload = {
    workspace_id: orgId,
    org_id: orgId,
    user_id: userData.user.id,
    user_name:
      (typeof userData.user.user_metadata?.display_name === "string" && userData.user.user_metadata.display_name.trim())
        ? userData.user.user_metadata.display_name.trim()
        : userData.user.email ?? "Unknown",
    actor_name:
      (typeof userData.user.user_metadata?.display_name === "string" && userData.user.user_metadata.display_name.trim())
        ? userData.user.user_metadata.display_name.trim()
        : userData.user.email ?? "Unknown",
    action: "dashboard_created",
    target_type: "dashboard",
    resource_type: "dashboard",
    target_name: dashboard.name,
    resource_name: dashboard.name,
    metadata: {
      dashboard_id: dashboard.id,
      description: dashboard.description,
      source: "edge_function",
    },
  };

  const modernActivityInsert = await userClient.from("activity_log").insert(baseActivityPayload);
  if (modernActivityInsert.error) {
    const legacyActivityInsert = await userClient.from("activity_log").insert({
      org_id: orgId,
      user_id: userData.user.id,
      actor_name: baseActivityPayload.actor_name,
      action: "dashboard_created",
      resource_type: "dashboard",
      resource_name: dashboard.name,
      metadata: baseActivityPayload.metadata,
    });

    if (legacyActivityInsert.error && dev) {
      console.error("[create-dashboard] activity log failed", {
        modern: modernActivityInsert.error,
        legacy: legacyActivityInsert.error,
      });
    }
  }

  return json(200, {
    dashboard,
  });
});
