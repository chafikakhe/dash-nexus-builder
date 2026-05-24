/**
 * File Preview Table Component
 * Displays parsed file data with field detection results
 */

"use client";

import React, { useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { FilePreviewTableProps } from "../types";

const getFieldTypeColor = (type: string): string => {
  const colors: Record<string, string> = {
    text: "bg-blue-100 text-blue-800",
    number: "bg-green-100 text-green-800",
    boolean: "bg-purple-100 text-purple-800",
    date: "bg-orange-100 text-orange-800",
    email: "bg-pink-100 text-pink-800",
    url: "bg-indigo-100 text-indigo-800",
    phone: "bg-cyan-100 text-cyan-800",
    select: "bg-yellow-100 text-yellow-800",
  };
  return colors[type] || "bg-gray-100 text-gray-800";
};

const getConfidenceLabel = (confidence: number): string => {
  if (confidence >= 0.9) return "Very High";
  if (confidence >= 0.75) return "High";
  if (confidence >= 0.5) return "Medium";
  return "Low";
};

export const FilePreviewTable: React.FC<FilePreviewTableProps> = ({
  data,
  detectedFields,
  maxRows = 10,
  onFieldEdit,
}) => {
  const [expandedFields, setExpandedFields] = useState<Set<number>>(new Set());

  const toggleExpanded = (index: number) => {
    const newExpanded = new Set(expandedFields);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedFields(newExpanded);
  };

  const displayRows = data.rows.slice(0, maxRows);

  return (
    <div className="space-y-6">
      {/* Field Detection Summary */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-4">
          <Info className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">
            Detected Fields ({detectedFields.length})
          </h3>
          <span className="text-sm text-gray-500">
            • {data.rowCount} rows
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {detectedFields.map((field, idx) => (
            <Collapsible key={idx} open={expandedFields.has(idx)}>
              <CollapsibleTrigger asChild>
                <button
                  onClick={() => toggleExpanded(idx)}
                  className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  <div className="text-left min-w-0">
                    <p className="font-medium text-sm text-gray-900 truncate">
                      {field.displayName}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className={getFieldTypeColor(field.type)}>
                        {field.type}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {Math.round(field.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                  <ChevronDown className="h-4 w-4 text-gray-500 ml-2 flex-shrink-0" />
                </button>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-gray-600 uppercase">
                      Confidence
                    </p>
                    <p className="text-sm text-gray-900 mt-1">
                      {getConfidenceLabel(field.confidence)} (
                      {Math.round(field.confidence * 100)}%)
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-gray-600 uppercase">
                      Sample Values
                    </p>
                    <div className="mt-2 space-y-1">
                      {field.sampleValues.length > 0 ? (
                        field.sampleValues.map((value, i) => (
                          <div
                            key={i}
                            className="text-sm text-gray-700 truncate pl-2 border-l-2 border-gray-300"
                          >
                            {String(value)}
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500 italic">
                          No sample values
                        </p>
                      )}
                    </div>
                  </div>

                  {onFieldEdit && (
                    <button
                      onClick={() => onFieldEdit(idx, field)}
                      className="w-full mt-2 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                    >
                      Customize
                    </button>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      </div>

      {/* Data Preview Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Preview</h3>
          <span className="text-sm text-gray-500">
            Showing {displayRows.length} of {data.rowCount} rows
          </span>
        </div>

        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="w-12 text-gray-600 font-semibold">
                  #
                </TableHead>
                {detectedFields.map((field, idx) => (
                  <TableHead
                    key={idx}
                    className="text-gray-600 font-semibold whitespace-nowrap"
                  >
                    <div className="flex items-center gap-2">
                      <span>{field.displayName}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs font-normal",
                          getFieldTypeColor(field.type)
                        )}
                      >
                        {field.type.slice(0, 3)}
                      </Badge>
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayRows.map((row, rowIdx) => (
                <TableRow key={rowIdx} className="hover:bg-gray-50">
                  <TableCell className="text-sm text-gray-500 font-medium">
                    {rowIdx + 1}
                  </TableCell>
                  {detectedFields.map((field, fieldIdx) => (
                    <TableCell
                      key={fieldIdx}
                      className="text-sm text-gray-700 truncate max-w-xs"
                    >
                      {String(row[field.name] || "")}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {displayRows.length < data.rowCount && (
          <p className="text-xs text-gray-500 text-center py-2">
            ... and {data.rowCount - displayRows.length} more rows
          </p>
        )}
      </div>
    </div>
  );
};

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
