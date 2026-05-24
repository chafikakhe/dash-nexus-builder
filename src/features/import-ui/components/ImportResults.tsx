/**
 * Import Results Component
 * Displays success/error results with summary statistics
 */

"use client";

import React from "react";
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  BarChart3,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { ImportResultsProps } from "../types";

export const ImportResults: React.FC<ImportResultsProps> = ({
  result,
  error,
  isLoading,
  onClose,
  onRetry,
  onViewCollection,
}) => {
  const isSuccess = result?.success && !error;
  const hasFailed = error || (result && !result.success);

  if (!result && !error) {
    return null;
  }

  const successRate = result
    ? Math.round(
        (result.importedRows / (result.importedRows + result.failedRows)) * 100
      ) || 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Success State */}
      {isSuccess && (
        <>
          {/* Icon and Heading */}
          <div className="flex flex-col items-center gap-4 text-center py-6">
            <div className="p-4 rounded-full bg-green-100">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900">
                Import Successful!
              </h3>
              <p className="text-gray-600 mt-2">
                Your data has been imported into{" "}
                <span className="font-semibold">{result.collectionName}</span>
              </p>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-gradient-to-br from-green-50 to-green-100 border border-green-200">
              <p className="text-xs text-green-700 font-semibold uppercase">
                Rows Imported
              </p>
              <p className="text-3xl font-bold text-green-900 mt-2">
                {result.importedRows.toLocaleString()}
              </p>
            </div>

            <div className="p-4 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200">
              <p className="text-xs text-blue-700 font-semibold uppercase">
                Success Rate
              </p>
              <p className="text-3xl font-bold text-blue-900 mt-2">
                {successRate}%
              </p>
            </div>

            {result.failedRows > 0 && (
              <div className="p-4 rounded-lg bg-gradient-to-br from-yellow-50 to-yellow-100 border border-yellow-200">
                <p className="text-xs text-yellow-700 font-semibold uppercase">
                  Rows Failed
                </p>
                <p className="text-3xl font-bold text-yellow-900 mt-2">
                  {result.failedRows.toLocaleString()}
                </p>
              </div>
            )}

            <div className="p-4 rounded-lg bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200">
              <p className="text-xs text-purple-700 font-semibold uppercase">
                Duration
              </p>
              <p className="text-3xl font-bold text-purple-900 mt-2">
                {(result.duration / 1000).toFixed(1)}s
              </p>
            </div>
          </div>

          {/* Errors (if any) */}
          {result.errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Some Rows Failed</AlertTitle>
              <AlertDescription>
                {result.errors.length} errors occurred during import. Check
                your data and try again.
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {onViewCollection && (
              <Button onClick={onViewCollection} className="gap-2">
                <BarChart3 className="h-4 w-4" />
                View Collection
              </Button>
            )}
          </div>
        </>
      )}

      {/* Error State */}
      {hasFailed && (
        <>
          {/* Icon and Heading */}
          <div className="flex flex-col items-center gap-4 text-center py-6">
            <div className="p-4 rounded-full bg-red-100">
              <XCircle className="h-12 w-12 text-red-600" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900">
                Import Failed
              </h3>
              <p className="text-gray-600 mt-2">
                We couldn't complete your import. Please review the error below
                and try again.
              </p>
            </div>
          </div>

          {/* Error Details */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{error.code}</AlertTitle>
              <AlertDescription className="mt-2 space-y-2">
                <p>{error.message}</p>
                {error.details && (
                  <pre className="text-xs bg-red-50 p-2 rounded overflow-auto max-h-40">
                    {JSON.stringify(error.details, null, 2)}
                  </pre>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Retry Info */}
          {error?.recoverable && (
            <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200">
              <p className="text-sm text-yellow-900">
                This error may be temporary. You can try importing again.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {onRetry && error?.recoverable && (
              <Button
                onClick={onRetry}
                disabled={isLoading}
                className="gap-2"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Try Again
                  </>
                )}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
};
