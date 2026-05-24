/**
 * Core Import Flow Hook
 * Manages the entire import state machine and orchestrates the import process
 */

"use client";

import { useState, useCallback, useReducer } from "react";
import { ERROR_CODES } from "./types";
import {
  validateFile,
  parseFile,
  detectFields,
  createImportError,
  getPreviewRows,
} from "./utils";

import type {
  ImportFlowState,
  ImportStep,
  ImportError,
  ImportProgress,
  DetectedField,
  ParsedFileData,
  CreateCollectionInput,
} from "./types";

// ==================== Action Types ====================

type ImportFlowAction =
  | { type: "FILE_UPLOAD_START" }
  | { type: "FILE_UPLOAD_SUCCESS"; payload: { file: File; parsedData: ParsedFileData; detectedFields: DetectedField[] } }
  | { type: "FILE_UPLOAD_ERROR"; payload: ImportError }
  | { type: "GO_TO_STEP"; payload: ImportStep }
  | { type: "SELECT_COLLECTION"; payload: string }
  | { type: "CREATE_NEW_COLLECTION"; payload: CreateCollectionInput }
  | { type: "IMPORT_START" }
  | { type: "IMPORT_PROGRESS"; payload: ImportProgress }
  | { type: "IMPORT_SUCCESS"; payload: { collectionId: string; collectionName: string; importedRows: number; failedRows: number } }
  | { type: "IMPORT_ERROR"; payload: ImportError }
  | { type: "RESET" };

// ==================== Initial State ====================

