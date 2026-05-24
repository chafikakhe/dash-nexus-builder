/**
 * Frontend Import UI Type Definitions
 * Comprehensive TypeScript interfaces for the entire import flow
 */

// ==================== File Handling ====================

export interface ParsedFileData {
  headers: string[];
  rows: Record<string, unknown>[];
  columnCount: number;
  rowCount: number;
  fileName: string;
  fileSize: number;
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  file?: File;
}

// ==================== Field Detection ====================

export type FieldType =
  | "text"
  | "number"
  | "boolean"
  | "date"
  | "email"
  | "url"
  | "phone"
  | "select";

export interface DetectedField {
  name: string;
  displayName: string;
  type: FieldType;
  confidence: number; // 0-1
  sampleValues: unknown[];
}

export interface FieldDetectionResult {
  fields: DetectedField[];
  detectedAt: Date;
}

// ==================== Collection ====================

export interface CollectionFieldSchema {
  name: string;
  displayName: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
}

export interface CollectionSummary {
  id: string;
  name: string;
  description?: string;
  fieldCount: number;
  recordCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCollectionInput {
  name: string;
  description?: string;
  fields: CollectionFieldSchema[];
}

// ==================== Import State Machine ====================

export type ImportStep =
  | "idle"
  | "uploading"
  | "preview"
  | "collection-select"
  | "importing"
  | "success"
  | "error";

export interface ImportError {
  code: string;
  message: string;
  details?: unknown;
  recoverable: boolean;
}

export interface ImportProgress {
  step: ImportStep;
  processedRows: number;
  totalRows: number;
  percentage: number;
  estimatedTimeRemaining?: number;
  currentMessage?: string;
}

export interface ImportResult {
  success: boolean;
  collectionId: string;
  collectionName: string;
  importedRows: number;
  failedRows: number;
  errors: ImportError[];
  startTime: Date;
  endTime: Date;
  duration: number; // milliseconds
}

// ==================== Import Flow State ====================

export interface ImportFlowState {
  // File upload
  file: File | null;
  fileError: ImportError | null;

  // File preview
  parsedData: ParsedFileData | null;
  detectedFields: DetectedField[] | null;

  // Collection selection
  selectedCollectionId: string | null;
  createNew: boolean;
  newCollectionInput: CreateCollectionInput | null;

  // Import execution
  isImporting: boolean;
  importProgress: ImportProgress;
  importResult: ImportResult | null;
  importError: ImportError | null;

  // Overall state
  currentStep: ImportStep;
  isLoading: boolean;
}

// ==================== API Responses ====================

export interface ParseFileResponse {
  headers: string[];
  rows: Record<string, unknown>[];
  columnCount: number;
  rowCount: number;
}

export interface DetectFieldsResponse {
  fields: DetectedField[];
}

export interface CreateCollectionResponse {
  id: string;
  name: string;
  fields: CollectionFieldSchema[];
}

export interface ExecuteImportResponse {
  success: boolean;
  collectionId: string;
  importedRows: number;
  failedRows: number;
  errors: Array<{
    row: number;
    message: string;
  }>;
}

// ==================== Component Props ====================

export interface ImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  userId: string;
  onImportSuccess?: (collectionId: string) => void;
  onImportError?: (error: ImportError) => void;
}

export interface DragDropUploadProps {
  onFileSelect: (file: File) => void;
  onError: (error: ImportError) => void;
  isLoading?: boolean;
  acceptedFormats?: string[];
}

export interface FilePreviewTableProps {
  data: ParsedFileData;
  detectedFields: DetectedField[];
  maxRows?: number;
  onFieldEdit?: (fieldIndex: number, field: DetectedField) => void;
}

export interface CollectionSelectorProps {
  collections: CollectionSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreateNew: () => void;
  isLoading?: boolean;
}

export interface CreateCollectionFormProps {
  suggestedName?: string;
  suggestedFields?: DetectedField[];
  onSubmit: (input: CreateCollectionInput) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export interface ImportProgressProps {
  progress: ImportProgress;
  isVisible?: boolean;
  showEstimatedTime?: boolean;
}

export interface ImportResultsProps {
  result: ImportResult | null;
  error: ImportError | null;
  isLoading?: boolean;
  onClose: () => void;
  onRetry?: () => void;
  onViewCollection?: () => void;
}

// ==================== Hook Return Types ====================

export interface UseImportFlowReturn {
  state: ImportFlowState;
  uploadFile: (file: File) => Promise<void>;
  detectFields: () => Promise<void>;
  selectCollection: (id: string) => void;
  createCollection: (input: CreateCollectionInput) => Promise<void>;
  startImport: () => Promise<void>;
  reset: () => void;
  goToStep: (step: ImportStep) => void;
  canProceed: () => boolean;
}

export interface UseFileUploadReturn {
  file: File | null;
  isLoading: boolean;
  error: ImportError | null;
  uploadFile: (file: File) => Promise<ParsedFileData>;
  clearFile: () => void;
  validateFile: (file: File) => FileValidationResult;
}

export interface UseCollectionSelectorReturn {
  collections: CollectionSummary[];
  isLoading: boolean;
  error: ImportError | null;
  selectedId: string | null;
  selectCollection: (id: string) => void;
  refetch: () => Promise<void>;
}

// ==================== Form Data ====================

export interface ImportFormData {
  collectionId?: string;
  collectionName?: string;
  collectionDescription?: string;
  fields?: CollectionFieldSchema[];
}

// ==================== File Constraints ====================

export const IMPORT_CONFIG = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10 MB
  MAX_ROWS: 50000,
  ALLOWED_FORMATS: [".xlsx", ".xls", ".csv"],
  PREVIEW_ROWS: 10,
  BATCH_SIZE: 100,
} as const;

export const FIELD_PATTERNS = {
  EMAIL:
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  URL: /^https?:\/\/.+/,
  PHONE: /^\+?[\d\s\-()]{10,}$/,
  ISO_DATE: /^\d{4}-\d{2}-\d{2}/,
  US_DATE: /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,
  BOOLEAN: /^(true|false|yes|no|1|0)$/i,
} as const;

export const ERROR_CODES = {
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  INVALID_FILE_TYPE: "INVALID_FILE_TYPE",
  FILE_READ_ERROR: "FILE_READ_ERROR",
  PARSE_ERROR: "PARSE_ERROR",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NO_COLLECTION_SELECTED: "NO_COLLECTION_SELECTED",
  COLLECTION_CREATE_FAILED: "COLLECTION_CREATE_FAILED",
  IMPORT_FAILED: "IMPORT_FAILED",
  NETWORK_ERROR: "NETWORK_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
} as const;
