/**
 * Import System Integration Utilities
 * Helpers for integrating the import system into your app
 */

import { useAuth } from "@/contexts/AuthContext";
import { useCollections } from "@/hooks/useCollections";
import type { ImportConfig } from "@/features/import/types";

/**
 * Hook for integrating import into collections
 */
export function useCollectionImport() {
  const { currentOrgId, user } = useAuth();
  const { collections, createCollection } = useCollections();

  return {
    currentOrgId,
    userId: user?.id || "",
    collections,
    createCollection,
  };
}

/**
 * Get collection by ID
 */
export function getCollectionById(collections: any[], id: string) {
  return collections.find((c) => c.id === id);
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

/**
 * Format number for display
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Check if user can import
 * (Must be editor or above)
 */
export function canUserImport(userRole?: string): boolean {
  if (!userRole) return false;
  return ["owner", "admin", "editor"].includes(userRole);
}

/**
 * Create import config from UI state
 */
export function createImportConfig(
  useExisting: boolean,
  collectionId?: string,
  collectionName?: string
): ImportConfig {
  return {
    createNewCollection: !useExisting,
    collectionId: useExisting ? collectionId : undefined,
    collectionName: !useExisting ? collectionName : undefined,
    skipFirstRow: false,
    fieldMappings: {},
    validateBeforeImport: true,
    batchSize: 100,
  };
}

/**
 * Validate import configuration
 */
export function validateImportConfig(config: ImportConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (config.createNewCollection) {
    if (!config.collectionName || config.collectionName.trim().length === 0) {
      errors.push("Collection name is required");
    }
  } else {
    if (!config.collectionId) {
      errors.push("Collection ID is required");
    }
  }

  if (!config.batchSize || config.batchSize < 1 || config.batchSize > 1000) {
    errors.push("Batch size must be between 1 and 1000");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Sample data for testing
 */
export function generateSampleCSV(): string {
  const headers = ["name", "email", "age", "department", "salary", "hire_date"];
  const rows = [
    ["Alice Johnson", "alice@company.com", "32", "Engineering", "85000", "2020-01-15"],
    ["Bob Smith", "bob@company.com", "28", "Marketing", "65000", "2021-03-22"],
    ["Carol Williams", "carol@company.com", "35", "Finance", "75000", "2019-06-10"],
    ["David Brown", "david@company.com", "29", "Engineering", "80000", "2020-09-05"],
    ["Emma Davis", "emma@company.com", "31", "HR", "70000", "2020-11-18"],
  ];

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell}"`).join(","))
    .join("\n");

  return csvContent;
}

/**
 * Download sample CSV
 */
export function downloadSampleCSV(): void {
  const csv = generateSampleCSV();
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sample_import.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Get supported file types description
 */
export function getSupportedFileTypes(): string {
  return "Excel (.xlsx, .xls), CSV (.csv, .txt)";
}

/**
 * Check if file type is supported
 */
export function isSupportedFileType(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return ["xlsx", "xls", "csv", "txt"].includes(ext);
}

/**
 * Get file icon based on extension
 */
export function getFileIcon(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (["xlsx", "xls"].includes(ext)) return "📊";
  if (["csv", "txt"].includes(ext)) return "📄";
  return "📎";
}

/**
 * Convert import result to user-friendly message
 */
export function formatImportResultMessage(result: {
  success: boolean;
  importedRows: number;
  failedRows: number;
}): string {
  if (result.success) {
    return `✓ Import successful! ${result.importedRows} records imported.`;
  }

  if (result.failedRows === 0) {
    return `✓ All ${result.importedRows} records imported successfully.`;
  }

  return `⚠ Import completed: ${result.importedRows} imported, ${result.failedRows} failed.`;
}

/**
 * Estimate import duration based on row count
 */
export function estimateImportDuration(rowCount: number): string {
  // Rough estimate: ~10ms per row
  const estimatedMs = Math.max(1000, rowCount * 10);
  const seconds = Math.round(estimatedMs / 1000);

  if (seconds < 60) {
    return `~${seconds} seconds`;
  }

  const minutes = Math.round(seconds / 60);
  return `~${minutes} minutes`;
}

/**
 * Get field type icon
 */
export function getFieldTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    text: "T",
    number: "#",
    boolean: "✓",
    date: "📅",
    select: "▼",
    image: "🖼️",
  };
  return icons[type] || "T";
}

/**
 * Suggestions for field naming
 */
export function getSuggestedFieldNames(): string[] {
  return [
    "name",
    "email",
    "phone",
    "address",
    "city",
    "state",
    "zip",
    "country",
    "company",
    "department",
    "title",
    "age",
    "salary",
    "hire_date",
    "status",
    "notes",
    "created_at",
    "updated_at",
  ];
}
