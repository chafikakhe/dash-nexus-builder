/**
 * Field Type Detection Utility
 * Automatically detects field types from values using heuristics
 */

import type { FieldType } from "@/hooks/useCollections";
import type { FieldDetectionResult } from "../types";

/**
 * Patterns for field type detection
 */
const PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  url: /^(https?:\/\/|www\.)[^\s]+$/,
  phone: /^[\d\s\-\+\(\)]{7,}$/,
  date: /^(\d{4}[-/]\d{2}[-/]\d{2}|(\d{1,2}[-/]){2}\d{2,4}|[A-Za-z]+\s+\d{1,2},?\s+\d{4})$/,
  boolean: /^(true|false|yes|no|1|0)$/i,
  number: /^-?\d+(\.\d+)?$|^-?\.\d+$/,
};

/**
 * Detect if a string is a valid email
 */
export function isEmail(value: string): boolean {
  if (!value || typeof value !== "string") return false;
  return PATTERNS.email.test(value.trim());
}

/**
 * Detect if a string is a valid URL
 */
export function isUrl(value: string): boolean {
  if (!value || typeof value !== "string") return false;
  try {
    new URL(value.includes("://") ? value : `https://${value}`);
    return PATTERNS.url.test(value);
  } catch {
    return false;
  }
}

/**
 * Detect if a string is a phone number
 */
export function isPhone(value: string): boolean {
  if (!value || typeof value !== "string") return false;
  return PATTERNS.phone.test(value.trim());
}

/**
 * Detect if a string is a date
 */
export function isDate(value: string): boolean {
  if (!value || typeof value !== "string") return false;
  if (!PATTERNS.date.test(value.trim())) return false;
  const parsed = Date.parse(value.trim());
  return !isNaN(parsed);
}

/**
 * Detect if a string is a boolean
 */
export function isBoolean(value: any): boolean {
  if (typeof value === "boolean") return true;
  if (typeof value !== "string") return false;
  return PATTERNS.boolean.test(value.trim());
}

/**
 * Detect if a string is a number
 */
export function isNumber(value: string): boolean {
  if (!value || typeof value !== "string") return false;
  return PATTERNS.number.test(value.trim());
}

/**
 * Detect field type from a single value
 */
export function detectFieldTypeFromValue(value: any): FieldType {
  if (value === null || value === undefined || value === "") {
    return "text";
  }

  if (typeof value === "boolean") {
    return "boolean";
  }

  if (typeof value === "number") {
    return "number";
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (isBoolean(trimmed)) {
      return "boolean";
    }

    if (isNumber(trimmed)) {
      return "number";
    }

    if (isEmail(trimmed)) {
      return "text"; // Could be "email" if we add that type
    }

    if (isUrl(trimmed)) {
      return "text"; // Could be "url" if we add that type
    }

    if (isPhone(trimmed)) {
      return "text"; // Could be "phone" if we add that type
    }

    if (isDate(trimmed)) {
      return "date";
    }
  }

  return "text";
}

/**
 * Detect field type from multiple values (more accurate)
 */
export function detectFieldType(values: any[]): FieldType {
  if (!values || values.length === 0) {
    return "text";
  }

  // Filter out empty/null values
  const nonEmpty = values.filter((v) => v !== null && v !== undefined && v !== "");

  if (nonEmpty.length === 0) {
    return "text";
  }

  // Count type detections
  const typeCount: Record<string, number> = {};

  for (const value of nonEmpty) {
    const type = detectFieldTypeFromValue(value);
    typeCount[type] = (typeCount[type] || 0) + 1;
  }

  // If majority are numbers
  if ((typeCount["number"] || 0) / nonEmpty.length > 0.7) {
    return "number";
  }

  // If majority are booleans
  if ((typeCount["boolean"] || 0) / nonEmpty.length > 0.7) {
    return "boolean";
  }

  // If majority are dates
  if ((typeCount["date"] || 0) / nonEmpty.length > 0.7) {
    return "date";
  }

  // Default to text
  return "text";
}

/**
 * Get detection confidence (0-1)
 */
export function getDetectionConfidence(type: FieldType, values: any[]): number {
  if (!values || values.length === 0) {
    return 0;
  }

  const nonEmpty = values.filter((v) => v !== null && v !== undefined && v !== "");

  if (nonEmpty.length === 0) {
    return 0.5; // Low confidence for empty columns
  }

  let matches = 0;

  for (const value of nonEmpty) {
    const detectedType = detectFieldTypeFromValue(value);
    if (detectedType === type) {
      matches++;
    }
  }

  return matches / nonEmpty.length;
}

/**
 * Generate field slug from name
 */
export function generateFieldSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50);
}

/**
 * Validate field name
 */
export function isValidFieldName(name: string): boolean {
  if (!name || typeof name !== "string") return false;
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > 255) return false;
  // Allow alphanumeric, spaces, underscores, hyphens
  return /^[a-z0-9\s_\-]+$/i.test(trimmed);
}

/**
 * Sanitize field name
 */
export function sanitizeFieldName(name: string): string {
  if (!name) return "field";
  return name
    .trim()
    .replace(/[^a-z0-9\s_-]/gi, "")
    .replace(/\s+/g, "_")
    .substring(0, 100) || "field";
}

/**
 * Detect fields from CSV/Excel headers and sample data
 */
export function detectFields(
  headers: string[],
  sampleRows: Record<string, any>[]
): FieldDetectionResult[] {
  const results: FieldDetectionResult[] = [];

  for (const header of headers) {
    if (!header || typeof header !== "string") continue;

    const sanitized = sanitizeFieldName(header);
    const slug = generateFieldSlug(header);

    // Collect values for this column
    const columnValues = sampleRows.map((row) => row[header]);

    // Detect type and confidence
    const type = detectFieldType(columnValues);
    const confidence = getDetectionConfidence(type, columnValues);

    results.push({
      name: header,
      slug,
      type,
      required: false,
      config: {},
      detectionConfidence: confidence,
    });
  }

  return results;
}

/**
 * Normalize value according to detected type
 */
export function normalizeValue(value: any, type: FieldType): any {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    value = value.trim();
    if (value === "") {
      return null;
    }
  }

  switch (type) {
    case "number":
      if (isNumber(String(value))) {
        return parseFloat(String(value));
      }
      return null;

    case "boolean":
      if (typeof value === "boolean") return value;
      const boolStr = String(value).toLowerCase();
      return ["true", "yes", "1", "on"].includes(boolStr);

    case "date":
      if (isDate(String(value))) {
        return new Date(value).toISOString();
      }
      return null;

    case "text":
    default:
      return String(value);
  }
}

/**
 * Validate value against field type
 */
export function validateValue(value: any, type: FieldType): { valid: boolean; error?: string } {
  if (value === null || value === undefined) {
    return { valid: true };
  }

  switch (type) {
    case "number":
      if (!isNumber(String(value))) {
        return { valid: false, error: `Expected number, got "${value}"` };
      }
      break;

    case "boolean":
      if (!isBoolean(value)) {
        return { valid: false, error: `Expected boolean, got "${value}"` };
      }
      break;

    case "date":
      if (!isDate(String(value))) {
        return { valid: false, error: `Expected date, got "${value}"` };
      }
      break;

    case "text":
    default:
      if (typeof value !== "string") {
        return { valid: false, error: `Expected text, got "${typeof value}"` };
      }
      break;
  }

  return { valid: true };
}
