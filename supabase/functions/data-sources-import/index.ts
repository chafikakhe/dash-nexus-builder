import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { failBody, fetchExternalRows, type TestConnectionInput } from "../_shared/data-sources.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ImportInput = TestConnectionInput & {
  orgId?: string;
  name?: string;
  provider?: string;
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeProvider(provider: string | undefined) {
  const value = String(provider ?? "custom_api").trim().toLowerCase();
  if (value === "custom api") return "custom_api";
  if (value === "jsonplaceholder") return "jsonplaceholder";
  if (value === "mockapi") return "mockapi";
  if (value === "odoo") return "odoo";
  return "custom_api";
}

async function insertRecordsInChunks(
  adminClient: ReturnType<typeof createClient>,
  rows: Record<string, unknown>[],
  collectionId: string,
  orgId: string
) {
  const chunkSize = 200;
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize).map((row) => ({
      collection_id: collectionId,
      org_id: orgId,
      data: row,
    }));

    const { error } = await adminClient.from("collection_records").insert(chunk);
    if (error) {
      throw new Error(error.message);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, failBody("METHOD_NOT_ALLOWED", "Use POST."));

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json(500, failBody("ENV_MISSING", "Missing Supabase environment variables."));
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json(401, failBody("UNAUTHENTICATED", "Missing authorization header."));
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return json(401, failBody("UNAUTHENTICATED", "Sign in before importing a data source."));
  }

  let payload: ImportInput;
  try {
    payload = await req.json();
  } catch (_error) {
    return json(400, failBody("INVALID_JSON", "Request body must be valid JSON."));
  }

  const orgId = String(payload.orgId ?? "").trim();
  const name = String(payload.name ?? "").trim();

  if (!orgId) return json(400, failBody("MISSING_INPUT", "orgId is required."));
  if (!name) return json(400, failBody("MISSING_INPUT", "Connection name is required."));

  const { data: membership, error: membershipError } = await userClient
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (membershipError) {
    return json(500, failBody("MEMBERSHIP_CHECK_FAILED", membershipError.message));
  }

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return json(403, failBody("UNAUTHORIZED", "Only workspace owners or admins can import data sources."));
  }

  try {
    const result = await fetchExternalRows(payload);
    const provider = normalizeProvider(payload.provider);
    const method = String(payload.method ?? "GET").toUpperCase();
    const authType = String(payload.authType ?? "none").toLowerCase().replace(/\s+/g, "_");
    const sanitizedHeaders = payload.headers ?? {};

    const { data: connection, error: connectionError } = await adminClient
      .from("api_connections")
      .insert({
        org_id: orgId,
        workspace_id: orgId,
        name,
        provider,
        base_url: payload.url,
        method,
        auth_type: authType,
        token_encrypted: payload.token?.trim() ? payload.token.trim() : null,
        headers_json: sanitizedHeaders,
      })
      .select("*")
      .single();

    if (connectionError || !connection) {
      throw new Error(connectionError?.message || "Failed to save API connection.");
    }

    const { data: collection, error: collectionError } = await adminClient
      .from("collections")
      .insert({
        org_id: orgId,
        workspace_id: orgId,
        connection_id: connection.id,
        name,
        schema: result.schema,
        schema_json: result.schema,
        data_json: result.rows,
        source_type: "api",
      })
      .select("*")
      .single();

    if (collectionError || !collection) {
      throw new Error(collectionError?.message || "Failed to create collection.");
    }

    await insertRecordsInChunks(adminClient, result.rows, collection.id, orgId);

    return json(200, {
      success: true,
      connection: {
        id: connection.id,
        name: connection.name,
        provider: connection.provider,
        base_url: connection.base_url,
        method: connection.method,
        auth_type: connection.auth_type,
        headers_json: connection.headers_json,
        created_at: connection.created_at,
      },
      collection,
      total: result.total,
    });
  } catch (error) {
    return json(
      400,
      failBody("IMPORT_FAILED", error instanceof Error ? error.message : "Failed to import data source.")
    );
  }
});
