/**
 * Import Service Layer
 * Handles all Supabase operations for imports
 */

import { supabase } from "@/lib/supabase";
import { insertCollectionWithAccessCheck } from "@/lib/collections";
import type { Field } from "@/hooks/useCollections";
import type {
  FieldDetectionResult,
  ImportError,
  BatchInsertResponse,
  ImportLog,
} from "@/features/import/types";
import { normalizeValue } from "@/features/import/utils/fieldDetection";

/**
 * Create collection with auto-generated fields
 */
export async function createCollectionWithFields(
  orgId: string,
  userId: string,
  name: string,
  fields: FieldDetectionResult[]
): Promise<{ collectionId: string; fields: Field[] } | null> {
  try {
    const collection = await insertCollectionWithAccessCheck({
      orgId,
      userId,
      name,
      schema: fields.map((f) => ({
        name: f.name,
        type: f.type,
        required: f.required,
        config: f.config,
      })),
      source: "import",
    });

    if (!collection) {
      throw new Error("Collection creation returned no data");
    }

    return {
      collectionId: collection.id,
      fields: collection.schema || [],
    };
  } catch (error) {
    console.error("[import] Create collection with fields error:", error);
    throw error;
  }
}

/**
 * Get existing collection with fields
 */
export async function getCollectionWithFields(
  collectionId: string,
  orgId: string
): Promise<{ id: string; name: string; schema: Field[] } | null> {
  try {
    const { data, error } = await supabase
      .from("collections")
      .select("*")
      .eq("id", collectionId)
      .eq("org_id", orgId)
      .single();

    if (error) {
      console.error("[import] Get collection error:", error);
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      schema: data.schema || [],
    };
  } catch (error) {
    console.error("[import] Get collection error:", error);
    return null;
  }
}

/**
 * Add missing fields to collection
 */
export async function addMissingFields(
  collectionId: string,
  existingFields: Field[],
  newFields: FieldDetectionResult[]
): Promise<boolean> {
  try {
    // Filter out fields that already exist
    const fieldsToAdd = newFields.filter(
      (nf) => !existingFields.some((ef) => ef.name === nf.name)
    );

    if (fieldsToAdd.length === 0) {
      return true; // No new fields to add
    }

    // Combine existing and new fields
    const updatedSchema: Field[] = [
      ...existingFields,
      ...fieldsToAdd.map((f) => ({
        name: f.name,
        type: f.type,
        required: f.required,
        config: f.config,
      })),
    ];

    // Update collection schema
    const { error } = await supabase
      .from("collections")
      .update({ schema: updatedSchema })
      .eq("id", collectionId);

    if (error) {
      console.error("[import] Add fields error:", error);
      throw new Error(`Failed to add fields: ${error.message}`);
    }

    return true;
  } catch (error) {
    console.error("[import] Add missing fields error:", error);
    throw error;
  }
}

/**
 * Batch insert records with retry logic
 */
export async function batchInsertRecords(
  collectionId: string,
  orgId: string,
  records: Record<string, any>[],
  fieldSchema: Field[],
  batchSize: number = 100,
  onProgress?: (progress: { processed: number; total: number; errors: ImportError[] }) => void
): Promise<BatchInsertResponse> {
  const response: BatchInsertResponse = {
    successful: 0,
    failed: 0,
    errors: [],
    insertedIds: [],
  };

  // Normalize values according to field types
  const fieldMap = new Map(fieldSchema.map((f) => [f.name, f.type]));

  const normalizedRecords = records.map((record) => {
    const normalized: Record<string, any> = {};
    for (const [key, value] of Object.entries(record)) {
      const fieldType = fieldMap.get(key) || "text";
      normalized[key] = normalizeValue(value, fieldType);
    }
    return normalized;
  });

  // Process in batches
  for (let i = 0; i < normalizedRecords.length; i += batchSize) {
    const batch = normalizedRecords.slice(i, i + batchSize);

    try {
      const { data, error } = await supabase
        .from("collection_records")
        .insert(
          batch.map((data) => ({
            collection_id: collectionId,
            org_id: orgId,
            data,
          }))
        )
        .select("id");

      console.log("[import] Supabase batch insert response", {
        batchStart: i,
        batchSize: batch.length,
        data,
        error,
      });

      if (error) {
        console.error("[import] Batch insert error:", error);

        // If batch fails, try inserting one by one
        for (let j = 0; j < batch.length; j++) {
          const rowIndex = i + j;
          const record = batch[j];

          try {
            const { data: inserted, error: singleError } = await supabase
              .from("collection_records")
              .insert({
                collection_id: collectionId,
                org_id: orgId,
                data: record,
              })
              .select("id")
              .single();

            console.log("[import] Supabase single insert response", {
              rowIndex,
              inserted,
              error: singleError,
            });

            if (singleError) {
              response.failed++;
              response.errors.push({
                rowIndex,
                rowData: records[rowIndex],
                errorMessage: singleError.message,
              });
            } else {
              response.successful++;
              if (inserted) {
                response.insertedIds.push(inserted.id);
              }
            }
          } catch (e: any) {
            response.failed++;
            response.errors.push({
              rowIndex,
              rowData: records[rowIndex],
              errorMessage: e.message || "Unknown error",
            });
          }
        }
      } else {
        response.successful += batch.length;
        if (data) {
          response.insertedIds.push(...data.map((d: any) => d.id));
        }
      }
    } catch (error: any) {
      console.error("[import] Batch processing error:", error);

      // Count batch as failed
      for (let j = 0; j < batch.length; j++) {
        response.failed++;
        response.errors.push({
          rowIndex: i + j,
          rowData: records[i + j],
          errorMessage: error.message || "Unknown error",
        });
      }
    }

    // Report progress
    if (onProgress) {
      onProgress({
        processed: Math.min(i + batchSize, normalizedRecords.length),
        total: normalizedRecords.length,
        errors: response.errors,
      });
    }
  }

  return response;
}

