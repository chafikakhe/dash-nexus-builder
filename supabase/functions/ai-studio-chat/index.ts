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

type GeminiFailure = {
  status: number;
  code: string;
  message: string;
  retryable: boolean;
};

const dev = Deno.env.get("ENVIRONMENT") === "development";
const retryDelaysMs = [1000, 2000, 4000];

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
  const configuredModel =
    Deno.env.get("GOOGLE_AI_MODEL") ??
    Deno.env.get("GEMINI_MODEL") ??
    "gemini-2.5-pro";

  return {
    supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
    anonKey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    googleAiKey: Deno.env.get("GOOGLE_AI_STUDIO_API_KEY") ?? Deno.env.get("GEMINI_API_KEY") ?? "",
    googleAiModel: configuredModel,
    googleAiModels: Array.from(new Set([configuredModel, "gemini-2.5-pro", "gemini-1.5-pro", "gemini-1.5-flash"])),
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toGeminiFailure(status: number, body: any, fallbackMessage: string): GeminiFailure {
  const message = body?.error?.message || body?.error?.status || fallbackMessage;

  return {
    status,
    code: "GOOGLE_AI_REQUEST_FAILED",
    message,
    retryable: [408, 429, 499, 500, 502, 503, 504].includes(status),
  };
}

async function requestGeminiReply(input: {
  apiKey: string;
  models: string[];
  history: ChatMessage[];
  message: string;
}) {
  let lastFailure: GeminiFailure | null = null;

  for (let modelIndex = 0; modelIndex < input.models.length; modelIndex += 1) {
    const model = input.models[modelIndex];

    for (let attempt = 0; attempt < retryDelaysMs.length; attempt += 1) {
      console.log("[ai-studio-chat] selected model", model);
      console.log("[ai-studio-chat] retry count", attempt);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000);

      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(input.apiKey)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
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
              contents: toGeminiContents(input.history, input.message),
              generationConfig: {
                temperature: 0.5,
                topP: 0.9,
                maxOutputTokens: 700,
              },
            }),
          }
        );

        clearTimeout(timeout);
        const responseBody = await response.json().catch(() => null);

        if (!response.ok) {
          const failure = toGeminiFailure(
            response.status,
            responseBody,
            `Google AI Studio request failed with HTTP ${response.status}`
          );
          console.error("[ai-studio-chat] exact Gemini error", failure, responseBody);
          lastFailure = failure;
          if (failure.retryable && attempt < retryDelaysMs.length - 1) {
            await sleep(retryDelaysMs[attempt]);
            continue;
          }
          break;
        }

        const reply = parseGeminiReply(responseBody);
        if (!reply) {
          lastFailure = {
            status: 422,
            code: "EMPTY_RESPONSE",
            message: "Google AI Studio returned an empty response.",
            retryable: false,
          };
          break;
        }

        return {
          reply,
          model,
          usedFallback: modelIndex > 0,
        };
      } catch (error) {
        clearTimeout(timeout);
        console.error("[ai-studio-chat] exact Gemini error", error);
        const isTimeout = error instanceof DOMException && error.name === "AbortError";
        lastFailure = {
          status: isTimeout ? 504 : 502,
          code: isTimeout ? "AI_TIMEOUT" : "GOOGLE_AI_NETWORK_ERROR",
          message: isTimeout
            ? "AI request timed out after 60 seconds."
            : error instanceof Error
              ? error.message
              : "Google AI request failed",
          retryable: true,
        };
        if (attempt < retryDelaysMs.length - 1) {
          await sleep(retryDelaysMs[attempt]);
          continue;
        }
        break;
      }
    }
  }

  throw lastFailure ?? {
    status: 503,
    code: "AI_TEMPORARILY_BUSY",
    message: "Temporary AI overload, please try again.",
    retryable: true,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail(405, "METHOD_NOT_ALLOWED", "Use POST.");

  const env = getEnv();
  if (!env.supabaseUrl) return fail(500, "ENV_MISSING", "Missing SUPABASE_URL");
  if (!env.anonKey) return fail(500, "ENV_MISSING", "Missing SUPABASE_ANON_KEY");
  if (!env.googleAiKey) return fail(500, "ENV_MISSING", "Missing GOOGLE_AI_STUDIO_API_KEY or GEMINI_API_KEY");

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

  try {
    const result = await requestGeminiReply({
      apiKey: env.googleAiKey,
      models: env.googleAiModels,
      history,
      message,
    });

    return json(200, {
      reply: result.reply,
      model: result.model,
      usedFallback: result.usedFallback,
      userId: userData.user.id,
    });
  } catch (error) {
    const failure = error as GeminiFailure;
    if (failure.code === "AI_TIMEOUT") {
      return fail(504, "AI_TIMEOUT", "AI took too long to respond. Please try again.");
    }
    return fail(503, "AI_TEMPORARILY_BUSY", "Temporary AI overload, please try again.");
  }
});
