import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const dev = Deno.env.get("ENVIRONMENT") === "development";

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fail(status: number, code: string, message: string) {
  if (dev) console.error("[ai-studio-chat]", code, message);
  return json(status, { error: { code, message } });
}

function getEnv() {
  return {
    supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
    anonKey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    googleAiKey: Deno.env.get("GOOGLE_AI_STUDIO_API_KEY") ?? "",
    googleAiModel: Deno.env.get("GOOGLE_AI_MODEL") ?? "gemini-2.5-flash",
  };
}

function sanitizeHistory(history: unknown): ChatMessage[] {
  if (!Array.isArray(history)) return [];

  return history
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const value = entry as Record<string, unknown>;
      const role = value.role === "assistant" ? "assistant" : value.role === "user" ? "user" : null;
      const content = typeof value.content === "string" ? value.content.trim() : "";
      if (!role || !content) return null;
      return { role, content: content.slice(0, 4000) };
    })
    .filter(Boolean)
    .slice(-10) as ChatMessage[];
}

function toGeminiContents(history: ChatMessage[], message: string) {
  const prior = history.map((entry) => ({
    role: entry.role === "assistant" ? "model" : "user",
    parts: [{ text: entry.content }],
  }));

  return [...prior, { role: "user", parts: [{ text: message }] }];
}

function parseGeminiReply(data: any) {
  const candidate = data?.candidates?.[0];
  const parts = candidate?.content?.parts;
  if (!Array.isArray(parts)) return "";

  return parts
    .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
    .join("")
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail(405, "METHOD_NOT_ALLOWED", "Use POST.");

  const env = getEnv();
  if (!env.supabaseUrl) return fail(500, "ENV_MISSING", "Missing SUPABASE_URL");
  if (!env.anonKey) return fail(500, "ENV_MISSING", "Missing SUPABASE_ANON_KEY");
  if (!env.googleAiKey) return fail(500, "ENV_MISSING", "Missing GOOGLE_AI_STUDIO_API_KEY");

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return fail(401, "UNAUTHENTICATED", "Missing authorization header.");

  const userClient = createClient(env.supabaseUrl, env.anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return fail(401, "UNAUTHENTICATED", "Sign in before using AI Studio.");
  }

  let payload: { message?: string; history?: unknown };
  try {
    payload = await req.json();
  } catch (_error) {
    return fail(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const message = String(payload.message ?? "").trim();
  if (message.length < 3 || message.length > 4000) {
    return fail(400, "INVALID_MESSAGE", "Message must be between 3 and 4000 characters.");
  }

  const history = sanitizeHistory(payload.history);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.googleAiModel)}:generateContent?key=${encodeURIComponent(env.googleAiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: [
                "You are Dash Nexus Builder AI Studio.",
                "Help users design dashboards, collections, widgets, formulas, and workspace data flows.",
                "Be concise, practical, and product-focused.",
                "When asked to build something, suggest a concrete dashboard structure or next action.",
                "Do not claim you executed changes or accessed data you do not actually have.",
              ].join(" "),
            },
          ],
        },
        contents: toGeminiContents(history, message),
        generationConfig: {
          temperature: 0.5,
          topP: 0.9,
          maxOutputTokens: 700,
        },
      }),
    }
  );

  const responseBody = await response.json().catch(() => null);
  if (!response.ok) {
    const remoteMessage =
      responseBody?.error?.message ||
      responseBody?.error?.status ||
      `Google AI Studio request failed with HTTP ${response.status}`;
    return fail(response.status, "GOOGLE_AI_REQUEST_FAILED", remoteMessage);
  }

  const reply = parseGeminiReply(responseBody);
  if (!reply) {
    return fail(422, "EMPTY_RESPONSE", "Google AI Studio returned an empty response.");
  }

  return json(200, {
    reply,
    model: env.googleAiModel,
    userId: userData.user.id,
  });
});
