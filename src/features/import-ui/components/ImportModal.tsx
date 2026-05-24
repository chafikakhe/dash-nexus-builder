/**
 * Import Modal Component
 * Main orchestrator component for the entire import flow
 */

"use client";

import React, { useEffect, useState, useCallback } from "react";
import { ChevronLeft, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type {
  ImportModalProps,
  ImportStep,
} from "../types";
import { useImportFlow, useCollections, useImportAPI } from "../hooks";
import { DragDropUpload } from "./DragDropUpload";
import { FilePreviewTable } from "./FilePreviewTable";
import { CollectionSelector } from "./CollectionSelector";
import { CreateCollectionForm } from "./CreateCollectionForm";
import { ImportProgress } from "./ImportProgress";
import { ImportResults } from "./ImportResults";

const STEP_LABELS: Record<ImportStep, string> = {
  idle: "Upload File",
  uploading: "Uploading File",
  preview: "Preview Data",
  "collection-select": "Choose Collection",
  importing: "Importing Data",
  success: "Import Complete",
  error: "Import Failed",
};

const STEP_DESCRIPTIONS: Record<ImportStep, string> = {
  idle: "Select and upload your Excel or CSV file",
  uploading: "Processing your file...",
  preview: "Review your data before importing",
  "collection-select": "Choose where to import your data",
  importing: "Your data is being imported...",
  success: "Your import was successful!",
  error: "Something went wrong during import",
};

export const ImportModal: React.FC<ImportModalProps> = ({
  open,
  onOpenChange,
  orgId,
  userId,
  onImportSuccess,
  onImportError,
}) => {
  const importFlow = useImportFlow(orgId);
  const { collections, isLoading: collectionsLoading, refetch } = useCollections(orgId);
  const { executeImport, isLoading: apiLoading } = useImportAPI();

  const [showCreateForm, setShowCreateForm] = useState(false);

  // Load collections on mount
  useEffect(() => {
    if (open) {
      refetch();
    }
  }, [open, refetch]);

  // Handle file upload
  const handleFileUpload = useCallback(
    async (file: File) => {
      try {
        await importFlow.uploadFile(file);
      } catch (error) {
        const err = error instanceof Error ? error.message : String(error);
        toast.error(`Upload failed: ${err}`);
        onImportError?.({
          code: "UPLOAD_FAILED",
          message: err,
          recoverable: true,
        });
      }
    },
    [importFlow, onImportError]
  );

  // Handle collection selection
  const handleSelectCollection = useCallback(
    (collectionId: string) => {
      importFlow.selectCollection(collectionId);
      setShowCreateForm(false);
    },
    [importFlow]
  );

  // Handle create new collection
  const handleCreateNew = useCallback(() => {
    setShowCreateForm(true);
  }, []);

  // Handle create collection form submit
  const handleCreateCollectionSubmit = useCallback(
    async (input) => {
      try {
        importFlow.createNewCollection(input);
        setShowCreateForm(false);
      } catch (error) {
        const err = error instanceof Error ? error.message : String(error);
        toast.error(`Failed to create collection: ${err}`);
        onImportError?.({
          code: "COLLECTION_CREATE_FAILED",
          message: err,
          recoverable: true,
        });
      }
    },
    [importFlow, onImportError]
  );

  // Handle cancel create form
  const handleCancelCreateForm = useCallback(() => {
    setShowCreateForm(false);
  }, []);

  // Handle start import
  const handleStartImport = useCallback(async () => {
    try {
      if (!importFlow.state.parsedData || !importFlow.state.detectedFields) {
        throw new Error("Missing file data");
      }

      // Call API to execute import
      const result = await executeImport(
        orgId,
        userId,
        importFlow.state.selectedCollectionId,
        importFlow.state.newCollectionInput,
        importFlow.state.parsedData.rows,
        importFlow.state.detectedFields
      );

      // Update state with result
      await importFlow.startImport();

      // Show success
      toast.success(`Successfully imported ${result.importedRows} rows`);
      onImportSuccess?.(result.collectionId);
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      toast.error(`Import failed: ${err}`);
      onImportError?.({
        code: "IMPORT_FAILED",
        message: err,
        recoverable: true,
      });
    }
  }, [importFlow, orgId, userId, executeImport, onImportSuccess, onImportError]);

  // Handle modal close
  const handleClose = useCallback(() => {
    importFlow.reset();
    setShowCreateForm(false);
    onOpenChange(false);
  }, [importFlow, onOpenChange]);

  // Navigate to previous step
  const handlePreviousStep = useCallback(() => {
    const steps: ImportStep[] = [
      "idle",
      "preview",
      "collection-select",
      "importing",
    ];
    const currentIndex = steps.indexOf(importFlow.state.currentStep);
    if (currentIndex > 0) {
      importFlow.goToStep(steps[currentIndex - 1]);
      setShowCreateForm(false);
    }
  }, [importFlow]);

  const currentStep = importFlow.state.currentStep;
  const canGoBack =
    ["preview", "collection-select"].includes(currentStep) &&
    !importFlow.state.isLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <DialogHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {canGoBack && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handlePreviousStep}
                  disabled={importFlow.state.isLoading}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              )}
              <div>
                <DialogTitle className="text-xl">
                  {STEP_LABELS[currentStep]}
                </DialogTitle>
                <p className="text-sm text-gray-600 mt-1">
                  {STEP_DESCRIPTIONS[currentStep]}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleClose}
              disabled={importFlow.state.isLoading}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Progress indicator */}
          <div className="flex gap-2 pt-4">
            {["idle", "preview", "collection-select", "importing"].map(
              (step, idx) => (
                <div
                  key={step}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    idx <=
                    ["idle", "preview", "collection-select", "importing"].indexOf(
                      currentStep
                    )
                      ? "bg-blue-600"
                      : "bg-gray-200"
                  }`}
                />
              )
            )}
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="space-y-6 py-6">
          {/* Upload Step */}
          {currentStep === "idle" && (
            <div className="space-y-4">
              <DragDropUpload
                onFileSelect={handleFileUpload}
                onError={(error) => {
                  toast.error(error.message);
                }}
                isLoading={importFlow.state.isLoading}
              />

              <div className="flex justify-end pt-4 border-t border-gray-200">
                <Button
                  onClick={() => importFlow.goToStep("preview")}
                  disabled={!importFlow.state.file || importFlow.state.isLoading}
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {/* Preview Step */}
          {currentStep === "preview" && importFlow.state.parsedData && importFlow.state.detectedFields && (
            <div className="space-y-4">
              <FilePreviewTable
                data={importFlow.state.parsedData}
                detectedFields={importFlow.state.detectedFields}
                maxRows={10}
              />

              <div className="flex justify-between pt-4 border-t border-gray-200">
                <Button variant="outline" onClick={handlePreviousStep}>
                  Back
                </Button>
                <Button
                  onClick={() => importFlow.goToStep("collection-select")}
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          {/* Collection Selection Step */}
          {currentStep === "collection-select" && !showCreateForm && (
            <div className="space-y-4">
              <CollectionSelector
                collections={collections}
                selectedId={importFlow.state.selectedCollectionId}
                onSelect={handleSelectCollection}
                onCreateNew={handleCreateNew}
                isLoading={collectionsLoading}
              />

              <div className="flex justify-between pt-4 border-t border-gray-200">
                <Button variant="outline" onClick={handlePreviousStep}>
                  Back
                </Button>
                <Button
                  onClick={handleStartImport}
                  disabled={
                    !importFlow.state.selectedCollectionId &&
                    !importFlow.state.createNew
                  }
                >
                  Import
                </Button>
              </div>
            </div>
          )}

          {/* Create Collection Form */}
          {currentStep === "collection-select" && showCreateForm && (
            <CreateCollectionForm
              suggestedName={`Collection ${new Date().toLocaleDateString()}`}
              suggestedFields={importFlow.state.detectedFields || undefined}
              onSubmit={handleCreateCollectionSubmit}
              onCancel={handleCancelCreateForm}
              isLoading={apiLoading}
            />
          )}

          {/* Import Progress Step */}
          {currentStep === "importing" && (
            <ImportProgress
              progress={importFlow.state.importProgress}
              isVisible={true}
              showEstimatedTime={true}
            />
          )}

          {/* Success/Error Step */}
          {(currentStep === "success" || currentStep === "error") && (
            <ImportResults
              result={importFlow.state.importResult}
              error={importFlow.state.importError}
              onClose={handleClose}
              onRetry={handleStartImport}
              isLoading={apiLoading}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
