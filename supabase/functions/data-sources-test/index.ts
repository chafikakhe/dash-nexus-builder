import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { failBody, fetchExternalRows, type TestConnectionInput } from "../_shared/data-sources.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, failBody("METHOD_NOT_ALLOWED", "Use POST."));

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  if (!supabaseUrl || !anonKey) {
    return json(500, failBody("ENV_MISSING", "Missing Supabase environment variables."));
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json(401, failBody("UNAUTHENTICATED", "Missing authorization header."));
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return json(401, failBody("UNAUTHENTICATED", "Sign in before testing a data source."));
  }

  let payload: TestConnectionInput;
  try {
    payload = await req.json();
  } catch (_error) {
    return json(400, failBody("INVALID_JSON", "Request body must be valid JSON."));
  }

  try {
    const result = await fetchExternalRows(payload);
    return json(200, {
      success: true,
      preview: result.preview,
      schema: result.schema,
      total: result.total,
    });
  } catch (error) {
    return json(
      400,
      failBody("TEST_FAILED", error instanceof Error ? error.message : "Failed to test connection.")
    );
  }
});
