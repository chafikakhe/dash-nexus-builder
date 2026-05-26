export type DetectedFieldType = "text" | "number" | "boolean" | "date" | "json";

export type TestConnectionInput = {
  url: string;
  method?: string;
  authType?: string;
  token?: string;
  headers?: Record<string, string>;
};

export function failBody(code: string, message: string) {
  return { error: { code, message } };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function looksLikeDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}(?:[tT ][\d:.+-Z]*)?$/.test(value.trim())) return false;
  return !Number.isNaN(Date.parse(value));
}

export function detectFieldType(value: unknown): DetectedFieldType {
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "string") return looksLikeDate(value) ? "date" : "text";
  if (Array.isArray(value) || isPlainObject(value)) return "json";
  return "text";
}

export function detectSchema(rows: Record<string, unknown>[]) {
  const schema = new Map<string, DetectedFieldType>();

  for (const row of rows.slice(0, 20)) {
    for (const [key, value] of Object.entries(row)) {
      if (value == null) continue;
      if (!schema.has(key)) {
        schema.set(key, detectFieldType(value));
      }
    }
  }

  return [...schema.entries()].map(([name, type]) => ({ name, type }));
}

function normalizeHeaders(headers: Record<string, string> | undefined, authType: string, token: string) {
  const nextHeaders = new Headers();

  for (const [key, value] of Object.entries(headers ?? {})) {
    if (typeof value === "string" && value.trim()) {
      nextHeaders.set(key, value);
    }
  }

  if (!nextHeaders.has("Accept")) {
    nextHeaders.set("Accept", "application/json");
  }

  if (authType === "bearer" && token) {
    nextHeaders.set("Authorization", `Bearer ${token}`);
  }

  if (authType === "api_key" && token && !nextHeaders.has("x-api-key")) {
    nextHeaders.set("x-api-key", token);
  }

  return nextHeaders;
}

function normalizeRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter(isPlainObject) as Record<string, unknown>[];
  }

  if (isPlainObject(payload)) {
    const candidates = [
      payload.data,
      payload.results,
      payload.items,
      payload.records,
      payload.rows,
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate.filter(isPlainObject) as Record<string, unknown>[];
      }
    }

    return [payload];
  }

  return [];
}

export async function fetchExternalRows(input: TestConnectionInput) {
  const url = String(input.url ?? "").trim();
  if (!url) {
    throw new Error("API URL is required.");
  }

  const method = String(input.method ?? "GET").toUpperCase();
  const authType = String(input.authType ?? "none").toLowerCase().replace(/\s+/g, "_");
  const token = typeof input.token === "string" ? input.token.trim() : "";

  const response = await fetch(url, {
    method,
    headers: normalizeHeaders(input.headers, authType, token),
  });

  const rawText = await response.text();
  let payload: unknown = null;

  try {
    payload = rawText ? JSON.parse(rawText) : null;
  } catch (_error) {
    if (!response.ok) {
      throw new Error(`External API returned HTTP ${response.status}.`);
    }
    throw new Error("External API did not return valid JSON.");
  }

  if (!response.ok) {
    const message =
      (isPlainObject(payload) && typeof payload.message === "string" && payload.message) ||
      (isPlainObject(payload) && typeof payload.error === "string" && payload.error) ||
      `External API returned HTTP ${response.status}.`;
    throw new Error(message);
  }

  const rows = normalizeRows(payload);
  if (!rows.length) {
    throw new Error("The API response did not contain any JSON objects to import.");
  }

  return {
    rows,
    preview: rows.slice(0, 5),
    schema: detectSchema(rows),
    total: rows.length,
  };
}
