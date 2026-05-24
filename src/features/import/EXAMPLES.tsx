/**
 * Complete Import System Integration Example
 * Shows real-world usage patterns and integration
 */

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCollections, useCollectionRecords } from "@/hooks/useCollections";
import {
  ImportModal,
  DynamicCollectionTable,
  ImportHistory,
  useImport,
  detectFields,
  formatFileSize,
  formatImportResultMessage,
} from "@/features/import";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";

/**
 * Example 1: Basic Import Integration
 */
export function BasicImportExample() {
  const [importOpen, setImportOpen] = useState(false);
  const { currentOrgId, user } = useAuth();
  const { collections } = useCollections();

  if (!currentOrgId || !user) return null;

  return (
    <div className="space-y-4">
      <Button
        onClick={() => setImportOpen(true)}
        className="gap-2"
      >
        <Upload className="h-4 w-4" />
        Import Data
      </Button>

      <ImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        orgId={currentOrgId}
        userId={user.id}
        collections={collections}
        onImportSuccess={(collectionId) => {
          toast.success("Data imported successfully!");
        }}
      />
    </div>
  );
}

/**
 * Example 2: Full Collections Manager with Import
 */
export function FullCollectionsManager() {
  const [importOpen, setImportOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);

  const { currentOrgId, user } = useAuth();
  const { collections, loading: collectionsLoading, createCollection } = useCollections();
  const { records, loading: recordsLoading, updateRecord } = useCollectionRecords(
    selectedCollectionId,
    currentOrgId
  );

  const activeCollection = collections.find((c) => c.id === selectedCollectionId);

  // Auto-select first collection
  useEffect(() => {
    if (!selectedCollectionId && collections.length > 0) {
      setSelectedCollectionId(collections[0].id);
    }
  }, [collections, selectedCollectionId]);

  if (!currentOrgId || !user) return null;

  return (
    <div className="space-y-6 p-6">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Collections</h1>
        <div className="flex gap-2">
          <Button
            onClick={() => setImportOpen(true)}
            variant="default"
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            Import
          </Button>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Import Modal */}
      <ImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        orgId={currentOrgId}
        userId={user.id}
        collections={collections}
        onImportSuccess={(collectionId) => {
          setSelectedCollectionId(collectionId);
          toast.success("Data imported successfully!");
        }}
      />

      {/* Collections Tabs */}
      <Tabs
        value={selectedCollectionId || ""}
        onValueChange={setSelectedCollectionId}
      >
        <TabsList>
          {collections.map((collection) => (
            <TabsTrigger key={collection.id} value={collection.id}>
              {collection.name}
              <span className="ml-2 text-xs text-muted-foreground">
                ({records.length})
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {activeCollection && (
          <TabsContent value={activeCollection.id} className="space-y-4">
            {/* Search Bar */}
            <div className="flex gap-2">
              <Input
                placeholder="Search records..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={() => {
                  // Refresh data
                }}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            {/* Data Table */}
            <Card>
              <div className="overflow-hidden">
                <DynamicCollectionTable
                  records={records}
                  fields={activeCollection.schema}
                  searchQuery={searchQuery}
                  isLoading={recordsLoading}
                  onCellChange={(recordId, fieldName, value) => {
                    updateRecord(recordId, { [fieldName]: value });
                  }}
                  pageSize={50}
                />
              </div>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Total Records</p>
                <p className="text-2xl font-bold">{records.length}</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Fields</p>
                <p className="text-2xl font-bold">{activeCollection.schema.length}</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Last Updated</p>
                <p className="text-sm font-mono">
                  {new Date(activeCollection.created_at).toLocaleDateString()}
                </p>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Import History */}
      {currentOrgId && (
        <Card className="p-4">
          <h3 className="font-semibold mb-4">Recent Imports</h3>
          <ImportHistory orgId={currentOrgId} limit={5} />
        </Card>
      )}
    </div>
  );
}

/**
 * Example 3: Advanced Import with Progress Tracking
 */
export function AdvancedImportWithProgress() {
  const [importOpen, setImportOpen] = useState(false);
  const [progressMessage, setProgressMessage] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);

  const { currentOrgId, user } = useAuth();
  const { collections } = useCollections();
  const { state, handleFileUpload, executeImport, updateConfig } = useImport();

  const handleImportWithProgress = async (file: File) => {
    try {
      // Parse file
      await handleFileUpload(file);
      setProgressMessage("File parsed, detecting fields...");
      setProgressPercent(25);

      // Wait a moment for fields to be detected
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Execute import with progress tracking
      if (!currentOrgId || !user) return;

      const config = {
        createNewCollection: true,
        collectionName: file.name.replace(/\.[^/.]+$/, ""),
        skipFirstRow: false,
        fieldMappings: {},
        validateBeforeImport: true,
        batchSize: 100,
      };

      updateConfig(config);

      const result = await executeImport(
        currentOrgId,
        user.id,
        config,
        (progress) => {
          setProgressMessage(`Importing: ${progress.message}`);
          setProgressPercent(progress.percentage);
        }
      );

      if (result) {
        setProgressMessage(formatImportResultMessage(result));
        setProgressPercent(100);
        toast.success("Import completed!");
      }
    } catch (error) {
      toast.error("Import failed");
      setProgressMessage("Error occurred during import");
    }
  };

  if (!currentOrgId || !user) return null;

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Advanced Import</h2>

        <div className="space-y-4">
          {/* File Input */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Select File
            </label>
            <input
              type="file"
              accept=".xlsx,.csv"
              onChange={(e) => {
                const file = e.currentTarget.files?.[0];
                if (file) handleImportWithProgress(file);
              }}
              className="block w-full"
            />
          </div>

          {/* Detected Fields */}
          {state.detectedFields.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Detected Fields ({state.detectedFields.length})
              </label>
              <div className="grid grid-cols-2 gap-2">
                {state.detectedFields.map((field) => (
                  <div key={field.name} className="p-2 bg-secondary rounded text-sm">
                    <p className="font-medium">{field.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {field.type}{" "}
                      ({Math.round(field.detectionConfidence * 100)}%)
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Progress */}
          {progressPercent > 0 && (
            <div className="space-y-2">
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground">{progressMessage}</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

/**
 * Example 4: Import with Custom Validation
 */
export function ImportWithCustomValidation() {
  const { currentOrgId, user } = useAuth();
  const { collections } = useCollections();
  const { state, handleFileUpload } = useImport();
  const [validationResults, setValidationResults] = useState<any>(null);

  const handleFileWithValidation = async (file: File) => {
    try {
      await handleFileUpload(file);

      if (!state.previewData) return;

      // Custom validation
      const warnings: string[] = [];
      const errors: string[] = [];

      // Check for empty columns
      for (const header of state.previewData.headers) {
        const values = state.previewData.rows.map((r) => r[header]);
        const emptyCount = values.filter((v) => !v).length;
        const emptyPercent = (emptyCount / values.length) * 100;

        if (emptyPercent > 50) {
          warnings.push(`Column "${header}" is more than 50% empty`);
        }
      }

      // Check for suspicious data
      if (state.previewData.rowCount > 100000) {
        warnings.push("Large dataset detected - import may take several minutes");
      }

      setValidationResults({
        isValid: errors.length === 0,
        errors,
        warnings,
      });

      if (!validationResults?.isValid) {
        toast.error("Validation failed");
      } else if (warnings.length > 0) {
        toast.warning(`${warnings.length} warnings found`);
      } else {
        toast.success("Validation passed!");
      }
    } catch (error) {
      toast.error("Validation error");
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Import with Validation</h2>

        <input
          type="file"
          accept=".xlsx,.csv"
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            if (file) handleFileWithValidation(file);
          }}
          className="block w-full"
        />

        {validationResults && (
          <div className="mt-4 space-y-2">
            {validationResults.errors.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-900">
                <p className="font-semibold">Errors:</p>
                <ul className="text-sm">
                  {validationResults.errors.map((e: string, i: number) => (
                    <li key={i}>- {e}</li>
                  ))}
                </ul>
              </div>
            )}

            {validationResults.warnings.length > 0 && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-900">
                <p className="font-semibold">Warnings:</p>
                <ul className="text-sm">
                  {validationResults.warnings.map((w: string, i: number) => (
                    <li key={i}>- {w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

/**
 * Example 5: Import Statistics Dashboard
 */
export function ImportStatisticsDashboard() {
  const { currentOrgId } = useAuth();

  if (!currentOrgId) return null;

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-4">Import Statistics</h2>
      <ImportHistory orgId={currentOrgId} limit={20} />
    </Card>
  );
}

/**
 * Default Export: Full Integration Component
 */
export default FullCollectionsManager;
