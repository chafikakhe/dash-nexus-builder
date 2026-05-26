import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type GenerateDashboardInput = {
  orgId: string;
  dashboardId: string;
  prompt: string;
};

export type GeneratedDashboardWidget = {
  id: string;
  type: "stat" | "bar_chart" | "line_chart" | "pie_chart" | "table";
  title: string;
  w: number;
  h: number;
  config?: Record<string, unknown>;
};

type FunctionErrorBody = {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
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
  console.error("[generate-dashboard] raw function error", error);

  if (error instanceof FunctionsHttpError) {
    const body = await readFunctionErrorBody(error.context);
    const code = body?.error?.code;
    const message = body?.error?.message || `Edge Function returned HTTP ${error.context.status}.`;
    if (code === "AI_TEMPORARILY_BUSY") return "Temporary AI overload, please try again.";
    if (code === "AI_TIMEOUT") return "AI took too long to respond. Please try again.";
    if (error.context.status >= 500) return "AI is currently unavailable. Please try again shortly.";
    return message;
  }

  if (error instanceof FunctionsRelayError) {
    return "AI service relay error. Please try again.";
  }

  if (error instanceof FunctionsFetchError) {
    return "Could not reach AI generation service. Check your connection and try again.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Failed to generate dashboard.";
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

export async function generateDashboardWithAI({
  orgId,
  dashboardId,
  prompt,
}: GenerateDashboardInput): Promise<GeneratedDashboardWidget[]> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const sessionUserId = sessionData.session?.user.id ?? null;

  console.info("[generate-dashboard] invoking Edge Function", {
    functionName: "generate-dashboard",
    orgId,
    dashboardId,
    promptLength: prompt.length,
    sessionUserId,
    hasSession: Boolean(sessionData.session),
  });

  if (sessionError) {
    console.error("[generate-dashboard] session lookup error", sessionError);
    throw new Error(`Could not read current session: ${sessionError.message}`);
  }

  if (!sessionData.session) {
    throw new Error("You must be signed in before generating a dashboard.");
  }

  const data = await invokeWithTimeout<{
    widgets?: GeneratedDashboardWidget[];
    error?: { message?: string };
  }>("generate-dashboard", { orgId, dashboardId, prompt }, 60_000).catch(async (error: unknown) => {
    throw new Error(await toFunctionErrorMessage(error));
  });

  if (data?.error) {
    throw new Error(data.error.message || "Failed to generate dashboard.");
  }

  if (!Array.isArray(data?.widgets)) {
    throw new Error("The AI response did not include generated widgets.");
  }

  return data.widgets as GeneratedDashboardWidget[];
}
