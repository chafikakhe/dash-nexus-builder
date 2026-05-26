import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Field } from "@/hooks/useCollections";

export type DataSourceProvider = "custom_api" | "odoo" | "mockapi" | "jsonplaceholder";
export type DataSourceAuthType = "none" | "bearer" | "api_key";

export type DataSourcePayload = {
  name: string;
  provider: DataSourceProvider;
  url: string;
  method: string;
  authType: DataSourceAuthType;
  token?: string;
  headers?: Record<string, string>;
};

export type DataSourceTestResult = {
  success: true;
  preview: Record<string, unknown>[];
  schema: Field[];
  total: number;
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

  return "Request failed.";
}

function toFunctionBody(input: DataSourcePayload) {
  return {
    name: input.name,
    provider: input.provider,
    url: input.url,
    method: input.method || "GET",
    authType: input.authType,
    token: input.token?.trim() || undefined,
    headers: input.headers ?? {},
  };
}

export async function testDataSourceConnection(input: DataSourcePayload): Promise<DataSourceTestResult> {
  const { data, error } = await supabase.functions.invoke("data-sources-test", {
    body: toFunctionBody(input),
  });

  if (error) {
    throw new Error(await toFunctionErrorMessage(error));
  }

  if (!data?.success) {
    throw new Error("Connection test did not succeed.");
  }

  return data as DataSourceTestResult;
}

export async function importDataSourceAsCollection(input: DataSourcePayload & { orgId: string }) {
  const { data, error } = await supabase.functions.invoke("data-sources-import", {
    body: {
      ...toFunctionBody(input),
      orgId: input.orgId,
    },
  });

  if (error) {
    throw new Error(await toFunctionErrorMessage(error));
  }

  if (!data?.success || !data?.collection?.id) {
    throw new Error("Import did not return a collection.");
  }

  return data as {
    success: true;
    total: number;
    collection: { id: string; name: string };
  };
}
