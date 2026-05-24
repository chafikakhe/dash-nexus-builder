/**
 * Import UI System - Public API
 * Single export point for all components, hooks, types, and utilities
 */

// ==================== Components ====================
export { DragDropUpload } from "./components/DragDropUpload";
export { FilePreviewTable } from "./components/FilePreviewTable";
export { CollectionSelector } from "./components/CollectionSelector";
export { CreateCollectionForm } from "./components/CreateCollectionForm";
export { ImportProgress } from "./components/ImportProgress";
export { ImportResults } from "./components/ImportResults";
export { ImportModal } from "./components/ImportModal";
export { ImportButton } from "./components/ImportButton";

// ==================== Hooks ====================
export {
  useImportFlow,
  useImportAPI,
  useCollections,
} from "./hooks";

// ==================== Types ====================
export type {
  ParsedFileData,
  FileValidationResult,
  FieldType,
  DetectedField,
  FieldDetectionResult,
  CollectionFieldSchema,
  CollectionSummary,
  CreateCollectionInput,
  ImportStep,
  ImportError,
  ImportProgress,
  ImportResult,
  ImportFlowState,
  ParseFileResponse,
  DetectFieldsResponse,
  CreateCollectionResponse,
  ExecuteImportResponse,
  ImportModalProps,
  DragDropUploadProps,
  FilePreviewTableProps,
  CollectionSelectorProps,
  CreateCollectionFormProps,
  ImportProgressProps,
  ImportResultsProps,
  UseImportFlowReturn,
  UseFileUploadReturn,
  UseCollectionSelectorReturn,
  ImportFormData,
} from "./types";

export { IMPORT_CONFIG, FIELD_PATTERNS, ERROR_CODES } from "./types";

// ==================== Utilities ====================
export {
  validateFile,
  formatFileSize,
  parseFile,
  detectFields,
  createImportError,
  handleFileError,
  getPreviewRows,
  sanitizeRowData,
  validateRowData,
} from "./utils";

// ==================== Constants ====================
export const IMPORT_FEATURE_VERSION = "1.0.0";
