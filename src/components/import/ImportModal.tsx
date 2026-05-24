/**
 * Import Modal Component
 * Main UI for file upload and import
 */

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, Upload, File, Loader2, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useImport } from "@/hooks/useImport";
import { toast } from "sonner";
import type { ImportConfig } from "@/features/import/types";
import type { Collection } from "@/hooks/useCollections";

interface ImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  userId: string;
  collections: Collection[];
  onImportSuccess?: (collectionId: string) => void;
}

export function ImportModal({
  open,
  onOpenChange,
  orgId,
  userId,
  collections,
  onImportSuccess,
}: ImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>("");
  const [newCollectionName, setNewCollectionName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { state, handleFileUpload, executeImport, updateConfig, reset } = useImport();
  const parsedRowsCount = state.previewData?.rows.length ?? 0;

  const isLoading =
    isSubmitting ||
    state.progress.status === "parsing" ||
    state.progress.status === "validating" ||
    state.progress.status === "importing";

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await handleFileUpload(files[0]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files && files.length > 0) {
      await handleFileUpload(files[0]);
    }
  };

  const handleImport = async () => {
    setIsSubmitting(true);

    try {
      const config: ImportConfig = {
        createNewCollection: state.config.createNewCollection,
        skipFirstRow: state.config.skipFirstRow,
        fieldMappings: {},
        validateBeforeImport: true,
        batchSize: 100,
      };

      if (config.createNewCollection) {
        config.collectionName = newCollectionName;
      } else {
        config.collectionId = selectedCollectionId;
      }

      updateConfig(config);

      const result = await executeImport(orgId, userId, config);

      if (result?.success) {
        onImportSuccess?.(result.collectionId);
        setTimeout(() => {
          onOpenChange(false);
          reset();
        }, 1500);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import failed";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onOpenChange(false);
      reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Data</DialogTitle>
          <DialogDescription>
            Upload Excel or CSV files to import data into your collection
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* File Upload Area */}
          {!state.fileSelected ? (
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                "hover:border-primary/50 hover:bg-primary/5 cursor-pointer"
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="font-medium">Drag and drop your file here</p>
              <p className="text-sm text-muted-foreground">or click to browse</p>
              <p className="text-xs text-muted-foreground mt-2">
                Supported: Excel (.xlsx), CSV (.csv)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.txt"
                onChange={handleFileSelect}
                className="hidden"
                disabled={isLoading}
              />
            </div>
          ) : (
            <div className="space-y-4">
              {/* File Info */}
              <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
                <File className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{state.fileName}</p>
                  {state.previewData && (
                    <p className="text-xs text-muted-foreground">
                      {state.previewData.rowCount} rows,{" "}
                      {state.previewData.headers.length} columns
                    </p>
                  )}
                </div>
                {!isLoading && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      reset();
                      fileInputRef.current?.click();
                    }}
                  >
                    Change
                  </Button>
                )}
              </div>

              {/* Collection Selection */}
              {state.progress.status === "idle" && (
                <div className="space-y-3">
                  <Label>Destination Collection</Label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        id="existing"
                        checked={!state.config.createNewCollection}
                        onChange={() => updateConfig({ createNewCollection: false })}
                        disabled={isLoading || collections.length === 0}
                      />
                      <Label htmlFor="existing" className="font-normal cursor-pointer">
                        Use existing collection
                      </Label>
                    </div>

                    {!state.config.createNewCollection && (
                      <Select
                        value={selectedCollectionId}
                        onValueChange={(v) => {
                          setSelectedCollectionId(v);
                          updateConfig({ collectionId: v });
                        }}
                        disabled={isLoading}
                      >
                        <SelectTrigger className="ml-6">
                          <SelectValue placeholder="Select collection..." />
                        </SelectTrigger>
                        <SelectContent>
                          {collections.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <div className="space-y-2 mt-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        id="new"
                        checked={state.config.createNewCollection}
                        onChange={() => updateConfig({ createNewCollection: true })}
                        disabled={isLoading}
                      />
                      <Label htmlFor="new" className="font-normal cursor-pointer">
                        Create new collection
                      </Label>
                    </div>

                    {state.config.createNewCollection && (
                      <Input
                        placeholder="Collection name"
                        value={newCollectionName}
                        onChange={(e) => setNewCollectionName(e.target.value)}
                        disabled={isLoading}
                        className="ml-6"
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Field Preview */}
              {state.detectedFields.length > 0 && state.progress.status === "idle" && (
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPreview(!showPreview)}
                  >
                    {showPreview ? "Hide" : "Show"} Detected Fields
                  </Button>

                  {showPreview && (
                    <div className="border rounded-lg p-3 max-h-48 overflow-y-auto">
                      <div className="space-y-1 text-sm">
                        {state.detectedFields.map((field) => (
                          <div key={field.name} className="flex items-center justify-between">
                            <span>{field.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {field.type}{" "}
                              {Math.round(field.detectionConfidence * 100)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Progress */}
              {(state.progress.status === "parsing" ||
                state.progress.status === "validating" ||
                state.progress.status === "importing") && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{state.progress.message}</span>
                    <span className="text-muted-foreground">
                      {state.progress.percentage}%
                    </span>
                  </div>
                  <Progress value={state.progress.percentage} className="h-2" />
                  {state.progress.status === "importing" && (
                    <div className="text-xs text-muted-foreground">
                      {state.progress.processedRows} / {state.progress.totalRows} rows
                    </div>
                  )}
                </div>
              )}

              {/* Success */}
              {state.progress.status === "completed" && state.result && (
                <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 text-sm">
                    <p className="font-medium text-green-900">
                      Import successful!
                    </p>
                    <p className="text-green-800 text-xs mt-1">
                      {state.result.importedRows} records imported
                      {state.result.failedRows > 0 &&
                        `, ${state.result.failedRows} failed`}
                    </p>
                  </div>
                </div>
              )}

              {/* Errors */}
              {state.progress.status === "error" && state.error && (
                <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-red-900 text-sm">{state.error}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 flex justify-end">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>

          {!state.fileSelected ? (
            <Button onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
              <Upload className="h-4 w-4 mr-2" />
              Choose File
            </Button>
          ) : state.progress.status === "idle" ? (
            <Button
              onClick={handleImport}
              disabled={
                isLoading ||
                parsedRowsCount === 0 ||
                (!state.config.createNewCollection
                  ? !selectedCollectionId
                  : !newCollectionName.trim())
              }
              className="bg-gradient-primary"
            >
              Import
            </Button>
          ) : state.progress.status === "completed" ? (
            <Button
              onClick={() => {
                onOpenChange(false);
                reset();
              }}
              className="bg-gradient-primary"
            >
              Done
            </Button>
          ) : (
            <Button disabled>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {state.progress.status === "parsing" && "Parsing..."}
              {state.progress.status === "validating" && "Validating..."}
              {state.progress.status === "importing" && "Importing..."}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
