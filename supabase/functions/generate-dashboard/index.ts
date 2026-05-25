import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Field = { name: string; type?: string };
type Collection = { id: string; name: string; schema?: Field[] };
type AiWidgetType = "stat" | "bar_chart" | "line_chart" | "pie_chart" | "table";
type Aggregation = "count" | "sum" | "avg" | "min" | "max";

type AiWidget = {
  type: AiWidgetType;
  title: string;
  dataSourceId: string;
  metricField?: string | null;
  aggregation?: Aggregation | null;
  xField?: string | null;
  yField?: string | null;
  columns?: string[];
  width: number;
  height: number;
  x: number;
  y: number;
};

type BuilderWidget = {
  id: string;
  type: AiWidgetType;
  title: string;
  w: number;
  h: number;
  config: {
    collection_id: string;
    valueKey?: string | null;
    aggregate?: Aggregation;
    xKey?: string | null;
    yKey?: string | null;
    columns?: string[];
    rows?: Record<string, unknown>[];
  };
};

const allowedTypes = new Set(["stat", "bar_chart", "line_chart", "pie_chart", "table"]);
const allowedAggregations = new Set(["count", "sum", "avg", "min", "max"]);
const dev = Deno.env.get("ENVIRONMENT") === "development";

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fail(status: number, code: string, message: string) {
  if (dev) console.error("[generate-dashboard]", code, message);
  return json(status, { error: { code, message } });
}

function getEnv() {
  return {
    supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
    anonKey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    serviceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    openAiKey: Deno.env.get("OPENAI_API_KEY") ?? "",
  };
}

function missingEnvError(env: ReturnType<typeof getEnv>) {
  if (!env.openAiKey) return "Missing OPENAI_API_KEY";
  if (!env.supabaseUrl) return "Missing SUPABASE_URL";
  if (!env.serviceRoleKey) return "Missing SUPABASE_SERVICE_ROLE_KEY";
  if (!env.anonKey) return "Missing SUPABASE_ANON_KEY";
  return null;
}

function openAiErrorMessage(error: any, fallback: string) {
  const code = error?.error?.code || error?.code;
  const type = error?.error?.type || error?.type;
  const message = error?.error?.message || error?.message || fallback;
  const reason = code || type || "openai_error";
  return `${reason}: ${message}`;
}

async function testOpenAI(openAiKey: string) {
  if (!openAiKey) {
    return fail(500, "OPENAI_API_KEY_MISSING", "Missing OPENAI_API_KEY");
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "Return ok." }],
        max_tokens: 2,
        temperature: 0,
      }),
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      return fail(
        response.status,
        "OPENAI_TEST_FAILED",
        openAiErrorMessage(body, `OpenAI request failed with HTTP ${response.status}`)
      );
    }

    return json(200, {
      ok: true,
      message: "OpenAI API request succeeded",
      model: body?.model ?? "gpt-4o-mini",
    });
  } catch (error) {
    return fail(
      502,
      "OPENAI_NETWORK_ERROR",
      error instanceof Error ? `network error: ${error.message}` : "network error: OpenAI request failed"
    );
  }
}

function normalizeFields(schema: unknown): Field[] {
  if (!Array.isArray(schema)) return [];
  return schema
    .map((field) => {
      if (!field || typeof field !== "object") return null;
      const value = field as Record<string, unknown>;
      const name = typeof value.name === "string" ? value.name.trim() : "";
      if (!name) return null;
      return { name, type: typeof value.type === "string" ? value.type : undefined };
    })
    .filter(Boolean) as Field[];
}

function fieldExists(collection: Collection, field?: string | null) {
  if (!field) return false;
  return (collection.schema ?? []).some((item) => item.name === field);
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}

function parseOpenAIText(data: any) {
  if (typeof data?.output_text === "string") return data.output_text;
  const text = data?.output?.flatMap((item: any) => item?.content ?? [])
    ?.find((content: any) => content?.type === "output_text")?.text;
  if (typeof text === "string") return text;
  const message = data?.choices?.[0]?.message;
  if (typeof message?.refusal === "string") throw new Error(message.refusal);
  if (typeof message?.content === "string") return message.content;
  throw new Error("AI response did not contain JSON text.");
}

