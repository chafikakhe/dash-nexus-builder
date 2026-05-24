/**
 * File Parsing Utilities
 * Handles Excel (.xlsx) and CSV file parsing
 */

import * as XLSX from "xlsx";
import type { ParsedFileData } from "../types";

/**
 * Maximum file size (10MB)
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Maximum rows to import
 */
export const MAX_ROWS = 50000;

/**
 * Allowed file types
 */
export const ALLOWED_FILE_TYPES = [".xlsx", ".xls", ".csv", ".txt"];

/**
 * Validate file before parsing
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: "No file provided" };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` };
  }

  // Check file type
  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  if (!ALLOWED_FILE_TYPES.includes(ext)) {
    return {
      valid: false,
      error: `Unsupported file type. Allowed: ${ALLOWED_FILE_TYPES.join(", ")}`,
    };
  }

  return { valid: true };
}

/**
 * Parse Excel file (.xlsx, .xls)
 */
export async function parseExcelFile(file: File): Promise<ParsedFileData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result as ArrayBuffer;
        const workbook = XLSX.read(data, { type: "array" });

        // Get first sheet
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          reject(new Error("No sheets found in workbook"));
          return;
        }

        const sheet = workbook.Sheets[sheetName];
        if (!sheet) {
          reject(new Error("Unable to read sheet"));
          return;
        }

        // Convert sheet to JSON
        const jsonData = XLSX.utils.sheet_to_json(sheet, {
          header: "A",
          defval: "",
        }) as Record<string, any>[];

        if (jsonData.length === 0) {
          reject(new Error("No data found in sheet"));
          return;
        }

        // Extract headers from first row
        const firstRow = jsonData[0];
        const headers = Object.values(firstRow)
          .map((val) => String(val || "").trim())
          .filter((val) => val.length > 0);

        if (headers.length === 0) {
          reject(new Error("No headers found in first row"));
          return;
        }

        // Map data to named columns
        const rows = jsonData.slice(1).map((row) => {
          const mappedRow: Record<string, any> = {};
          headers.forEach((header, index) => {
            const key = Object.keys(row)[index] || String.fromCharCode(65 + index);
            mappedRow[header] = row[key] ?? "";
          });
          return mappedRow;
        });

        // Filter out completely empty rows
        const filteredRows = rows.filter(
          (row) => Object.values(row).some((val) => val !== null && val !== undefined && val !== "")
        );

        if (filteredRows.length > MAX_ROWS) {
          reject(new Error(`File contains more than ${MAX_ROWS} rows`));
          return;
        }

        resolve({
          headers,
          rows: filteredRows,
          filename: file.name,
          rowCount: filteredRows.length,
        });
      } catch (error) {
        reject(new Error(`Failed to parse Excel: ${error instanceof Error ? error.message : "Unknown error"}`));
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Parse CSV file
 */
export async function parseCSVFile(file: File): Promise<ParsedFileData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const csv = e.target?.result as string;

        if (!csv) {
          reject(new Error("No data in file"));
          return;
        }

        // Parse CSV using XLSX (more robust than manual parsing)
        const workbook = XLSX.read(csv, { type: "string" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];

        if (!sheet) {
          reject(new Error("Unable to parse CSV"));
          return;
        }

        const jsonData = XLSX.utils.sheet_to_json(sheet, {
          defval: "",
        }) as Record<string, any>[];

        if (jsonData.length === 0) {
          reject(new Error("No data found in CSV"));
          return;
        }

        // Get headers from first row keys
        const headers = Object.keys(jsonData[0]).filter((h) => h.trim().length > 0);

        if (headers.length === 0) {
          reject(new Error("No headers found in CSV"));
          return;
        }

        // Filter out completely empty rows
        const rows = jsonData.filter(
          (row) => Object.values(row).some((val) => val !== null && val !== undefined && val !== "")
        );

        if (rows.length > MAX_ROWS) {
          reject(new Error(`File contains more than ${MAX_ROWS} rows`));
          return;
        }

        resolve({
          headers,
          rows,
          filename: file.name,
          rowCount: rows.length,
        });
      } catch (error) {
        reject(new Error(`Failed to parse CSV: ${error instanceof Error ? error.message : "Unknown error"}`));
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    reader.readAsText(file);
  });
}

/**
 * Parse file automatically based on type
 */
export async function parseFile(file: File): Promise<ParsedFileData> {
  // Validate first
  const validation = validateFile(file);
  if (!validation.valid) {
    throw new Error(validation.error || "Invalid file");
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "";

  // Parse based on type
  if (ext === "csv" || ext === "txt") {
    return parseCSVFile(file);
  }

  if (ext === "xlsx" || ext === "xls") {
    return parseExcelFile(file);
  }

  throw new Error(`Unsupported file type: ${ext}`);
}

/**
 * Convert parsed data to CSV string
 */
export function convertToCSV(
  headers: string[],
  rows: Record<string, any>[]
): string {
  // Escape CSV values
  const escapeCSV = (value: any): string => {
    const str = String(value ?? "");
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // Header row
  const headerRow = headers.map(escapeCSV).join(",");

  // Data rows
  const dataRows = rows
    .map((row) => headers.map((header) => escapeCSV(row[header] ?? "")).join(","))
    .join("\n");

  return `${headerRow}\n${dataRows}`;
}

/**
 * Export collection data to Excel
 */
export function exportToExcel(
  filename: string,
  headers: string[],
  rows: Record<string, any>[]
): void {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: headers,
  });

  XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

/**
 * Get sample of rows from parsed data
 */
export function getSampleRows(data: ParsedFileData, sampleSize: number = 5): Record<string, any>[] {
  return data.rows.slice(0, Math.min(sampleSize, data.rows.length));
}

/**
 * Validate headers
 */
export function validateHeaders(headers: string[]): { valid: boolean; error?: string } {
  if (!headers || headers.length === 0) {
    return { valid: false, error: "No headers found" };
  }

  if (headers.some((h) => !h || typeof h !== "string" || h.trim().length === 0)) {
    return { valid: false, error: "Headers contain empty values" };
  }

  // Check for duplicate headers
  const headerSet = new Set(headers);
  if (headerSet.size !== headers.length) {
    return { valid: false, error: "Duplicate headers found" };
  }

  return { valid: true };
}

/**
 * Get file extension
 */
export function getFileExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() || "";
}

/**
 * Is Excel file
 */
export function isExcelFile(filename: string): boolean {
  const ext = getFileExtension(filename);
  return ["xlsx", "xls"].includes(ext);
}

/**
 * Is CSV file
 */
export function isCSVFile(filename: string): boolean {
  const ext = getFileExtension(filename);
  return ["csv", "txt"].includes(ext);
}
