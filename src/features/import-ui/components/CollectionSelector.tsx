/**
 * Collection Selector Component
 * Allows user to select existing collection or create new one
 */

"use client";

import React from "react";
import { Plus, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { CollectionSelectorProps } from "../types";

export const CollectionSelector: React.FC<CollectionSelectorProps> = ({
  collections,
  selectedId,
  onSelect,
  onCreateNew,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">
          Where to import your data?
        </h3>
      </div>

      <RadioGroup value={selectedId || ""} onValueChange={onSelect}>
        {/* Create New Collection Option */}
        <div className="space-y-4">
          <div
            onClick={onCreateNew}
            className="flex items-start space-x-3 p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 cursor-pointer transition-colors"
          >
            <RadioGroupItem
              value="create-new"
              id="create-new"
              className="mt-1"
              onClick={onCreateNew}
            />
            <Label htmlFor="create-new" className="flex-1 cursor-pointer">
              <div className="flex items-center gap-3">
                <Plus className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-gray-900">
                    Create a new collection
                  </p>
                  <p className="text-sm text-gray-500">
                    Fields will be auto-detected from your data
                  </p>
                </div>
              </div>
            </Label>
          </div>

          {/* Existing Collections */}
          {collections.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <Database className="h-4 w-4 text-gray-400" />
                <p className="text-sm font-medium text-gray-600">
                  Existing Collections
                </p>
              </div>

              <div className="space-y-2">
                {collections.map((collection) => (
                  <div
                    key={collection.id}
                    onClick={() => onSelect(collection.id)}
                    className="flex items-start space-x-3 p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <RadioGroupItem
                      value={collection.id}
                      id={`collection-${collection.id}`}
                      className="mt-1"
                    />
                    <Label
                      htmlFor={`collection-${collection.id}`}
                      className="flex-1 cursor-pointer"
                    >
                      <div className="space-y-1">
                        <p className="font-medium text-gray-900">
                          {collection.name}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span>{collection.fieldCount} fields</span>
                          <span>•</span>
                          <span>{collection.recordCount} records</span>
                        </div>
                        {collection.description && (
                          <p className="text-sm text-gray-600 mt-2">
                            {collection.description}
                          </p>
                        )}
                      </div>
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {collections.length === 0 && (
            <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
              <p className="text-sm text-blue-900">
                No existing collections found. Create a new collection to get started.
              </p>
            </div>
          )}
        </div>
      </RadioGroup>
    </div>
  );
};