function validateAiWidgets(widgets: unknown, collections: Collection[]): AiWidget[] {
  if (!Array.isArray(widgets)) throw new Error("AI returned an invalid widgets array.");
  if (widgets.length === 0) throw new Error("AI did not generate any widgets.");
  if (widgets.length > 12) throw new Error("AI generated too many widgets.");

  const collectionMap = new Map(collections.map((collection) => [collection.id, collection]));

  return widgets.map((raw, index) => {
    if (!raw || typeof raw !== "object") throw new Error(`Widget ${index + 1} is not an object.`);
    const widget = raw as Record<string, unknown>;
    const type = String(widget.type ?? "");
    const title = String(widget.title ?? "").trim();
    const dataSourceId = String(widget.dataSourceId ?? "");
    const collection = collectionMap.get(dataSourceId);
    const aggregation = widget.aggregation == null ? null : String(widget.aggregation);
    const metricField = widget.metricField == null ? null : String(widget.metricField);
    const xField = widget.xField == null ? null : String(widget.xField);
    const yField = widget.yField == null ? null : String(widget.yField);

    if (!allowedTypes.has(type)) throw new Error(`Widget ${index + 1} has unsupported type.`);
    if (!title || title.length > 80) throw new Error(`Widget ${index + 1} has an invalid title.`);
    if (!collection) throw new Error(`Widget ${index + 1} references an unknown collection.`);

    if (type === "stat") {
      const agg = aggregation ?? "count";
      if (!allowedAggregations.has(agg)) throw new Error(`Widget ${index + 1} has an invalid aggregation.`);
      if (agg !== "count" && !fieldExists(collection, metricField)) {
        throw new Error(`Widget ${index + 1} references an unknown metric field.`);
      }
    }

    if (type === "bar_chart" || type === "line_chart" || type === "pie_chart") {
      if (!fieldExists(collection, xField)) throw new Error(`Widget ${index + 1} references an unknown x field.`);
      if (!fieldExists(collection, yField)) throw new Error(`Widget ${index + 1} references an unknown y field.`);
    }

    const safeColumns = Array.isArray(widget.columns)
      ? widget.columns.map(String).filter((column) => fieldExists(collection, column)).slice(0, 8)
      : [];

    if (type === "table" && safeColumns.length === 0) {
      throw new Error(`Widget ${index + 1} table has no valid columns.`);
    }

    return {
      type: type as AiWidgetType,
      title,
      dataSourceId,
      metricField,
      aggregation: (aggregation && allowedAggregations.has(aggregation) ? aggregation : "count") as Aggregation,
      xField,
      yField,
      columns: safeColumns,
      width: clampInt(widget.width, 2, 12, type === "table" ? 8 : 4),
      height: clampInt(widget.height, 2, 8, type === "stat" ? 2 : 4),
      x: clampInt(widget.x, 0, 11, 0),
      y: clampInt(widget.y, 0, 99, index * 4),
    };
  });
}

async function addSampleRows(userClient: any, widgets: BuilderWidget[]) {
  const uniqueCollectionIds = [...new Set(widgets.map((widget) => widget.config.collection_id))];
  const rowsByCollection = new Map<string, Record<string, unknown>[]>();

  await Promise.all(uniqueCollectionIds.map(async (collectionId) => {
    const { data, error } = await userClient
      .from("collection_records")
      .select("data")
      .eq("collection_id", collectionId)
      .limit(15);
    if (error) {
      if (dev) console.warn("[generate-dashboard] sample rows skipped", error.message);
      rowsByCollection.set(collectionId, []);
      return;
    }
    rowsByCollection.set(collectionId, (data ?? []).map((row: any) => row.data ?? {}));
  }));

  return widgets.map((widget) => {
    const rows = rowsByCollection.get(widget.config.collection_id) ?? [];
    return {
      ...widget,
      config: {
        ...widget.config,
        rows,
        columns: widget.config.columns?.length ? widget.config.columns : Object.keys(rows[0] ?? {}),
      },
    };
  });
}

