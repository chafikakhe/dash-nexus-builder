/**
 * Import System - Testing Utilities
 * Helpers for testing the import system
 */

import type { ParsedFileData, FieldDetectionResult, ImportResult } from "./types";
import type { Field } from "@/hooks/useCollections";

/**
 * Generate mock parsed file data
 */
export function generateMockParsedData(
  rowCount: number = 10,
  columnCount: number = 5
): ParsedFileData {
  const headers: string[] = [];
  for (let i = 0; i < columnCount; i++) {
    headers.push(`Column${i + 1}`);
  }

  const rows: Record<string, any>[] = [];
  for (let i = 0; i < rowCount; i++) {
    const row: Record<string, any> = {};
    for (const header of headers) {
      if (header.includes("Date")) {
        row[header] = new Date(2024, 0, 1 + i).toISOString();
      } else if (header.includes("Count") || header.includes("Number")) {
        row[header] = Math.floor(Math.random() * 1000);
      } else if (header.includes("Active")) {
        row[header] = Math.random() > 0.5;
      } else {
        row[header] = `Value${i + 1}`;
      }
    }
    rows.push(row);
  }

  return {
    headers,
    rows,
    filename: "test-file.xlsx",
    rowCount: rows.length,
  };
}

/**
 * Generate mock field detection results
 */
export function generateMockFieldDetection(
  count: number = 5
): FieldDetectionResult[] {
  const types = ["text", "number", "boolean", "date"] as const;
  const results: FieldDetectionResult[] = [];

  for (let i = 0; i < count; i++) {
    const type = types[i % types.length];
    results.push({
      name: `field_${i + 1}`,
      slug: `field-${i + 1}`,
      type,
      required: i === 0, // First field is required
      config: {},
      detectionConfidence: 0.8 + Math.random() * 0.2,
    });
  }

  return results;
}

/**
 * Generate mock fields for schema
 */
export function generateMockFields(count: number = 5): Field[] {
  const types = ["text", "number", "boolean", "date"] as const;
  const fields: Field[] = [];

  for (let i = 0; i < count; i++) {
    const type = types[i % types.length];
    fields.push({
      name: `field_${i + 1}`,
      type,
    });
  }

  return fields;
}

/**
 * Generate mock import result
 */
export function generateMockImportResult(
  successCount: number = 100,
  failureCount: number = 0
): ImportResult {
  return {
    success: failureCount === 0,
    collectionId: "mock-collection-id",
    importedRows: successCount,
    failedRows: failureCount,
    errors:
      failureCount > 0
        ? [
            {
              rowIndex: 0,
              rowData: { field_1: "invalid" },
              errorMessage: "Invalid field value",
            },
          ]
        : [],
    warnings: [],
    importId: "mock-import-id",
    timestamp: new Date().toISOString(),
  };
}

/**
 * Generate test CSV content
 */
export function generateTestCSV(
  rows: number = 10,
  headers?: string[]
): string {
  if (!headers) {
    headers = ["name", "email", "age", "status"];
  }

  const lines: string[] = [headers.join(",")];

  for (let i = 0; i < rows; i++) {
    const line = headers
      .map((header) => {
        if (header.toLowerCase().includes("email")) {
          return `user${i}@example.com`;
        } else if (header.toLowerCase().includes("age")) {
          return String(20 + Math.floor(Math.random() * 50));
        } else if (header.toLowerCase().includes("status")) {
          return Math.random() > 0.5 ? "active" : "inactive";
        }
        return `value${i}`;
      })
      .join(",");
    lines.push(line);
  }

  return lines.join("\n");
}

/**
 * Create mock File object
 */
export function createMockFile(
  content: string,
  filename: string,
  type: string = "text/csv"
): File {
  const blob = new Blob([content], { type });
  return new File([blob], filename, { type });
}

/**
 * Test import scenarios
 */
export const TEST_SCENARIOS = {
  small: {
    name: "Small File (100 rows)",
    data: generateMockParsedData(100, 5),
  },
  medium: {
    name: "Medium File (1k rows)",
    data: generateMockParsedData(1000, 10),
  },
  large: {
    name: "Large File (10k rows)",
    data: generateMockParsedData(10000, 20),
  },
  minimal: {
    name: "Minimal (1 row, 1 column)",
    data: generateMockParsedData(1, 1),
  },
};

/**
 * Test field detection scenarios
 */
