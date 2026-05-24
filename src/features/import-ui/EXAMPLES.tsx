/**
 * Import UI System - Practical Usage Examples
 * Real-world integration patterns for the import system
 */

"use client";

import React, { useState, useCallback } from "react";
import { ImportButton, ImportModal, useImportFlow, useCollections } from "@/features/import-ui";
import { toast } from "sonner";

// ==================== Example 1: Simple Import Button ====================
/**
 * Minimal integration - just add a button to trigger import
 * Perfect for quick integration into existing pages
 */
export function SimpleImportExample() {
  return (
    <div className="p-6 space-y-4">
      <h2 className="text-2xl font-bold">Basic Import</h2>
      <p className="text-gray-600">
        Click the button below to import Excel/CSV files into your collections
      </p>

      <ImportButton
        orgId="your-org-id"
        userId="your-user-id"
        onImportSuccess={(collectionId) => {
          toast.success(`Data imported successfully to collection ${collectionId}`);
          // Refresh collection data here
        }}
        onImportError={(error) => {
          toast.error(`Import failed: ${error.message}`);
        }}
      />
    </div>
  );
}

// ==================== Example 2: Custom Modal Control ====================
/**
 * Full control over modal state
 * Useful when you need to coordinate with other components
 */
export function CustomModalExample() {
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [lastImport, setLastImport] = useState<string | null>(null);

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-2xl font-bold">Custom Import Control</h2>

      <div className="space-y-2">
        <button
          onClick={() => setIsImportOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Open Import Dialog
        </button>

        {lastImport && (
          <p className="text-sm text-green-600">
            ✓ Last import: Collection {lastImport}
          </p>
        )}
      </div>

      <ImportModal
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        orgId="your-org-id"
        userId="your-user-id"
        onImportSuccess={(collectionId) => {
          setLastImport(collectionId);
          setIsImportOpen(false);
          toast.success("Import completed!");
        }}
      />
    </div>
  );
}

// ==================== Example 3: Collections Manager with Import ====================
/**
 * Full-featured collections page with import integration
 * Shows how to display and manage collections with import
 */