function toBuilderWidgets(widgets: AiWidget[], collections: Collection[]): BuilderWidget[] {
  const collectionMap = new Map(collections.map((collection) => [collection.id, collection]));
  return widgets.map((widget, index) => {
    const collection = collectionMap.get(widget.dataSourceId)!;
    const allColumns = (collection.schema ?? []).map((field) => field.name);

    return {
      id: crypto.randomUUID(),
      type: widget.type,
      title: widget.title,
      w: widget.width,
      h: widget.height,
      config: {
        collection_id: widget.dataSourceId,
        valueKey: widget.type === "stat" ? widget.metricField ?? null : null,
        aggregate: widget.type === "stat" ? widget.aggregation ?? "count" : undefined,
        xKey: widget.type !== "stat" && widget.type !== "table" ? widget.xField ?? null : null,
        yKey: widget.type !== "stat" && widget.type !== "table" ? widget.yField ?? null : null,
        columns: widget.type === "table" ? (widget.columns?.length ? widget.columns : allColumns.slice(0, 5)) : allColumns,
        rows: [],
      },
    };
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail(405, "METHOD_NOT_ALLOWED", "Use POST.");

  const env = getEnv();

  let payload: { orgId?: string; dashboardId?: string; prompt?: string; test?: boolean; testOpenAI?: boolean };
  try {
    payload = await req.json();
  } catch (_error) {
    return fail(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  if (payload.test === true) {
    return json(200, {
      ok: true,
      message: "generate-dashboard function is reachable",
      hasOpenAIKey: Boolean(env.openAiKey),
      hasSupabaseUrl: Boolean(env.supabaseUrl),
      hasServiceRole: Boolean(env.serviceRoleKey),
    });
  }

  if (payload.testOpenAI === true) {
    return testOpenAI(env.openAiKey);
  }

  const envError = missingEnvError(env);
  if (envError) {
    return fail(500, "ENV_MISSING", envError);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return fail(401, "UNAUTHENTICATED", "Missing authorization header.");

  const userClient = createClient(env.supabaseUrl, env.anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return fail(401, "UNAUTHENTICATED", "Sign in before generating a dashboard.");

  const orgId = String(payload.orgId ?? "");
  const dashboardId = String(payload.dashboardId ?? "");
  const prompt = String(payload.prompt ?? "").trim();
  if (!orgId || !dashboardId) return fail(400, "MISSING_INPUT", "orgId and dashboardId are required.");
  if (prompt.length < 10 || prompt.length > 1200) return fail(400, "INVALID_PROMPT", "Prompt must be between 10 and 1200 characters.");

  const { data: membership, error: membershipError } = await userClient
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (membershipError) return fail(500, "MEMBERSHIP_CHECK_FAILED", membershipError.message);
  if (!membership) return fail(403, "UNAUTHORIZED", "You do not have access to this workspace.");
  if (!["owner", "admin", "editor"].includes(membership.role)) {
    return fail(403, "UNAUTHORIZED", "You need editor permissions to generate dashboard widgets.");
  }

  const { data: dashboard, error: dashboardError } = await userClient
    .from("dashboards")
    .select("id, org_id, layout")
    .eq("id", dashboardId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (dashboardError) return fail(500, "DASHBOARD_CHECK_FAILED", dashboardError.message);
  if (!dashboard) return fail(404, "DASHBOARD_NOT_FOUND", "Dashboard was not found or cannot be edited.");

  const { data: collectionRows, error: collectionsError } = await userClient
    .from("collections")
    .select("id, name, schema")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });
  if (collectionsError) return fail(500, "COLLECTIONS_LOAD_FAILED", collectionsError.message);

  const collections: Collection[] = (collectionRows ?? []).map((collection: any) => ({
    id: collection.id,
    name: collection.name,
    schema: normalizeFields(collection.schema),
  }));

  if (!collections.length) return fail(400, "NO_COLLECTIONS", "Create a collection before generating widgets.");

  const { data: fieldRows, error: fieldsError } = await userClient
    .from("collection_fields")
    .select("collection_id, name, type, field_name, field_type")
    .in("collection_id", collections.map((collection) => collection.id));
  if (!fieldsError && Array.isArray(fieldRows) && fieldRows.length > 0) {
    const fieldsByCollection = new Map<string, Field[]>();
    for (const row of fieldRows as any[]) {
      const collectionId = String(row.collection_id ?? "");
      const name = String(row.name ?? row.field_name ?? "").trim();
      if (!collectionId || !name) continue;
      const list = fieldsByCollection.get(collectionId) ?? [];
      list.push({ name, type: typeof row.type === "string" ? row.type : row.field_type });
      fieldsByCollection.set(collectionId, list);
    }
    for (const collection of collections) {
      const fields = fieldsByCollection.get(collection.id);
      if (fields?.length) collection.schema = fields;
    }
  } else if (fieldsError && dev) {
    console.warn("[generate-dashboard] collection_fields unavailable, using collections.schema", fieldsError.message);
  }

  const collectionsWithFields = collections.filter((collection) => collection.schema && collection.schema.length > 0);
  if (!collectionsWithFields.length) return fail(400, "NO_COLLECTION_FIELDS", "Create collection fields before generating widgets.");

  const schemaForAi = collectionsWithFields.map((collection) => ({
    id: collection.id,
    name: collection.name,
    fields: collection.schema?.map((field) => ({ name: field.name, type: field.type ?? "text" })),
  }));

  const outputSchema = {
    type: "object",
    additionalProperties: false,
    required: ["widgets"],
    properties: {
      widgets: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["type", "title", "dataSourceId", "metricField", "aggregation", "xField", "yField", "columns", "width", "height", "x", "y"],
          properties: {
            type: { type: "string", enum: ["stat", "bar_chart", "line_chart", "pie_chart", "table"] },
            title: { type: "string" },
            dataSourceId: { type: "string" },
            metricField: { type: ["string", "null"] },
            aggregation: { type: ["string", "null"], enum: ["count", "sum", "avg", "min", "max", null] },
            xField: { type: ["string", "null"] },
            yField: { type: ["string", "null"] },
            columns: { type: "array", items: { type: "string" } },
            width: { type: "integer", minimum: 2, maximum: 12 },
            height: { type: "integer", minimum: 2, maximum: 8 },
            x: { type: "integer", minimum: 0, maximum: 11 },
            y: { type: "integer", minimum: 0, maximum: 99 },
          },
        },
      },
    },
  };

  const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.openAiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: [
            "You generate dashboard widget JSON only.",
            "Use only the supplied collection ids and field names.",
            "Do not generate SQL, React code, auth changes, RLS changes, workspace changes, markdown, or prose.",
            "Prefer 3 to 6 useful widgets. Use count aggregation when no numeric metric field is suitable.",
          ].join(" "),
        },
        {
          role: "user",
          content: JSON.stringify({ prompt, workspaceSchema: schemaForAi }),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "dashboard_widgets",
          strict: true,
          schema: outputSchema,
        },
      },
    }),
  });

  if (!aiResponse.ok) {
    const details = await aiResponse.json().catch(async () => {
      const text = await aiResponse.text().catch(() => "");
      return { error: { message: text || `OpenAI request failed with HTTP ${aiResponse.status}` } };
    });
    if (dev) console.error("[generate-dashboard] OpenAI error", details);
    return fail(
      aiResponse.status,
      "OPENAI_REQUEST_FAILED",
      openAiErrorMessage(details, "AI generation failed. Please try again.")
    );
  }

  let parsed: { widgets?: unknown };
  try {
    const aiData = await aiResponse.json();
    parsed = JSON.parse(parseOpenAIText(aiData));
  } catch (error) {
    return fail(422, "AI_INVALID_JSON", error instanceof Error ? error.message : "AI returned invalid JSON.");
  }

  let aiWidgets: AiWidget[];
  try {
    aiWidgets = validateAiWidgets(parsed.widgets, collections);
  } catch (error) {
    return fail(422, "AI_VALIDATION_FAILED", error instanceof Error ? error.message : "AI output failed validation.");
  }

  const builderWidgets = await addSampleRows(userClient, toBuilderWidgets(aiWidgets, collections));
  const existingLayout = Array.isArray(dashboard.layout) ? dashboard.layout : [];
  const nextLayout = [...existingLayout, ...builderWidgets];

  const { error: updateError } = await userClient
    .from("dashboards")
    .update({ layout: nextLayout, updated_at: new Date().toISOString() })
    .eq("id", dashboardId)
    .eq("org_id", orgId);
  if (updateError) return fail(500, "DASHBOARD_UPDATE_FAILED", updateError.message);

  const widgetRows = builderWidgets.map((widget, index) => ({
    id: widget.id,
    dashboard_id: dashboardId,
    org_id: orgId,
    type: widget.type,
    title: widget.title,
    config: widget.config,
    width: widget.w,
    height: widget.h,
    x: aiWidgets[index]?.x ?? 0,
    y: aiWidgets[index]?.y ?? index * 4,
    created_by: userData.user.id,
  }));

  const invalidWidget = widgetRows.find((widget) => !allowedTypes.has(widget.type));
  if (invalidWidget) {
    return fail(
      422,
      "INVALID_WIDGET_TYPE",
      `Invalid widget type "${invalidWidget.type}". Expected one of: stat, bar_chart, line_chart, pie_chart, table.`
    );
  }

  const { error: insertError } = await userClient.from("dashboard_widgets").insert(widgetRows);
  if (insertError && insertError.code !== "42P01" && insertError.code !== "PGRST205") {
    return fail(500, "WIDGET_INSERT_FAILED", insertError.message);
  }

  if (dev) console.log("[generate-dashboard] generated widgets", builderWidgets.length);
  return json(200, { widgets: builderWidgets, dashboardId, insertedWidgetRows: !insertError });
});
