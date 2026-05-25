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

  return "Failed to generate dashboard.";
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

  const { data, error } = await supabase.functions.invoke("generate-dashboard", {
    body: { orgId, dashboardId, prompt },
  });

  if (error) {
    throw new Error(await toFunctionErrorMessage(error));
  }

  if (data?.error) {
    throw new Error(data.error.message || "Failed to generate dashboard.");
  }

  if (!Array.isArray(data?.widgets)) {
    throw new Error("The AI response did not include generated widgets.");
  }

  return data.widgets as GeneratedDashboardWidget[];
}