export function CollectionsManagerExample() {
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);

  const { collections, isLoading, refetch } = useCollections("your-org-id");

  const handleImportSuccess = useCallback(
    async (collectionId: string) => {
      setIsImportOpen(false);
      await refetch();
      setSelectedCollectionId(collectionId);
      toast.success("Data imported successfully!");
    },
    [refetch]
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Collections</h1>
        <button
          onClick={() => setIsImportOpen(true)}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
        >
          <span>📥</span>
          Import Data
        </button>
      </div>

      {isLoading ? (
        <p className="text-gray-600">Loading collections...</p>
      ) : collections.length === 0 ? (
        <div className="p-8 rounded-lg border-2 border-dashed border-gray-300 text-center">
          <p className="text-gray-600 mb-4">No collections yet</p>
          <button
            onClick={() => setIsImportOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create First Collection via Import
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {collections.map((collection) => (
            <div
              key={collection.id}
              onClick={() => setSelectedCollectionId(collection.id)}
              className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                selectedCollectionId === collection.id
                  ? "border-blue-600 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <h3 className="font-semibold text-lg">{collection.name}</h3>
              <p className="text-sm text-gray-600 mt-1">
                {collection.fieldCount} fields • {collection.recordCount} records
              </p>
              {collection.description && (
                <p className="text-sm text-gray-500 mt-2">{collection.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <ImportModal
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        orgId="your-org-id"
        userId="your-user-id"
        onImportSuccess={handleImportSuccess}
      />
    </div>
  );
}

// ==================== Example 4: Manual Flow Control ====================
/**
 * Fine-grained control over each step of the import process
 * Useful for custom workflows or integrations
 */
export function ManualFlowExample() {
  const importFlow = useImportFlow("your-org-id");
  const [customMessage, setCustomMessage] = useState("");

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;

    try {
      await importFlow.uploadFile(file);
      setCustomMessage(`Uploaded ${file.name}`);
    } catch (error) {
      setCustomMessage(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const handleSelectCollection = (collectionId: string) => {
    importFlow.selectCollection(collectionId);
    setCustomMessage(`Selected collection: ${collectionId}`);
  };

  const handleStartImport = async () => {
    try {
      await importFlow.startImport();
      setCustomMessage("Import completed!");
    } catch (error) {
      setCustomMessage(`Import error: ${error instanceof Error ? error.message : "Unknown"}`);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold">Manual Import Control</h2>

      {/* Step 1: Upload */}
      <div className="space-y-3">
        <h3 className="font-semibold">Step 1: Upload File</h3>
        <input
          type="file"
          accept=".xlsx,.csv"
          onChange={handleUpload}
          disabled={importFlow.state.isLoading}
          className="block w-full"
        />
        {importFlow.state.file && (
          <p className="text-sm text-green-600">✓ {importFlow.state.file.name}</p>
        )}
      </div>

      {/* Step 2: Preview */}
      {importFlow.state.parsedData && importFlow.state.detectedFields && (
        <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold">Step 2: Data Preview</h3>
          <p className="text-sm text-gray-600">
            Found {importFlow.state.detectedFields.length} fields in{" "}
            {importFlow.state.parsedData.rowCount} rows
          </p>
          <ul className="space-y-1">
            {importFlow.state.detectedFields.slice(0, 5).map((field) => (
              <li key={field.name} className="text-sm text-gray-700">
                • {field.displayName} ({field.type})
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Step 3: Select Collection */}
      {importFlow.state.parsedData && (
        <div className="space-y-3">
          <h3 className="font-semibold">Step 3: Select Collection</h3>
          <div className="space-y-2">
            <button
              onClick={() => handleSelectCollection("collection-1")}
              className="w-full p-3 text-left border rounded-lg hover:bg-gray-50"
            >
              Collection 1
            </button>
            <button
              onClick={() => handleSelectCollection("collection-2")}
              className="w-full p-3 text-left border rounded-lg hover:bg-gray-50"
            >
              Collection 2
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Import */}
      {importFlow.state.selectedCollectionId && (
        <button
          onClick={handleStartImport}
          disabled={importFlow.state.isImporting}
          className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
        >
          {importFlow.state.isImporting ? "Importing..." : "Start Import"}
        </button>
      )}

      {/* Progress/Result */}
      {importFlow.state.isImporting && (
        <div className="p-4 bg-blue-50 rounded-lg">
          <p className="text-sm font-semibold text-blue-900">
            {Math.round(importFlow.state.importProgress.percentage)}% complete
          </p>
        </div>
      )}

      {importFlow.state.importResult && (
        <div className="p-4 bg-green-50 rounded-lg">
          <p className="text-sm font-semibold text-green-900">
            ✓ Successfully imported{" "}
            {importFlow.state.importResult.importedRows} rows
          </p>
        </div>
      )}

      {importFlow.state.importError && (
        <div className="p-4 bg-red-50 rounded-lg">
          <p className="text-sm font-semibold text-red-900">
            ✗ {importFlow.state.importError.message}
          </p>
        </div>
      )}

      {/* Status message */}
      {customMessage && (
        <div className="p-3 bg-gray-100 rounded-lg text-sm">
          {customMessage}
        </div>
      )}

      {/* Reset button */}
      <button
        onClick={() => {
          importFlow.reset();
          setCustomMessage("");
        }}
        className="w-full px-4 py-2 border rounded-lg hover:bg-gray-50"
      >
        Reset
      </button>
    </div>
  );
}

// ==================== Example 5: Batch Import Processor ====================
/**
 * Process multiple files in sequence
 * Useful for bulk operations
 */
export function BatchImportExample() {
  const [files, setFiles] = useState<File[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<
    { fileName: string; status: "pending" | "success" | "error"; message: string }[]
  >([]);

  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.currentTarget.files || []);
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const handleClearFiles = () => {
    setFiles([]);
    setResults([]);
    setCurrentIndex(0);
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold">Batch Import</h2>

      <div className="space-y-3">
        <h3 className="font-semibold">Select Files to Import</h3>
        <input
          type="file"
          multiple
          accept=".xlsx,.csv"
          onChange={handleAddFiles}
          className="block w-full"
        />
      </div>

      {files.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold">
            Files to Import ({files.length})
          </h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {files.map((file, idx) => (
              <div
                key={idx}
                className="p-3 bg-gray-50 rounded-lg flex items-center justify-between"
              >
                <span className="text-sm">{file.name}</span>
                <span className="text-xs text-gray-500">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={handleClearFiles}
            className="text-sm text-red-600 hover:text-red-700"
          >
            Clear all
          </button>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold">Import Results</h3>
          <div className="space-y-2">
            {results.map((result, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg text-sm ${
                  result.status === "success"
                    ? "bg-green-50 text-green-900"
                    : result.status === "error"
                    ? "bg-red-50 text-red-900"
                    : "bg-gray-50 text-gray-900"
                }`}
              >
                <p className="font-semibold">{result.fileName}</p>
                <p className="text-xs mt-1">{result.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== Example 6: Full Dashboard Integration ====================
/**
 * Complete collections dashboard with import, view, and manage features
 */
export function DashboardExample() {
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const { collections, refetch } = useCollections("your-org-id");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Collections</h1>
            <p className="text-gray-600 mt-1">
              Manage your data collections
            </p>
          </div>
          <button
            onClick={() => setIsImportOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold flex items-center gap-2"
          >
            <span>📥</span>
            Import Data
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {collections.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">No collections yet</p>
            <p className="text-gray-500 text-sm mt-2">
              Import your first data file to get started
            </p>
          </div>
        ) : (
          <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-3"}>
            {collections.map((collection) => (
              <div
                key={collection.id}
                className="bg-white rounded-lg border border-gray-200 hover:shadow-lg transition-shadow"
              >
                <div className="p-6">
                  <h3 className="font-semibold text-lg text-gray-900">
                    {collection.name}
                  </h3>
                  {collection.description && (
                    <p className="text-sm text-gray-600 mt-2">
                      {collection.description}
                    </p>
                  )}
                  <div className="flex gap-4 mt-4 pt-4 border-t border-gray-200 text-sm text-gray-600">
                    <span>{collection.fieldCount} fields</span>
                    <span>•</span>
                    <span>{collection.recordCount} records</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Import Modal */}
      <ImportModal
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        orgId="your-org-id"
        userId="your-user-id"
        onImportSuccess={() => {
          setIsImportOpen(false);
          refetch();
          toast.success("Data imported successfully!");
        }}
      />
    </div>
  );
}

// ==================== Export Examples ====================

export const EXAMPLES = {
  SimpleImportExample,
  CustomModalExample,
  CollectionsManagerExample,
  ManualFlowExample,
  BatchImportExample,
  DashboardExample,
};
