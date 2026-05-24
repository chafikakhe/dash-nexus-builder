/**
 * Import Hooks
 * Manages import state, logic, and orchestration
 */

import { useCallback, useReducer } from "react";
import { parseFile } from "@/features/import/utils/fileParsing";
import { detectFields } from "@/features/import/utils/fieldDetection";
import { preImportValidation, sanitizeRowData } from "@/features/import/utils/validation";
import {
  createCollectionWithFields,
  getCollectionWithFields,
  addMissingFields,
  batchInsertRecords,
  logImport,
  checkDuplicateImport,
  verifyCollectionAccess,
} from "@/services/import/supabaseService";
import type {
  ParsedFileData,
  FieldDetectionResult,
  ImportConfig,
  ImportResult,
  ImportProgress,
  ImportUIState,
} from "@/features/import/types";
import type { Field } from "@/hooks/useCollections";
import { toast } from "sonner";

/**
 * Import state reducer
 */
type ImportAction =
  | { type: "RESET" }
  | { type: "FILE_SELECTED"; payload: string }
  | { type: "PARSE_START" }
  | { type: "PARSE_SUCCESS"; payload: ParsedFileData }
  | { type: "PARSE_ERROR"; payload: string }
  | { type: "DETECT_FIELDS"; payload: FieldDetectionResult[] }
  | { type: "UPDATE_CONFIG"; payload: Partial<ImportConfig> }
  | { type: "VALIDATE_START" }
  | { type: "VALIDATE_ERROR"; payload: string }
  | { type: "IMPORT_START" }
  | { type: "IMPORT_PROGRESS"; payload: Partial<ImportProgress> }
  | { type: "IMPORT_SUCCESS"; payload: ImportResult }
  | { type: "IMPORT_ERROR"; payload: string };

const initialState: ImportUIState = {
  fileSelected: false,
  fileName: "",
  previewData: null,
  detectedFields: [],
  config: {
    createNewCollection: false,
    skipFirstRow: false,
    fieldMappings: {},
    validateBeforeImport: true,
    batchSize: 100,
  },
  progress: {
    totalRows: 0,
    processedRows: 0,
    failedRows: 0,
    successRows: 0,
    percentage: 0,
    status: "idle",
    message: "",
  },
  result: null,
  error: null,
};

function importReducer(state: ImportUIState, action: ImportAction): ImportUIState {
  switch (action.type) {
    case "RESET":
      return initialState;

    case "FILE_SELECTED":
      return { ...state, fileSelected: true, fileName: action.payload, error: null };

    case "PARSE_START":
      return {
        ...state,
        progress: { ...state.progress, status: "parsing", message: "Parsing file..." },
      };

    case "PARSE_SUCCESS":
      return {
        ...state,
        previewData: action.payload,
        progress: {
          ...state.progress,
          status: "idle",
          message: "File parsed successfully",
          totalRows: action.payload.rows.length,
          processedRows: 0,
          failedRows: 0,
          successRows: 0,
          percentage: 0,
        },
      };

    case "PARSE_ERROR":
      return {
        ...state,
        error: action.payload,
        progress: { ...state.progress, status: "error", message: action.payload },
      };

    case "DETECT_FIELDS":
      return {
        ...state,
        detectedFields: action.payload,
        progress: { ...state.progress, status: "idle", message: "" },
      };

    case "UPDATE_CONFIG":
      return {
        ...state,
        config: { ...state.config, ...action.payload },
      };

    case "VALIDATE_START":
      return {
        ...state,
        progress: { ...state.progress, status: "validating", message: "Validating data..." },
      };

    case "VALIDATE_ERROR":
      return {
        ...state,
        error: action.payload,
        progress: { ...state.progress, status: "error", message: action.payload },
      };

    case "IMPORT_START":
      return {
        ...state,
        error: null,
        result: null,
        progress: {
          ...state.progress,
          status: "importing",
          message: "Importing records...",
          totalRows: state.previewData?.rows.length || 0,
          processedRows: 0,
          failedRows: 0,
          successRows: 0,
          percentage: 0,
        },
      };

    case "IMPORT_PROGRESS":
      const totalRows = action.payload.totalRows ?? state.progress.totalRows;
      const processedRows = action.payload.processedRows ?? state.progress.processedRows;
      return {
        ...state,
        progress: {
          ...state.progress,
          ...action.payload,
          totalRows,
          processedRows,
          percentage:
            totalRows > 0
              ? Math.round((processedRows / totalRows) * 100)
              : 0,
        },
      };

    case "IMPORT_SUCCESS":
      return {
        ...state,
        result: action.payload,
        progress: {
          ...state.progress,
          status: "completed",
          message: "Import completed successfully",
          totalRows: action.payload.importedRows + action.payload.failedRows,
          processedRows: action.payload.importedRows,
          failedRows: action.payload.failedRows,
          successRows: action.payload.importedRows,
          percentage: 100,
        },
      };

    case "IMPORT_ERROR":
      return {
        ...state,
        error: action.payload,
        progress: { ...state.progress, status: "error", message: action.payload },
      };

    default:
      return state;
  }
}

