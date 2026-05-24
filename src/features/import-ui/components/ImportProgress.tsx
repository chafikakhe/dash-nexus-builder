/**
 * Import Progress Component
 * Displays real-time progress during import with animated indicators
 */

"use client";

import React, { useEffect, useState } from "react";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { ImportProgressProps } from "../types";

export const ImportProgress: React.FC<ImportProgressProps> = ({
  progress,
  isVisible = true,
  showEstimatedTime = true,
}) => {
  const [displayPercentage, setDisplayPercentage] = useState(0);

  // Smooth animation for progress bar
  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayPercentage((prev) => {
        const diff = progress.percentage - prev;
        if (diff > 0) {
          return Math.min(prev + Math.ceil(diff / 5), progress.percentage);
        }
        return progress.percentage;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [progress.percentage]);

  if (!isVisible) {
    return null;
  }

  const formatTime = (seconds: number | undefined) => {
    if (!seconds) return "calculating...";
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.round(seconds / 60);
    return `${minutes}m`;
  };

  const getProgressColor = () => {
    if (progress.step === "importing") return "bg-blue-500";
    if (displayPercentage === 100) return "bg-green-500";
    return "bg-blue-500";
  };

  return (
    <div className="space-y-6">
      {/* Header with icon */}
      <div className="flex items-center gap-3">
        {progress.step === "importing" ? (
          <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
        ) : displayPercentage === 100 ? (
          <CheckCircle2 className="h-6 w-6 text-green-600" />
        ) : (
          <AlertCircle className="h-6 w-6 text-yellow-600" />
        )}
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">
            {progress.currentMessage || "Importing data..."}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {progress.processedRows.toLocaleString()} of{" "}
            {progress.totalRows.toLocaleString()} rows
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-3">
        <Progress value={displayPercentage} className="h-3" />
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-900">
            {displayPercentage}%
          </span>
          {showEstimatedTime && progress.estimatedTimeRemaining && (
            <span className="text-gray-600">
              ~{formatTime(progress.estimatedTimeRemaining)} remaining
            </span>
          )}
        </div>
      </div>

      {/* Detailed stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
          <p className="text-xs text-blue-600 font-semibold">PROCESSED</p>
          <p className="text-lg font-bold text-blue-900 mt-1">
            {progress.processedRows.toLocaleString()}
          </p>
        </div>
        <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
          <p className="text-xs text-gray-600 font-semibold">TOTAL</p>
          <p className="text-lg font-bold text-gray-900 mt-1">
            {progress.totalRows.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Status message */}
      {progress.currentMessage && (
        <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 text-center">
          <p className="text-sm text-gray-600">{progress.currentMessage}</p>
        </div>
      )}
    </div>
  );
};
