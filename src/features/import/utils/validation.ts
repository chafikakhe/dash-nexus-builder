/**
 * Import Validation Utilities
 * Validates parsed data and import configuration
 */

import type { ParsedFileData, ImportError, ImportValidationResult } from "../types";
import type { Field } from "@/hooks/useCollections";
import { validateValue } from "./fieldDetection";

/**
 * Validate row against field schema
 */
export function validateRow(
  rowIndex: number,
  row: Record<string, any>,
  fieldSchema: Record<string, any>
): { valid: boolean; errors: ImportError[] } {
  const errors: ImportError[] = [];

  for (const [fieldName, fieldConfig] of Object.entries(fieldSchema)) {
    const value = row[fieldName];
    const type = (fieldConfig as any)?.type || "text";

    // Check required
    if ((fieldConfig as any)?.required && (value === null || value === undefined || value === "")) {
      errors.push({
        rowIndex,
        rowData: row,
        fieldName,
        errorMessage: `Field "${fieldName}" is required`,
      });
      continue;
    }

    // Validate type
    if (value !== null && value !== undefined && value !== "") {
      const validation = validateValue(value, type);
      if (!validation.valid) {
        errors.push({
          rowIndex,
          rowData: row,
          fieldName,
          errorMessage: validation.error || `Invalid value for field "${fieldName}"`,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate entire parsed file
 */
export function validateParsedFile(
  data: ParsedFileData,
  fieldSchema?: Record<string, any>,
  options?: { maxErrors?: number; stopOnFirstError?: boolean }
): ImportValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let rowsWithErrors = 0;

  const maxErrors = options?.maxErrors || 100;
  const stopOnFirstError = options?.stopOnFirstError || false;

  // Check headers
  if (!data.headers || data.headers.length === 0) {
    errors.push("No headers found in file");
    return { isValid: false, errors, warnings, rowsToImport: 0, rowsWithErrors: 0 };
  }

  // Validate rows
  for (let i = 0; i < data.rows.length; i++) {
    const row = data.rows[i];

    // Check if row is empty
    if (!row || Object.keys(row).length === 0) {
      warnings.push(`Row ${i + 1} is empty`);
      continue;
    }

    // Validate against schema if provided
    if (fieldSchema) {
      const validation = validateRow(i, row, fieldSchema);
      if (!validation.valid) {
        rowsWithErrors++;
        for (const error of validation.errors) {
          errors.push(`Row ${i + 1}: ${error.errorMessage}`);
          if (errors.length >= maxErrors) break;
        }
      }
    }

    if (stopOnFirstError && errors.length > 0) {
      break;
    }

    if (errors.length >= maxErrors) {
      warnings.push(`Validation stopped after ${maxErrors} errors`);
      break;
    }
  }

  // Generate warnings for empty columns
  for (const header of data.headers) {
    const values = data.rows.map((r) => r[header]);
    if (values.every((v) => !v || v === "" || v === null || v === undefined)) {
      warnings.push(`Column "${header}" appears to be empty`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    rowsToImport: data.rows.length - rowsWithErrors,
    rowsWithErrors,
  };
}

/**
 * Sanitize row data before import
 */
export function sanitizeRowData(
  row: Record<string, any>,
  headers: string[]
): Record<string, any> {
  const sanitized: Record<string, any> = {};

  for (const header of headers) {
    let value = row[header];

    // Skip null/undefined
    if (value === null || value === undefined) {
      continue;
    }

    // Trim strings
    if (typeof value === "string") {
      value = value.trim();
      if (value === "") {
        continue;
      }
    }

    sanitized[header] = value;
  }

  return sanitized;
}

/**
 * Detect required fields based on data patterns
 */
export function detectRequiredFields(
  rows: Record<string, any>[],
  headers: string[],
  threshold: number = 0.95
): Set<string> {
  const required = new Set<string>();

  for (const header of headers) {
    let nonEmptyCount = 0;

    for (const row of rows) {
      const value = row[header];
      if (value !== null && value !== undefined && value !== "") {
        nonEmptyCount++;
      }
    }

    const fillRate = rows.length > 0 ? nonEmptyCount / rows.length : 0;

    if (fillRate >= threshold) {
      required.add(header);
    }
  }

  return required;
}

/**
 * Check for duplicate rows
 */
export function findDuplicateRows(
  rows: Record<string, any>[],
  keyFields?: string[]
): { duplicates: number; indices: number[][] } {
  const seen = new Map<string, number[]>();
  const duplicates: number[][] = [];
  let duplicateCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Generate key from all fields or specified fields
    const fieldsToUse = keyFields || Object.keys(row);
    const key = fieldsToUse
      .map((field) => String(row[field] ?? ""))
      .join("|");

    if (seen.has(key)) {
      seen.get(key)!.push(i);
      duplicateCount++;
    } else {
      seen.set(key, [i]);
    }
  }

  // Collect duplicate indices
  for (const indices of seen.values()) {
    if (indices.length > 1) {
      duplicates.push(indices);
    }
  }

  return {
    duplicates: duplicateCount,
    indices: duplicates,
  };
}

/**
 * Validate collection fields match import headers
 */
export function validateFieldMapping(
  headers: string[],
  existingFields: Field[]
): { valid: boolean; missingFields: string[]; unmappedHeaders: string[] } {
  const fieldNames = existingFields.map((f) => f.name);
  const missingFields: string[] = [];
  const unmappedHeaders = headers.filter((h) => !fieldNames.includes(h));

  // Check if all headers can be mapped to fields
  for (const header of headers) {
    if (!fieldNames.includes(header)) {
      missingFields.push(header);
    }
  }

  return {
    valid: unmappedHeaders.length === 0,
    missingFields,
    unmappedHeaders,
  };
}

/**
 * Check for file integrity issues
 */
export function checkFileIntegrity(data: ParsedFileData): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (!data.headers || data.headers.length === 0) {
    issues.push("No headers found");
  }

  if (!data.rows || data.rows.length === 0) {
    issues.push("No rows found");
  }

  // Check for inconsistent column counts
  if (data.rows && data.headers) {
    for (let i = 0; i < data.rows.length; i++) {
      const row = data.rows[i];
      const headerCount = data.headers.length;
      const rowCount = Object.keys(row).length;

      if (rowCount > headerCount) {
        issues.push(`Row ${i + 1} has more columns than headers`);
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Estimate import size and provide warnings
 */
export function estimateImportSize(
  rows: Record<string, any>[],
  fieldCount: number
): { estimatedSize: number; warning?: string } {
  // Rough estimation: ~100 bytes per field per row
  const estimatedSize = rows.length * fieldCount * 100;
  const estimatedSizeMB = estimatedSize / 1024 / 1024;

  let warning: string | undefined;
  if (estimatedSizeMB > 5) {
    warning = `Large import detected (~${estimatedSizeMB.toFixed(1)}MB). This may take a few moments.`;
  }

  return { estimatedSize, warning };
}

/**
 * Pre-import validation checklist
 */
export function preImportValidation(
  data: ParsedFileData,
  fieldSchema?: Record<string, any>
): { canProceed: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check file integrity
  const integrityCheck = checkFileIntegrity(data);
  if (!integrityCheck.valid) {
    errors.push(...integrityCheck.issues);
  }

  // Validate data
  const dataValidation = validateParsedFile(data, fieldSchema);
  if (!dataValidation.isValid) {
    errors.push(...dataValidation.errors.slice(0, 10));
  }
  warnings.push(...dataValidation.warnings);

  // Check for duplicates
  const duplicateCheck = findDuplicateRows(data.rows);
  if (duplicateCheck.duplicates > 0) {
    warnings.push(`${duplicateCheck.duplicates} potential duplicate rows found`);
  }

  // Estimate size
  const sizeEstimate = estimateImportSize(data.rows, data.headers.length);
  if (sizeEstimate.warning) {
    warnings.push(sizeEstimate.warning);
  }

  return {
    canProceed: errors.length === 0,
    errors,
    warnings,
  };
}
