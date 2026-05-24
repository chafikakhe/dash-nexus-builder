/**
 * Import System - Public API
 * Re-export all import-related modules and utilities
 */

// Types
export type {
  ParsedFileData,
  FieldDetectionResult,
  ImportConfig,
  ImportResult,
  ImportError,
  ImportLog,
  ImportValidationResult,
  ImportProgress,
  FieldMapping,
  UploadConstraints,
  ImportContext,
  ImportUIState,
  BatchInsertRequest,
  BatchInsertResponse,
} from "./types";

// Components
export { ImportModal } from "@/components/import/ImportModal";
export { DynamicCollectionTable, DynamicFieldCell, EditableCollectionTable } from "@/components/import/DynamicCollectionTable";
export { ImportHistory, ImportDetails } from "@/components/import/ImportHistory";

// Hooks
export { useImport, useDuplicateImportCheck } from "@/hooks/useImport";
export { useCollectionImport } from "@/features/import/utils/integrationHelpers";

// Utilities - Field Detection
export {
  detectFieldType,
  detectFieldTypeFromValue,
  getDetectionConfidence,
  generateFieldSlug,
  sanitizeFieldName,
  detectFields,
  normalizeValue,
  validateValue,
  isEmail,
  isUrl,
  isPhone,
  isDate,
  isBoolean,
  isNumber,
} from "@/features/import/utils/fieldDetection";

// Utilities - File Parsing
export {
  validateFile,
  parseFile,
  parseExcelFile,
  parseCSVFile,
  convertToCSV,
  exportToExcel,
  getSampleRows,
  validateHeaders,
  getFileExtension,
  isExcelFile,
  isCSVFile,
  MAX_FILE_SIZE,
  MAX_ROWS,
  ALLOWED_FILE_TYPES,
} from "@/features/import/utils/fileParsing";

// Utilities - Validation
export {
  validateRow,
  validateParsedFile,
  sanitizeRowData,
  detectRequiredFields,
  findDuplicateRows,
  validateFieldMapping,
  checkFileIntegrity,
  estimateImportSize,
  preImportValidation,
} from "@/features/import/utils/validation";

// Utilities - Integration
export {
  formatFileSize,
  formatNumber,
  canUserImport,
  createImportConfig,
  validateImportConfig,
  generateSampleCSV,
  downloadSampleCSV,
  getSupportedFileTypes,
  isSupportedFileType,
  getFileIcon,
  formatImportResultMessage,
  estimateImportDuration,
  getFieldTypeIcon,
  getSuggestedFieldNames,
} from "@/features/import/utils/integrationHelpers";

// Services
export {
  createCollectionWithFields,
  getCollectionWithFields,
  addMissingFields,
  batchInsertRecords,
  logImport,
  getImportLogs,
  getImportDetails,
  checkDuplicateImport,
  getCollectionRecordsAfterImport,
  deleteImportedRecords,
  verifyCollectionAccess,
  getImportStatistics,
} from "@/services/import/supabaseService";