/**
 * Log import to database
 */
export async function logImport(
  userId: string,
  orgId: string,
  collectionId: string,
  filename: string,
  result: {
    importedRows: number;
    failedRows: number;
    errors: ImportError[];
    warnings: string[];
  }
): Promise<ImportLog | null> {
  try {
    const { data, error } = await supabase
      .from("imports")
      .insert({
        user_id: userId,
        org_id: orgId,
        collection_id: collectionId,
        filename,
        imported_rows: result.importedRows,
        failed_rows: result.failedRows,
        errors: result.errors,
        warnings: result.warnings,
        status: result.failedRows === 0 ? "success" : "partial",
      })
      .select("*")
      .single();

    if (error) {
      console.error("[import] Log import error:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("[import] Log import error:", error);
    return null;
  }
}

/**
 * Get import logs
 */
export async function getImportLogs(
  orgId: string,
  limit: number = 50
): Promise<ImportLog[]> {
  try {
    const { data, error } = await supabase
      .from("imports")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[import] Get import logs error:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("[import] Get import logs error:", error);
    return [];
  }
}

/**
 * Get import details
 */
export async function getImportDetails(importId: string): Promise<ImportLog | null> {
  try {
    const { data, error } = await supabase
      .from("imports")
      .select("*")
      .eq("id", importId)
      .single();

    if (error) {
      console.error("[import] Get import details error:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("[import] Get import details error:", error);
    return null;
  }
}

/**
 * Check for duplicate imports
 */
export async function checkDuplicateImport(
  collectionId: string,
  filename: string,
  daysBack: number = 1
): Promise<ImportLog | null> {
  try {
    const since = new Date();
    since.setDate(since.getDate() - daysBack);

    const { data, error } = await supabase
      .from("imports")
      .select("*")
      .eq("collection_id", collectionId)
      .eq("filename", filename)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("[import] Check duplicate error:", error);
    }

    return data || null;
  } catch (error) {
    console.error("[import] Check duplicate error:", error);
    return null;
  }
}

/**
 * Get collection records after import
 */
export async function getCollectionRecordsAfterImport(
  collectionId: string,
  limit: number = 1000
): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from("collection_records")
      .select("*")
      .eq("collection_id", collectionId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[import] Get records error:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("[import] Get records error:", error);
    return [];
  }
}

/**
 * Delete records for failed import
 */
export async function deleteImportedRecords(
  collectionId: string,
  recordIds: string[]
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("collection_records")
      .delete()
      .in("id", recordIds)
      .eq("collection_id", collectionId);

    if (error) {
      console.error("[import] Delete records error:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[import] Delete records error:", error);
    return false;
  }
}

/**
 * Verify collection access
 */
export async function verifyCollectionAccess(
  collectionId: string,
  orgId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("collections")
      .select("id")
      .eq("id", collectionId)
      .eq("org_id", orgId)
      .single();

    if (error) {
      console.error("[import] Verify access error:", error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error("[import] Verify access error:", error);
    return false;
  }
}

/**
 * Get import statistics for organization
 */
export async function getImportStatistics(orgId: string): Promise<{
  totalImports: number;
  totalRecordsImported: number;
  successfulImports: number;
  failedImports: number;
  averageRowsPerImport: number;
}> {
  try {
    const { data, error } = await supabase
      .from("imports")
      .select("imported_rows, failed_rows, status")
      .eq("org_id", orgId);

    if (error) {
      console.error("[import] Get stats error:", error);
      return {
        totalImports: 0,
        totalRecordsImported: 0,
        successfulImports: 0,
        failedImports: 0,
        averageRowsPerImport: 0,
      };
    }

    const imports = data || [];
    const totalImports = imports.length;
    const totalRecordsImported = imports.reduce((sum, i) => sum + (i.imported_rows || 0), 0);
    const successfulImports = imports.filter((i) => i.status === "success").length;
    const failedImports = imports.filter((i) => i.status === "failed").length;
    const averageRowsPerImport = totalImports > 0 ? totalRecordsImported / totalImports : 0;

    return {
      totalImports,
      totalRecordsImported,
      successfulImports,
      failedImports,
      averageRowsPerImport,
    };
  } catch (error) {
    console.error("[import] Get stats error:", error);
    return {
      totalImports: 0,
      totalRecordsImported: 0,
      successfulImports: 0,
      failedImports: 0,
      averageRowsPerImport: 0,
    };
  }
}