export const FIELD_DETECTION_SCENARIOS = {
  allText: ["text1", "text2", "text3"],
  allNumbers: ["100", "200", "300"],
  allDates: ["2024-01-01", "2024-01-02", "2024-01-03"],
  mixed: ["text1", "100", "2024-01-01", "true", "1.23"],
  withEmpty: ["value1", "", "value3", "", "value5"],
  emails: ["user1@example.com", "user2@example.com", "user3@example.com"],
  phones: ["+1-555-0001", "+1-555-0002", "+1-555-0003"],
};

/**
 * Test validation scenarios
 */
export const VALIDATION_SCENARIOS = {
  valid: generateMockParsedData(10, 5),
  withDuplicates: (() => {
    const data = generateMockParsedData(10, 5);
    // Add duplicates
    data.rows.push({ ...data.rows[0] });
    data.rows.push({ ...data.rows[1] });
    return data;
  })(),
  withEmptyColumns: (() => {
    const data = generateMockParsedData(10, 5);
    // Make a column empty
    data.rows.forEach((row) => {
      row["Column1"] = "";
    });
    return data;
  })(),
  withMissingData: (() => {
    const data = generateMockParsedData(10, 5);
    // Add rows with missing fields
    data.rows.push({ Column1: "incomplete" });
    return data;
  })(),
};

/**
 * Performance testing helper
 */
export function measureImportPerformance(
  callback: () => Promise<void>
): Promise<{ duration: number; success: boolean; error?: string }> {
  return new Promise(async (resolve) => {
    const start = performance.now();
    try {
      await callback();
      const duration = performance.now() - start;
      resolve({ duration, success: true });
    } catch (error) {
      const duration = performance.now() - start;
      resolve({
        duration,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });
}

/**
 * Memory usage monitoring (browser only)
 */
export function monitorMemoryUsage(
  callback: () => Promise<void>
): Promise<{
  duration: number;
  memoryUsed: number;
  success: boolean;
}> {
  return new Promise(async (resolve) => {
    if (!performance.memory) {
      resolve({ duration: 0, memoryUsed: 0, success: false });
      return;
    }

    const startMemory = performance.memory.usedJSHeapSize;
    const start = performance.now();

    try {
      await callback();

      const duration = performance.now() - start;
      const endMemory = performance.memory.usedJSHeapSize;
      const memoryUsed = endMemory - startMemory;

      resolve({ duration, memoryUsed, success: true });
    } catch (error) {
      resolve({ duration: 0, memoryUsed: 0, success: false });
    }
  });
}

/**
 * Test data generator for specific field types
 */
export const TEST_DATA_GENERATORS = {
  text: () => ["hello", "world", "test", "data"],
  number: () => ["123", "456", "789", "1000"],
  boolean: () => ["true", "false", "yes", "no"],
  date: () => ["2024-01-01", "2024-01-15", "2024-02-01"],
  email: () => [
    "user1@example.com",
    "user2@example.com",
    "user3@example.com",
  ],
  url: () => ["https://example.com", "https://test.com", "https://app.com"],
  phone: () => ["+1-555-0001", "+1-555-0002", "+1-555-0003"],
  mixed: () => [
    "text",
    "123",
    "true",
    "2024-01-01",
    "user@example.com",
  ],
};

/**
 * Generate test report
 */
export async function generateTestReport() {
  const report = {
    timestamp: new Date().toISOString(),
    scenarios: TEST_SCENARIOS,
    detectionTests: FIELD_DETECTION_SCENARIOS,
    validationTests: VALIDATION_SCENARIOS,
    tests: [] as any[],
  };

  // Test each scenario
  for (const [key, scenario] of Object.entries(TEST_SCENARIOS)) {
    const result = await measureImportPerformance(async () => {
      // Simulate processing
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    report.tests.push({
      scenario: key,
      ...result,
    });
  }

  return report;
}

/**
 * Mock collection for testing
 */
export const MOCK_COLLECTION = {
  id: "mock-collection-123",
  org_id: "mock-org-123",
  name: "Test Collection",
  schema: generateMockFields(5),
  created_at: new Date().toISOString(),
};

/**
 * Mock import log for testing
 */
export const MOCK_IMPORT_LOG = {
  id: "mock-import-123",
  user_id: "mock-user-123",
  org_id: "mock-org-123",
  collection_id: "mock-collection-123",
  filename: "test-file.xlsx",
  imported_rows: 100,
  failed_rows: 0,
  errors: [],
  warnings: [],
  status: "success",
  created_at: new Date().toISOString(),
  metadata: {},
};
