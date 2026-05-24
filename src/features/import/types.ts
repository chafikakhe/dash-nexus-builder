/**
 * Import System Type Definitions
 * Comprehensive types for Excel/CSV import functionality
 */

import type { FieldType, Field } from "@/hooks/useCollections";

/**
 * Parsed file data structure
 */
export interface ParsedFileData {
  headers: string[];
  rows: Record<string, any>[];
  filename: string;
  rowCount: number;
}

/**
 * Field detection result with confidence
 */
export interface FieldDetectionResult {
  name: string;
  slug: string;
  type: FieldType;
  required: boolean;
  config: Record<string, any>;
  detectionConfidence: number;
}

/**
 * Import configuration
 */
export interface ImportConfig {
  collectionId?: string;
  collectionName?: string;
  createNewCollection: boolean;
  skipFirstRow: boolean;
  fieldMappings: Record<string, FieldDetectionResult>;
  validateBeforeImport: boolean;
  batchSize: number;
}

/**
 * Import result
 */
export interface ImportResult {
  success: boolean;
  collectionId: string;
  importedRows: number;
  failedRows: number;
  errors: ImportError[];
  warnings: string[];
  importId: string;
  timestamp: string;
}

/**
 * Import error detail
 */
export interface ImportError {
  rowIndex: number;
  rowData: Record<string, any>;
  errorMessage: string;
  fieldName?: string;
}

/**
 * Import log record (for database)
 */
export interface ImportLog {
  id: string;
  user_id: string;
  org_id: string;
  collection_id: string;
  filename: string;
  imported_rows: number;
  failed_rows: number;
  errors: ImportError[];
  warnings: string[];
  status: "success" | "partial" | "failed";
  created_at: string;
  metadata: Record<string, any>;
}

/**
 * Import validation result
 */
export interface ImportValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  rowsToImport: number;
  rowsWithErrors: number;
}

/**
 * Progress tracking
 */
export interface ImportProgress {
  totalRows: number;
  processedRows: number;
  failedRows: number;
  successRows: number;
  percentage: number;
  status: "idle" | "parsing" | "detecting" | "validating" | "importing" | "completed" | "error";
  message: string;
  currentError?: string;
}

/**
 * Field mapping for user customization
 */
export interface FieldMapping {
  sourceColumn: string;
  targetField: string;
  fieldType: FieldType;
  isRequired: boolean;
  transformation?: (value: any) => any;
}

/**
 * Upload constraints
 */
export interface UploadConstraints {
  maxFileSize: number; // in bytes
  maxRows: number;
  allowedFormats: string[];
  maxConcurrentImports: number;
}

/**
 * Collection import context
 */
export interface ImportContext {
  collectionId: string;
  collectionName: string;
  org_id: string;
  user_id: string;
  existingFields: Field[];
  newFields: FieldDetectionResult[];
}

/**
 * Import state for UI
 */
export interface ImportUIState {
  fileSelected: boolean;
  fileName: string;
  previewData: ParsedFileData | null;
  detectedFields: FieldDetectionResult[];
  config: ImportConfig;
  progress: ImportProgress;
  result: ImportResult | null;
  error: string | null;
}

/**
 * Batch insert request
 */
export interface BatchInsertRequest {
  collectionId: string;
  orgId: string;
  records: Record<string, any>[];
  batchSize: number;
}

/**
 * Batch insert response
 */
export interface BatchInsertResponse {
  successful: number;
  failed: number;
  errors: ImportError[];
  insertedIds: string[];
}
