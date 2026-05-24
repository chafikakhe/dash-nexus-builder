/**
 * Drag & Drop Upload Component
 * Handles file selection and validation with drag-drop support
 */

"use client";

import React, { useCallback, useState } from "react";
import { Upload, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { DragDropUploadProps } from "../types";
import { validateFile, formatFileSize } from "../utils";

export const DragDropUpload: React.FC<DragDropUploadProps> = ({
  onFileSelect,
  onError,
  isLoading = false,
  acceptedFormats = [".xlsx", ".xls", ".csv"],
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File) => {
      setFileError(null);
      const validation = validateFile(file);

      if (!validation.valid) {
        setFileError(validation.error || "Invalid file");
        onError({
          code: "INVALID_FILE",
          message: validation.error || "Invalid file",
          recoverable: true,
        });
        return;
      }

      setSelectedFile(file);
      onFileSelect(file);
    },
    [onFileSelect, onError]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFile(files[0]);
      }
    },
    [handleFile]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.currentTarget.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
    },
    [handleFile]
  );

  const handleClearFile = useCallback(() => {
    setSelectedFile(null);
    setFileError(null);
  }, []);

  return (
    <div className="w-full space-y-4">
      {selectedFile ? (
        // File Selected State
        <div className="relative">
          <div className="rounded-lg border-2 border-green-200 bg-green-50 p-6 flex items-center gap-4">
            <CheckCircle2 className="h-8 w-8 text-green-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-gray-900 truncate">
                {selectedFile.name}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearFile}
              disabled={isLoading}
            >
              Change
            </Button>
          </div>
        </div>
      ) : (
        // Upload Area
        <>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "relative rounded-lg border-2 border-dashed transition-all duration-200",
              isDragging
                ? "border-blue-500 bg-blue-50"
                : "border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100"
            )}
          >
            <input
              type="file"
              id="file-input"
              onChange={handleFileInputChange}
              accept={acceptedFormats.join(",")}
              className="absolute inset-0 cursor-pointer opacity-0"
              disabled={isLoading}
            />

            <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
              <Upload className="h-12 w-12 text-gray-400" />
              <div>
                <p className="font-semibold text-gray-900">
                  {isDragging
                    ? "Drop your file here"
                    : "Drag and drop your file here"}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  or{" "}
                  <label
                    htmlFor="file-input"
                    className="font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
                  >
                    click to select
                  </label>
                </p>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {acceptedFormats.join(", ").toUpperCase()} • Max 10 MB
              </p>
            </div>
          </div>
        </>
      )}

      {fileError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{fileError}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};