const initialState: ImportFlowState = {
  file: null,
  fileError: null,
  parsedData: null,
  detectedFields: null,
  selectedCollectionId: null,
  createNew: false,
  newCollectionInput: null,
  isImporting: false,
  importProgress: {
    step: "idle",
    processedRows: 0,
    totalRows: 0,
    percentage: 0,
  },
  importResult: null,
  importError: null,
  currentStep: "idle",
  isLoading: false,
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

// ==================== Reducer ====================

const importFlowReducer = (
  state: ImportFlowState,
  action: ImportFlowAction
): ImportFlowState => {
  switch (action.type) {
    case "FILE_UPLOAD_START":
      return {
        ...state,
        isLoading: true,
        fileError: null,
        currentStep: "uploading",
      };

    case "FILE_UPLOAD_SUCCESS":
      return {
        ...state,
        file: action.payload.file,
        parsedData: action.payload.parsedData,
        detectedFields: action.payload.detectedFields,
        isLoading: false,
        fileError: null,
        currentStep: "preview",
      };

    case "FILE_UPLOAD_ERROR":
      return {
        ...state,
        fileError: action.payload,
        isLoading: false,
        currentStep: "idle",
      };

    case "GO_TO_STEP":
      return {
        ...state,
        currentStep: action.payload,
      };

    case "SELECT_COLLECTION":
      return {
        ...state,
        selectedCollectionId: action.payload,
        createNew: false,
        currentStep: "importing",
      };

    case "CREATE_NEW_COLLECTION":
      return {
        ...state,
        createNew: true,
        newCollectionInput: action.payload,
        currentStep: "importing",
      };

    case "IMPORT_START":
      return {
        ...state,
        isImporting: true,
        importError: null,
        importProgress: {
          step: "importing",
          processedRows: 0,
          totalRows: state.parsedData?.rowCount || 0,
          percentage: 0,
          currentMessage: "Starting import...",
        },
        currentStep: "importing",
      };

    case "IMPORT_PROGRESS":
      return {
        ...state,
        importProgress: action.payload,
      };

    case "IMPORT_SUCCESS":
      return {
        ...state,
        isImporting: false,
        importError: null,
        importResult: {
          success: true,
          collectionId: action.payload.collectionId,
          collectionName: action.payload.collectionName,
          importedRows: action.payload.importedRows,
          failedRows: action.payload.failedRows,
          errors: [],
          startTime: new Date(),
          endTime: new Date(),
          duration: 0,
        },
        currentStep: "success",
      };

    case "IMPORT_ERROR":
      return {
        ...state,
        isImporting: false,
        importError: action.payload,
        currentStep: "error",
      };

    case "RESET":
      return initialState;

    default:
      return state;
  }
};

// ==================== Hook ====================

export const useImportFlow = (orgId: string) => {
  const [state, dispatch] = useReducer(importFlowReducer, initialState);

  // ==================== File Upload ====================

  const uploadFile = useCallback(
    async (file: File) => {
      dispatch({ type: "FILE_UPLOAD_START" });

      try {
        // Validate file
        const validation = validateFile(file);
        if (!validation.valid) {
          throw createImportError(
            ERROR_CODES.FILE_READ_ERROR,
            validation.error || "Invalid file"
          );
        }

        // Parse file
        const parsedData = await parseFile(file);

        // Detect fields
        const detectionResult = detectFields(parsedData);
        const previewData = getPreviewRows(parsedData);

        dispatch({
          type: "FILE_UPLOAD_SUCCESS",
          payload: {
            file,
            parsedData: previewData,
            detectedFields: detectionResult.fields,
          },
        });
      } catch (error) {
        const importError = isImportError(error) ? error : createImportError(
          ERROR_CODES.FILE_READ_ERROR,
          error instanceof Error ? error.message : "Failed to upload file"
        );

        dispatch({
          type: "FILE_UPLOAD_ERROR",
          payload: importError,
        });

        throw importError;
      }
    },
    []
  );

  // ==================== Collection Selection ====================

  const selectCollection = useCallback((collectionId: string) => {
    dispatch({
      type: "SELECT_COLLECTION",
      payload: collectionId,
    });
  }, []);

  const createNewCollection = useCallback(
    (input: CreateCollectionInput) => {
      dispatch({
        type: "CREATE_NEW_COLLECTION",
        payload: input,
      });
    },
    []
  );

  // ==================== Import Execution ====================

  const startImport = useCallback(async () => {
    if (!state.file || !state.parsedData || !state.detectedFields) {
      throw createImportError(
        ERROR_CODES.VALIDATION_ERROR,
        "Missing file or collection data"
      );
    }

    if (!state.selectedCollectionId && !state.createNew) {
      throw createImportError(
        ERROR_CODES.NO_COLLECTION_SELECTED,
        "Please select or create a collection"
      );
    }

    dispatch({ type: "IMPORT_START" });

    try {
      // Simulate import progress
      const totalRows = state.parsedData.rows.length;
      const batchSize = 100;

      for (let i = 0; i < totalRows; i += batchSize) {
        const processedRows = Math.min(i + batchSize, totalRows);
        const percentage = Math.round((processedRows / totalRows) * 100);

        dispatch({
          type: "IMPORT_PROGRESS",
          payload: {
            step: "importing",
            processedRows,
            totalRows,
            percentage,
            currentMessage: `Importing ${processedRows} of ${totalRows} rows...`,
          },
        });

        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Success
      dispatch({
        type: "IMPORT_SUCCESS",
        payload: {
          collectionId: state.selectedCollectionId || "new-collection",
          collectionName: state.newCollectionInput?.name || "New Collection",
          importedRows: totalRows,
          failedRows: 0,
        },
      });
    } catch (error) {
      const importError = isImportError(error) ? error : createImportError(
        ERROR_CODES.IMPORT_FAILED,
        error instanceof Error ? error.message : "Import failed"
      );

      dispatch({
        type: "IMPORT_ERROR",
        payload: importError,
      });

      throw importError;
    }
  }, [state]);

  // ==================== Navigation ====================

  const goToStep = useCallback((step: ImportStep) => {
    dispatch({
      type: "GO_TO_STEP",
      payload: step,
    });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  // ==================== Utilities ====================

  const canProceed = useCallback(() => {
    switch (state.currentStep) {
      case "idle":
        return !state.file;
      case "uploading":
        return false; // Cannot proceed while uploading
      case "preview":
        return !!state.parsedData && !!state.detectedFields;
      case "collection-select":
        return !!state.selectedCollectionId || state.createNew;
      case "importing":
        return false; // Cannot proceed while importing
      case "success":
      case "error":
        return true; // Can reset
      default:
        return false;
    }
  }, [state]);

  return {
    state,
    uploadFile,
    selectCollection,
    createNewCollection,
    startImport,
    goToStep,
    reset,
    canProceed,
  };
};

// ==================== API Integration Hook ====================

export const useImportAPI = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ImportError | null>(null);

  const executeImport = useCallback(
    async (
      orgId: string,
      userId: string,
      collectionId: string | null,
      collectionInput: CreateCollectionInput | null,
      rows: Record<string, unknown>[],
      fields: DetectedField[]
    ) => {
      setIsLoading(true);
      setError(null);

      try {
        // Call backend API to create collection if needed
        let finalCollectionId = collectionId;

        if (!collectionId && collectionInput) {
          const createResponse = await fetch("/api/collections", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              orgId,
              ...collectionInput,
            }),
          });

          if (!createResponse.ok) {
            throw new Error("Failed to create collection");
          }

          const data = await createResponse.json();
          finalCollectionId = data.id;
        }

        // Call backend API to import data
        const importResponse = await fetch("/api/imports", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            orgId,
            userId,
            collectionId: finalCollectionId,
            rows: rows.map((row) => sanitizeRowData(row)),
            fields,
          }),
        });

        if (!importResponse.ok) {
          throw new Error("Import failed");
        }

        const result = await importResponse.json();
        return result;
      } catch (err) {
        const importError = createImportError(
          ERROR_CODES.IMPORT_FAILED,
          err instanceof Error ? err.message : "Import failed"
        );
        setError(importError);
        throw importError;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return {
    executeImport,
    isLoading,
    error,
  };
};

// ==================== Collection Query Hook ====================

export const useCollections = (orgId: string) => {
  const [collections, setCollections] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ImportError | null>(null);

  const fetchCollections = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/collections?orgId=${orgId}`);

      if (!response.ok) {
        throw new Error("Failed to fetch collections");
      }

      const data = await response.json();
      setCollections(data);
    } catch (err) {
      const importError = createImportError(
        ERROR_CODES.NETWORK_ERROR,
        err instanceof Error ? err.message : "Failed to fetch collections"
      );
      setError(importError);
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  return {
    collections,
    isLoading,
    error,
    refetch: fetchCollections,
  };
};

function sanitizeRowData(row: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  Object.entries(row).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") {
      return;
    }

    if (typeof value === "string") {
      sanitized[key] = value.trim();
    } else {
      sanitized[key] = value;
    }
  });

  return sanitized;
}