/**
 * Main import hook
 */
export function useImport() {
  const [state, dispatch] = useReducer(importReducer, initialState);

  /**
   * Parse uploaded file
   */
  const handleFileUpload = useCallback(async (file: File) => {
    try {
      console.log("[import] selected file", {
        name: file.name,
        size: file.size,
        type: file.type,
      });
      dispatch({ type: "FILE_SELECTED", payload: file.name });
      dispatch({ type: "PARSE_START" });

      const parsed = await parseFile(file);
      console.log("[import] parsed headers", parsed.headers);
      console.log("[import] parsed rows count", parsed.rows.length);

      if (parsed.rows.length === 0) {
        throw new Error("No rows found in this file.");
      }

      dispatch({ type: "PARSE_SUCCESS", payload: parsed });

      // Auto-detect fields
      const detectedFields = detectFields(parsed.headers, parsed.rows.slice(0, 100));
      dispatch({ type: "DETECT_FIELDS", payload: detectedFields });

      toast.success(`File parsed: ${parsed.rowCount} rows`);
      return parsed;
    } catch (error: any) {
      const message = error.message || "Failed to parse file";
      dispatch({ type: "PARSE_ERROR", payload: message });
      toast.error(message);
      return null;
    }
  }, []);

  /**
   * Execute import
   */
  const executeImport = useCallback(
    async (
      orgId: string,
      userId: string,
      config: ImportConfig,
      onProgress?: (progress: ImportProgress) => void
    ): Promise<ImportResult | null> => {
      try {
        if (!state.previewData) {
          throw new Error("No file parsed");
        }

        const parsedData = state.previewData;
        const rows = parsedData.rows;
        const rowsCount = rows.length;

        if (rowsCount === 0) {
          throw new Error("No rows found in this file.");
        }

        const selectedCollectionId = config.createNewCollection
          ? null
          : config.collectionId;

        console.log("[import] selected collectionId", selectedCollectionId);
        console.log("[import] orgId", orgId);
        console.log("[import] userId", userId);

        dispatch({ type: "IMPORT_START" });

        // Pre-import validation
        if (config.validateBeforeImport) {
          const validation = preImportValidation(parsedData);
          if (!validation.canProceed) {
            throw new Error(validation.errors[0] || "Validation failed");
          }
        }

        let collectionId: string;
        let existingFields: Field[] = [];

        // Get or create collection
        if (config.createNewCollection) {
          if (!config.collectionName) {
            throw new Error("Collection name is required");
          }

          const created = await createCollectionWithFields(
            orgId,
            config.collectionName,
            state.detectedFields
          );

          if (!created) {
            throw new Error("Failed to create collection");
          }

          collectionId = created.collectionId;
          existingFields = created.fields;
        } else {
          if (!config.collectionId) {
            throw new Error("Collection ID is required");
          }

          // Verify access
          const hasAccess = await verifyCollectionAccess(config.collectionId, orgId);
          if (!hasAccess) {
            throw new Error("No access to collection");
          }

          // Get existing collection
          const existing = await getCollectionWithFields(config.collectionId, orgId);
          if (!existing) {
            throw new Error("Collection not found");
          }

          collectionId = existing.id;
          existingFields = existing.schema;

          // Add missing fields
          const newFields = state.detectedFields.filter(
            (df) => !existingFields.some((ef) => ef.name === df.name)
          );

          if (newFields.length > 0) {
            const updated = await addMissingFields(collectionId, existingFields, newFields);
            if (!updated) {
              throw new Error("Failed to add fields to collection");
            }
          }
        }

        // Sanitize and prepare records
        const preparedRecords = rows.map((row) =>
          sanitizeRowData(row, parsedData.headers)
        );

        console.log("[import] import payload", {
          collectionId,
          orgId,
          userId,
          filename: state.fileName,
          rowsCount,
          preparedRecordsCount: preparedRecords.length,
          sampleRecord: preparedRecords[0],
          config,
        });

        // Batch insert records
        const insertResponse = await batchInsertRecords(
          collectionId,
          orgId,
          preparedRecords,
          existingFields,
          config.batchSize,
          (progress) => {
            dispatch({
              type: "IMPORT_PROGRESS",
              payload: {
                totalRows: progress.total,
                processedRows: progress.processed,
                failedRows: progress.errors.length,
              },
            });

            if (onProgress) {
              onProgress({
                totalRows: progress.total,
                processedRows: progress.processed,
                failedRows: progress.errors.length,
                successRows: progress.processed - progress.errors.length,
                percentage: Math.round((progress.processed / progress.total) * 100),
                status: "importing",
                message: `Imported ${progress.processed}/${progress.total} rows`,
              });
            }
          }
        );
        console.log("[import] Supabase insert response", insertResponse);

        if (insertResponse.successful === 0 && insertResponse.failed > 0) {
          throw new Error(
            insertResponse.errors[0]?.errorMessage ||
              "Supabase insert failed"
          );
        }

        // Prepare result
        const result: ImportResult = {
          success: insertResponse.failed === 0,
          collectionId,
          importedRows: insertResponse.successful,
          failedRows: insertResponse.failed,
          errors: insertResponse.errors,
          warnings: [],
          importId: "",
          timestamp: new Date().toISOString(),
        };

        // Log import
        const logged = await logImport(
          userId,
          orgId,
          collectionId,
          state.fileName,
          {
            importedRows: insertResponse.successful,
            failedRows: insertResponse.failed,
            errors: insertResponse.errors,
            warnings: result.warnings,
          }
        );

        if (logged) {
          result.importId = logged.id;
        }

        // Update state
        dispatch({ type: "IMPORT_SUCCESS", payload: result });

        if (result.success) {
          toast.success(
            `Import successful: ${result.importedRows} records imported`
          );
        } else {
          toast.warning(
            `Import completed: ${result.importedRows} imported, ${result.failedRows} failed`
          );
        }

        return result;
      } catch (error: any) {
        const message = error.message || "Import failed";
        dispatch({ type: "IMPORT_ERROR", payload: message });
        toast.error(message);
        return null;
      } finally {
        console.log("[import] import mutation finished");
      }
    },
    [state]
  );

  /**
   * Update configuration
   */
  const updateConfig = useCallback((config: Partial<ImportConfig>) => {
    dispatch({ type: "UPDATE_CONFIG", payload: config });
  }, []);

  /**
   * Reset import state
   */
  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  return {
    state,
    handleFileUpload,
    executeImport,
    updateConfig,
    reset,
  };
}

/**
 * Hook for duplicate import detection
 */
export function useDuplicateImportCheck() {
  const checkDuplicate = useCallback(
    async (collectionId: string, filename: string) => {
      try {
        const duplicate = await checkDuplicateImport(collectionId, filename);
        return duplicate;
      } catch (error) {
        console.error("[import] Duplicate check error:", error);
        return null;
      }
    },
    []
  );

  return { checkDuplicate };
}
