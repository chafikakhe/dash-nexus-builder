import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type AIStudioMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AIStudioReply = {
  reply: string;
  model?: string;
  usedFallback?: boolean;
};

type FunctionErrorBody = {
  error?: {
    code?: string;
    message?: string;
  };
};

async function readFunctionErrorBody(context: unknown): Promise<FunctionErrorBody | null> {
  if (!(context instanceof Response)) return null;

  try {
    return await context.clone().json();
  } catch (_jsonError) {
    try {
      const text = await context.clone().text();
      return text ? { error: { message: text } } : null;
    } catch (_textError) {
      return null;
    }
  }
}

async function toFunctionErrorMessage(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const body = await readFunctionErrorBody(error.context);
    const code = body?.error?.code;
    const message = body?.error?.message || `Edge Function returned HTTP ${error.context.status}.`;

    if (code === "AI_TEMPORARILY_BUSY") return "Temporary AI overload, please try again.";
    if (code === "AI_TIMEOUT") return "AI took too long to respond. Please try again.";
    if (code === "ENV_MISSING") return "AI Studio is not configured correctly.";
    if (error.context.status >= 500) return "AI is currently unavailable. Please try again shortly.";

    return message;
  }

  if (error instanceof FunctionsRelayError) {
    return "AI service relay error. Please try again.";
  }

  if (error instanceof FunctionsFetchError) {
    return "Could not reach AI Studio. Check your connection and try again.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Failed to contact AI Studio.";
}

async function invokeWithTimeout<T>(name: string, body: unknown, timeoutMs: number): Promise<T> {
  return await Promise.race([
    supabase.functions.invoke(name, { body }).then(({ data, error }) => {
      if (error) throw error;
      return data as T;
    }),
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error("AI request timed out after 60 seconds.")), timeoutMs);
    }),
  ]);
}

export async function sendAIStudioMessage(input: {
  message: string;
  history: AIStudioMessage[];
}): Promise<AIStudioReply> {
  const data = await invokeWithTimeout<{
    reply?: string;
    model?: string;
    usedFallback?: boolean;
  }>("ai-studio-chat", input, 60_000).catch(async (error: unknown) => {
    throw new Error(await toFunctionErrorMessage(error));
  });

  const reply = data?.reply;
  if (typeof reply !== "string" || !reply.trim()) {
    throw new Error("AI Studio returned an empty response.");
  }

  return {
    reply: reply.trim(),
    model: data?.model,
    usedFallback: Boolean(data?.usedFallback),
  };
}
