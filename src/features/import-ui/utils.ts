/**
 * File Upload and Parsing Utilities
 * Handles file validation, parsing, and field detection
 */

import * as XLSX from "xlsx";

import {
  IMPORT_CONFIG,
  FIELD_PATTERNS,
  ERROR_CODES,
} from "./types";

import type {
  ParsedFileData,
  FileValidationResult,
  DetectedField,
  FieldType,
  ImportError,
  FieldDetectionResult,
} from "./types";

// ==================== File Validation ====================

export const validateFile = (file: File): FileValidationResult => {
  // Check file size
  if (file.size > IMPORT_CONFIG.MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File is too large. Maximum size is ${formatFileSize(IMPORT_CONFIG.MAX_FILE_SIZE)}`,
    };
  }

  // Check file type
  const fileName = file.name.toLowerCase();
  const hasValidExtension = IMPORT_CONFIG.ALLOWED_FORMATS.some((ext) =>
    fileName.endsWith(ext)
  );

  if (!hasValidExtension) {
    return {
      valid: false,
      error: `Invalid file format. Supported formats: ${IMPORT_CONFIG.ALLOWED_FORMATS.join(", ")}`,
    };
  }

  return {
    valid: true,
    file,
  };
};

export const formatFileSize = (bytes: number): string => {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
};

// ==================== File Parsing ====================

export const parseFile = async (file: File): Promise<ParsedFileData> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];

    if (!worksheet) {
      throw new Error("No worksheet found in file");
    }

    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      blankrows: false,
      defval: "",
    });

    if (jsonData.length === 0) {
      throw new Error("File contains no data");
    }

    if (jsonData.length > IMPORT_CONFIG.MAX_ROWS) {
      throw new Error(
        `File contains too many rows (${jsonData.length}). Maximum is ${IMPORT_CONFIG.MAX_ROWS}`
      );
    }

    const headers = Object.keys(jsonData[0] || {});
    const rows = jsonData as Record<string, unknown>[];

    return {
      headers,
      rows,
      columnCount: headers.length,
      rowCount: rows.length,
      fileName: file.name,
      fileSize: file.size,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw createImportError(
      ERROR_CODES.PARSE_ERROR,
      `Failed to parse file: ${message}`
    );
  }
};

// ==================== Field Type Detection ====================

const detectFieldType = (values: unknown[]): FieldType => {
  const nonEmptyValues = values.filter(
    (v) => v !== null && v !== undefined && v !== ""
  );

  if (nonEmptyValues.length === 0) {
    return "text"; // Default to text for empty columns
  }

  // Check for boolean
  const booleanMatches = nonEmptyValues.filter((v) =>
    FIELD_PATTERNS.BOOLEAN.test(String(v))
  );
  if (booleanMatches.length / nonEmptyValues.length > 0.8) {
    return "boolean";
  }

  // Check for email
  const emailMatches = nonEmptyValues.filter((v) =>
    FIELD_PATTERNS.EMAIL.test(String(v))
  );
  if (emailMatches.length / nonEmptyValues.length > 0.8) {
    return "email";
  }

  // Check for URL
  const urlMatches = nonEmptyValues.filter((v) =>
    FIELD_PATTERNS.URL.test(String(v))
  );
  if (urlMatches.length / nonEmptyValues.length > 0.8) {
    return "url";
  }

  // Check for phone
  const phoneMatches = nonEmptyValues.filter((v) =>
    FIELD_PATTERNS.PHONE.test(String(v))
  );
  if (phoneMatches.length / nonEmptyValues.length > 0.8) {
    return "phone";
  }

  // Check for date
  const dateMatches = nonEmptyValues.filter((v) => {
    const str = String(v);
    return (
      FIELD_PATTERNS.ISO_DATE.test(str) ||
      FIELD_PATTERNS.US_DATE.test(str) ||
      !isNaN(Date.parse(str))
    );
  });
  if (dateMatches.length / nonEmptyValues.length > 0.8) {
    return "date";
  }

  // Check for number
  const numberMatches = nonEmptyValues.filter((v) => {
    const num = Number(v);
    return !isNaN(num) && isFinite(num);
  });
  if (numberMatches.length / nonEmptyValues.length > 0.8) {
    return "number";
  }

  return "text";
};

const calculateConfidence = (
  type: FieldType,
  values: unknown[]
): number => {
  const nonEmptyValues = values.filter(
    (v) => v !== null && v !== undefined && v !== ""
  );

  if (nonEmptyValues.length === 0) {
    return 0.5; // Low confidence for empty columns
  }

  let matches = 0;

  switch (type) {
    case "email":
      matches = nonEmptyValues.filter((v) =>
        FIELD_PATTERNS.EMAIL.test(String(v))
      ).length;
      break;
    case "url":
      matches = nonEmptyValues.filter((v) =>
        FIELD_PATTERNS.URL.test(String(v))
      ).length;
      break;
    case "phone":
      matches = nonEmptyValues.filter((v) =>
        FIELD_PATTERNS.PHONE.test(String(v))
      ).length;
      break;
    case "date":
      matches = nonEmptyValues.filter((v) => {
        const str = String(v);
        return (
          FIELD_PATTERNS.ISO_DATE.test(str) ||
          FIELD_PATTERNS.US_DATE.test(str) ||
          !isNaN(Date.parse(str))
        );
      }).length;
      break;
    case "number":
      matches = nonEmptyValues.filter((v) => {
        const num = Number(v);
        return !isNaN(num) && isFinite(num);
      }).length;
      break;
    case "boolean":
      matches = nonEmptyValues.filter((v) =>
        FIELD_PATTERNS.BOOLEAN.test(String(v))
      ).length;
      break;
    case "text":
      matches = nonEmptyValues.length;
      break;
  }

  return Math.min(
    matches / nonEmptyValues.length,
    1.0
  );
};

const sanitizeFieldName = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
};

const humanizeFieldName = (name: string): string => {
  return name
    .replace(/_/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

export const detectFields = (
  parsedData: ParsedFileData
): FieldDetectionResult => {
  const fields: DetectedField[] = parsedData.headers.map((header, index) => {
    const columnValues = parsedData.rows.map((row) => row[header]);
    const detectedType = detectFieldType(columnValues);
    const confidence = calculateConfidence(detectedType, columnValues);
    const sampleValues = columnValues
      .filter((v) => v !== null && v !== undefined && v !== "")
      .slice(0, 3);

    const sanitizedName = sanitizeFieldName(header);
    const displayName = humanizeFieldName(sanitizedName);

    return {
      name: sanitizedName || `field_${index}`,
      displayName: displayName || `Field ${index}`,
      type: detectedType,
      confidence,
      sampleValues,
    };
  });

  return {
    fields,
    detectedAt: new Date(),
  };
};

// ==================== Error Handling ====================

export const createImportError = (
  code: string,
  message: string,
  details?: unknown,
  recoverable: boolean = true
): ImportError => {
  return {
    code,
    message,
    details,
    recoverable,
  };
};

const isImportError = (error: unknown): error is ImportError => {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    "recoverable" in error
  );
};

export const handleFileError = (error: unknown): ImportError => {
  if (isImportError(error)) {
    return error;
  }

  if (error instanceof Error) {
    if (error.message.includes("File is too large")) {
      return createImportError(
        ERROR_CODES.FILE_TOO_LARGE,
        error.message
      );
    }
    if (error.message.includes("Invalid file format")) {
      return createImportError(
        ERROR_CODES.INVALID_FILE_TYPE,
        error.message
      );
    }
    return createImportError(
      ERROR_CODES.FILE_READ_ERROR,
      error.message
    );
  }

  return createImportError(
    ERROR_CODES.FILE_READ_ERROR,
    "An unknown error occurred while reading the file"
  );
};

// ==================== Export Utilities ====================

export const getPreviewRows = (
  data: ParsedFileData,
  limit: number = IMPORT_CONFIG.PREVIEW_ROWS
): ParsedFileData => {
  return {
    ...data,
    rows: data.rows.slice(0, limit),
    rowCount: Math.min(data.rowCount, limit),
  };
};

export const sanitizeRowData = (
  row: Record<string, unknown>
): Record<string, unknown> => {
  const sanitized: Record<string, unknown> = {};

  Object.entries(row).forEach(([key, value]) => {
    // Remove empty values
    if (value === null || value === undefined || value === "") {
      return;
    }

    // Trim strings
    if (typeof value === "string") {
      sanitized[key] = value.trim();
    } else {
      sanitized[key] = value;
    }
  });

  return sanitized;
};

// ==================== Validation ====================

export const validateRowData = (
  row: Record<string, unknown>,
  fields: DetectedField[]
): { valid: boolean; errors: Record<string, string> } => {
  const errors: Record<string, string> = {};

  fields.forEach((field) => {
    const value = row[field.name];

    if (value === null || value === undefined || value === "") {
      // Optional fields can be empty
      return;
    }

    const stringValue = String(value);

    switch (field.type) {
      case "email":
        if (!FIELD_PATTERNS.EMAIL.test(stringValue)) {
          errors[field.name] = "Invalid email address";
        }
        break;
      case "url":
        if (!FIELD_PATTERNS.URL.test(stringValue)) {
          errors[field.name] = "Invalid URL";
        }
        break;
      case "phone":
        if (!FIELD_PATTERNS.PHONE.test(stringValue)) {
          errors[field.name] = "Invalid phone number";
        }
        break;
      case "number":
        if (isNaN(Number(stringValue))) {
          errors[field.name] = "Invalid number";
        }
        break;
      case "boolean":
        if (!FIELD_PATTERNS.BOOLEAN.test(stringValue)) {
          errors[field.name] = "Invalid boolean value";
        }
        break;
      case "date":
        if (isNaN(Date.parse(stringValue))) {
          errors[field.name] = "Invalid date";
        }
        break;
    }
  });

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
};
