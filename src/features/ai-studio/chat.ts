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

type FunctionErrorBody = {
  error?: {
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
    return body?.error?.message || `Edge Function returned HTTP ${error.context.status}.`;
  }

  if (error instanceof FunctionsRelayError) {
    return `Supabase Functions relay error: ${error.message}`;
  }

  if (error instanceof FunctionsFetchError) {
    return `Could not reach Supabase Edge Function: ${error.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Failed to contact AI Studio.";
}

export async function sendAIStudioMessage(input: {
  message: string;
  history: AIStudioMessage[];
}): Promise<string> {
  const { data, error } = await supabase.functions.invoke("ai-studio-chat", {
    body: input,
  });

  if (error) {
    throw new Error(await toFunctionErrorMessage(error));
  }

  const reply = data?.reply;
  if (typeof reply !== "string" || !reply.trim()) {
    throw new Error("AI Studio returned an empty response.");
  }

  return reply.trim();
}
